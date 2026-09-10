# -*- coding: utf-8 -*-
"""页面触发的无头 agent：subprocess 拉起 `claude -p`，流式解析 stream-json，产出精简事件。

设计要点（决策与理由的单一真源 = docs/adr/0009-*.md）：
- **编排权在 harness**：claude 跑 agent loop / 调工具 / 抓取；本模块只负责「拉起 + 解析 + 转发」，
  绝不在这里重造 agent loop（那会砸零依赖北极星 + 背维护债）。
- **一律只读**：页面触发的 agent 白名单 = kb 读工具 + WebFetch，**绝不含 kb_save/Bash/Edit/Write**。
  写库由用户在页面「起草→点保存」经现成 /api/kb/save 落地（人工闸）。改 READ_ONLY_TOOLS = 改安全边界。
- **零依赖**：只 subprocess 调 claude 二进制（同 local_refresh / opencli 范式），不引 Agent SDK。
- **优雅劣化**：claude 未配置（claude_cmd()==None）→ 产出一条 error 事件（configured:false），不抛异常。
- **MCP 隔离**：--strict-mcp-config + 内联 --mcp-config 只挂 dailyworkbench 一个 stdio server，
  与用户其余（可能未授权的）MCP 隔离，且不依赖 `claude mcp add` 的 user-scope 注册。
- **CLI 无 --max-turns/--timeout**（已对 claude 2.1.x --help 核实）→ 轮数/时长兜底用
  --max-budget-usd + 后端墙钟看门狗（超时杀子进程）。

流式契约：`stream()` 是生成器，产出精简事件 dict：
    {"type": "meta",   ...}                 # 启动/init 元信息
    {"type": "text",   "text": "..."}       # 助手正文增量（--include-partial-messages 的 text_delta）
    {"type": "tool",   "name": "...", "input": {...}}   # 工具调用（页面显示「🔍 搜知识库…」）
    {"type": "result", "text": "...", "cost_usd": 0.01, "stop": "...", "denials": [...]}
    {"type": "error",  "error": "...", "configured": bool?}
调用方（server.py 的 _post_agent）负责把每个事件包成 SSE 帧 + flush + 断连处理。
生成器 close() 时（客户端断连）触发 finally 杀子进程，防孤儿。
"""
import json
import os
import re
import subprocess
import threading

from backend.core import config as wb_config
from backend.core.paths import ROOT

# 只读白名单：页面触发的 agent 能碰的全部工具。**改这里 = 改安全边界**（见模块 docstring）。
READ_ONLY_TOOLS = [
    "mcp__dailyworkbench__kb_search",
    "mcp__dailyworkbench__kb_note",
    "mcp__dailyworkbench__kb_deposits",
    "mcp__dailyworkbench__kb_tree",
    "WebFetch",
]

# 后端墙钟兜底（秒）：CLI 无 --timeout，超时直接杀子进程，防单发跑飞占住连接。
_WALL_CLOCK_TIMEOUT = 180

# session_id 形态门：只放行 UUID 样式（36 位 hex+连字符）。前端传来的值若以 '--' 开头，
# 会被 claude 当成参数——argv 传递虽非 shell，仍须挡住 flag 形态，故白名单式校验。
_SESSION_ID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


def _mcp_config_json():
    """内联 --mcp-config 字符串：只挂 dailyworkbench 一个 stdio server（已对 claude 2.1.x 烟测通过的格式）。

    以 `--read-only` 拉起该 server —— 只读模式下它**不注册 kb_save**（见 backend/mcp/server.py），
    从 MCP 协议层根断写路径（`--tools`/`--allowedTools` 点名管不住 MCP server 暴露的工具集，
    唯有让写工具「不存在」才硬）。用 argv 传而非 env：不依赖 stdio env 是合并还是替换。"""
    py, server = wb_config.mcp_server_argv()
    return json.dumps({
        "mcpServers": {
            "dailyworkbench": {"type": "stdio", "command": py, "args": [server, "--read-only"]},
        }
    })


def _build_prompt(task, payload):
    """最终 prompt。**优先用前端传来的 prompt**（蒸馏六维工艺的单一真源在前端 distill-template.js，
    这样 Python 侧不复刻、不漂移）；仅当前端只给了 url 时，才用一段最小蒸馏指令兜底。"""
    p = (payload.get("prompt") or "").strip()
    if p:
        return p
    if task == "distill":
        url = (payload.get("url") or "").strip()
        if url:
            return (
                "请蒸馏这个链接的内容：%s\n"
                "先用 WebFetch 抓正文，再产出一张六维经验卡"
                "（含 tier 分级 / 来源平台 / 主题 / 可操作要点）。"
                "最后把成稿卡片用 ```md 代码块整段输出。"
                "**不要调用任何写库工具**——落库由用户在页面确认后进行。" % url
            )
    return ""


def _map_event(ev):
    """把一行 stream-json 事件映射成 0..n 个精简事件（list）。未知/噪声行返回空 list。"""
    t = ev.get("type")
    if t == "system" and ev.get("subtype") == "init":
        return [{
            "type": "meta", "phase": "init",
            "model": ev.get("model"),
            "mcp": ev.get("mcp_servers"),
            "session_id": ev.get("session_id"),  # 前端据此续接（--resume）本话题的下一轮
        }]
    if t == "stream_event":
        e = ev.get("event") or {}
        if e.get("type") == "content_block_delta":
            d = e.get("delta") or {}
            if d.get("type") == "text_delta" and d.get("text"):
                return [{"type": "text", "text": d["text"]}]
        return []
    if t == "assistant":
        # 一条 assistant 消息可能含多个 content block（文本 + 多个 tool_use）。
        # 文本走 stream_event 的增量（上面），这里只取 tool_use 报「在调哪个工具」。
        out = []
        for blk in ((ev.get("message") or {}).get("content") or []):
            if isinstance(blk, dict) and blk.get("type") == "tool_use":
                out.append({"type": "tool", "name": blk.get("name"), "input": blk.get("input")})
        return out
    if t == "result":
        return [{
            "type": "result",
            "text": ev.get("result") or "",
            "cost_usd": ev.get("total_cost_usd"),
            "stop": ev.get("stop_reason") or ev.get("terminal_reason"),
            "denials": ev.get("permission_denials") or [],
            "session_id": ev.get("session_id"),  # 兜底：init 若漏，从终答再取一次
        }]
    return []


def _valid_session_id(v):
    """只放行 UUID 样式的 session_id，其余（含 None/空/`--flag` 形态）一律回空串 = 开新会话。"""
    v = (v or "").strip()
    return v if _SESSION_ID_RE.match(v) else ""


def _build_argv(cmd, prompt, session_id):
    """组 claude -p 的 argv。

    安全边界（纵深；每一层都经真机验证，见 ADR 0009 / 模块 docstring）：
      --restricted        移除 Bash/PowerShell/REPL 等跑代码工具，且**无视 user/project/local 设置**
                          （这台机 ambient 已放行 Bash，只有 restricted 能压住；WebFetch 须 --tools 点名才留）
      --tools             收窄「可用工具集」= 只读 kb + WebFetch
      --allowedTools      预批这些工具，免被 --permission-prompts none 误拦
      --permission-prompts none  任何还会弹窗的动作一律自动拒（dontAsk 反而是「别问·放行」，切勿用）
      --strict-mcp-config 只挂 --mcp-config 里的 dailyworkbench，且该 server 以 --read-only 拉起（无 kb_save）

    这套安全 argv **每次都重传**——`--resume` 不恢复原会话的权限模式（以本次 -p 传入为准），
    故续接旧会话**不会**放宽只读白名单（话题隔离续接的安全前提，见 ADR 0009 续接一节）。
    """
    tools_csv = ",".join(READ_ONLY_TOOLS)
    argv = [
        *cmd, "-p", prompt,
        "--output-format", "stream-json", "--verbose", "--include-partial-messages",
        "--restricted",
        "--tools", tools_csv,
        "--allowedTools", tools_csv,
        "--permission-prompts", "none",
        "--strict-mcp-config", "--mcp-config", _mcp_config_json(),
        "--max-budget-usd", str(wb_config.agent_budget_usd()),
    ]
    if session_id:
        argv += ["--resume", session_id]  # 话题隔离续接：带上本话题上一轮的 session_id
    model = wb_config.agent_model()
    if model:
        argv += ["--model", model]
    return argv


def _run_once(argv, env, state):
    """拉起一次 claude -p，逐行解析 stream-json，yield 精简事件；退出码写回 state['rc']。

    finally 里 cancel 看门狗 + kill 子进程 + wait，确保客户端断连（生成器被 close）时不留孤儿进程。
    """
    try:
        proc = subprocess.Popen(
            argv, cwd=ROOT, env=env, text=True, bufsize=1,
            stdin=subprocess.DEVNULL,          # 不喂 stdin，免 claude 空等 3s（烟测踩到）
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    except Exception as e:  # noqa: BLE001 —— 启动失败也要优雅告知页面，不让 handler 崩
        yield {"type": "error", "error": "启动 claude 失败：%s" % e}
        state["rc"] = -1
        return

    watchdog = threading.Timer(_WALL_CLOCK_TIMEOUT, proc.kill)
    watchdog.daemon = True
    watchdog.start()
    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except ValueError:
                continue  # 非 JSON 行（罕见）直接跳过
            for out in _map_event(ev):
                yield out
    finally:
        watchdog.cancel()
        try:
            proc.kill()   # 正常结束是 no-op；客户端断连（GeneratorExit）时杀掉防孤儿
        except Exception:
            pass
        try:
            proc.wait(timeout=5)
        except Exception:
            pass
        state["rc"] = proc.returncode


def stream(task, payload):
    """生成器：拉起 claude -p，逐行解析 stream-json，yield 精简事件 dict。

    话题隔离续接：payload 带合法 session_id → 以 `--resume` 续接本话题上一轮（原文全文/上文都在
    服务端会话里，追问不重抓）；不带 → 全新会话。会话过期/文件缺失导致续接失败时，降级去掉
    --resume 重跑一次 = 开新会话，新 session_id 经 init 事件回给前端刷新（见 ADR 0009）。

    未配置 claude → 只 yield 一条 error(configured=False) 后返回（优雅劣化）。
    """
    cmd = wb_config.claude_cmd()
    if not cmd:
        yield {"type": "error", "configured": False,
               "error": "claude 未配置：在 workbench.local.json 设 claudeCmd，或把 claude 加到 PATH"}
        return

    prompt = _build_prompt(task, payload)
    if not prompt:
        yield {"type": "error", "error": "空 prompt（缺 payload.prompt 或 payload.url）"}
        return

    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"

    session_id = _valid_session_id(payload.get("session_id"))
    # 带 --resume 先跑；续接失败（用了 resume、没产出任何正文、非零退出，多因会话过期/缺失）→
    # 落到下一次（无 resume）重跑 = 开新会话。无 session_id 时只跑一次全新会话。
    attempts = [session_id, None] if session_id else [None]

    yield {"type": "meta", "phase": "started"}
    for i, sid in enumerate(attempts):
        state = {"rc": None}
        saw_content = False
        inner = _run_once(_build_argv(cmd, prompt, sid), env, state)
        try:
            for out in inner:
                if out.get("type") in ("text", "result", "tool"):
                    saw_content = True
                yield out
        finally:
            inner.close()  # 客户端断连时显式关内层生成器 → 触发其 finally 杀子进程防孤儿
        resume_failed = bool(sid) and not saw_content and state["rc"] not in (0, None)
        if resume_failed and i + 1 < len(attempts):
            yield {"type": "meta", "phase": "resume_failed"}  # 前端可据此清掉旧 session_id
            continue
        break
