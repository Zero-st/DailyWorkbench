# -*- coding: utf-8 -*-
"""X/推特取数引擎：subprocess 拉起 grok-cli（headless），用其 `search_x` 拿实时帖子。

唯一职责 = 「拉起 grok-cli + 解析其 ndjson 事件流 + 产出结构化 X 帖子列表」。
被两处复用（一份引擎、两个适配，见 ADR 0012）：
  - 取数层 backend/pipeline/fetch_x.py（定时源，进 data.json）
  - 集成层 backend/mcp/server.py::x_search（按需，AI 副驾里问「X 上在聊啥」）

守北极星（同 opencli/claude 范式，ADR 0007/0009）：
  - grok-cli 是「重工具」（Bun 运行时 + xAI 付费 key），**只在取数/按需时被 subprocess 调用**，
    绝不进 App 核心运行时；命令经 wb_config.grok_cmd()、key 经 wb_config.grok_api_key() 取。
  - 未配置（grok_cmd()==None 或 key 为空）→ 抛 RuntimeError，由上游优雅跳过（该源不出现、
    其余管道不受影响）。密钥只在 workbench.local.json（gitignore），绝不入库/不推前端。

⚠ 最脆一环（本方案已知代价，见 ADR 0012 与 plan §5）：grok-cli 是 **Agent**，`--format json`
  产出的是**事件流、不是干净的帖子数组**。我们用 PROMPT 强约束它「只输出 JSON 数组」，再容错解析
  最终文本里的 JSON 数组。若日后要更确定/更省，把 _run() 换成直连 xAI x_search（Responses API
  /v1/responses + x_search 工具）即可——上游 fetch_x / MCP 工具 / data.json 契约全不动。
"""
import json
import os
import re
import subprocess

from backend.core import config as wb_config
from backend.core.paths import ROOT

# 单次运行墙钟（秒）：Agent 多轮工具可能较慢，但也不能无界占住。
_TIMEOUT = 150
# 限制工具轮数，压成本 + 防跑飞（README: --max-tool-rounds）。
_MAX_TOOL_ROUNDS = "3"

# 从最终文本里抠 JSON 数组：贪婪匹配最外层 [ ... ]（PROMPT 已要求只输出数组）。
_ARR_RE = re.compile(r"\[.*\]", re.DOTALL)
# 去掉可能的 ```json ... ``` 代码围栏
_FENCE_RE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$", re.MULTILINE)


def configured():
    """引擎是否可用：grok 命令 + api key 都齐。供上游/端点做能力探测。"""
    return bool(wb_config.grok_cmd()) and bool(wb_config.grok_api_key())


def _build_prompt(query, limit, since):
    """强约束 grok 只吐 JSON 数组（Agent 输出确定化的唯一抓手）。"""
    date_hint = ("，时间范围优先最近 %s" % since) if since else "，优先最近 24~48 小时"
    return (
        "用你的 search_x 工具在 X（推特）上检索这个主题的高相关近期帖子：%s%s。\n"
        "只输出一个 JSON 数组，最多 %d 个元素，**不要任何解释、不要 markdown 代码围栏**。\n"
        "每个元素形如："
        "{\"title\": \"发帖人或一句话标题\", \"url\": \"该帖永久链接\", "
        "\"summary\": \"这条帖子讲了什么的中文一句话摘要\"}。\n"
        "若没有可靠结果，就输出 []。"
        % (query, date_hint, limit)
    )


def _extract_text(ev):
    """从一条 ndjson 事件里尽力抠出可读文本（grok-cli 事件 schema 未知，做多形态兜底）。

    覆盖几种常见形态：
      - {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
      - {"type":"result","result":"..."} / {"type":"result","text":"..."}
      - {"type":"text","text":"..."} / {"content":"..."} / {"text":"..."}
    未知/噪声事件返回空串。真实形态需按 plan §4 步骤 3 手跑一次校准。
    """
    if isinstance(ev, str):
        return ev
    if not isinstance(ev, dict):
        return ""
    # 直接文本字段
    for k in ("text", "content", "result", "delta"):
        v = ev.get(k)
        if isinstance(v, str) and v.strip():
            return v
    # assistant/message.content 块数组
    msg = ev.get("message")
    if isinstance(msg, dict):
        blocks = msg.get("content")
        if isinstance(blocks, list):
            parts = []
            for b in blocks:
                if isinstance(b, dict) and isinstance(b.get("text"), str):
                    parts.append(b["text"])
                elif isinstance(b, str):
                    parts.append(b)
            if parts:
                return "\n".join(parts)
    return ""


def _run(query, limit, since):
    """拉起 grok-cli headless，回收 stdout 全文（ndjson 事件流拼成的文本）。未配置/失败抛异常。"""
    cmd = wb_config.grok_cmd()
    if not cmd:
        raise RuntimeError(
            "未配置 grok-cli（env WB_GROK_CMD / workbench.local.json grokCmd / "
            "PATH 上的 grok 均缺失）——未装 Bun+grok-cli 时该源自动跳过")
    key = wb_config.grok_api_key()
    if not key:
        raise RuntimeError(
            "未配置 GROK_API_KEY（env 或 workbench.local.json grokApiKey）——grok-cli 无 key 跑不了")

    prompt = _build_prompt(query, limit, since)
    argv = [*cmd, "--prompt", prompt, "--format", "json",
            "--max-tool-rounds", _MAX_TOOL_ROUNDS]
    env = dict(os.environ)
    env["GROK_API_KEY"] = key
    env["PYTHONIOENCODING"] = "utf-8"
    try:
        p = subprocess.run(
            argv, cwd=ROOT, env=env,
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("grok-cli 超时（>%ds）" % _TIMEOUT)
    except Exception as e:
        raise RuntimeError("调用 grok-cli 失败：%s" % e)
    if p.returncode != 0:
        tail = ((p.stderr or "").strip().splitlines() or [""])[-1]
        raise RuntimeError("grok-cli 退出码 %d：%s" % (p.returncode, tail))

    # 逐行解析 ndjson，拼接所有可读文本；解析失败的行按纯文本兜底（防 --format json 非严格 ndjson）。
    texts = []
    for line in (p.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            texts.append(line)  # 非 JSON 行：可能直接是正文
            continue
        t = _extract_text(ev)
        if t:
            texts.append(t)
    full = "\n".join(texts).strip()
    if not full:
        raise ValueError("grok-cli 无有效输出")
    return full


def _parse_posts(text, limit):
    """从最终文本里抠 JSON 数组并规整成统一 item：{title, summary, url}。抠不到/空则抛异常。"""
    body = _FENCE_RE.sub("", text).strip()
    m = _ARR_RE.search(body)
    if not m:
        raise ValueError("grok-cli 输出里找不到 JSON 数组（Agent 未按约束输出）")
    try:
        arr = json.loads(m.group(0))
    except ValueError as e:
        raise ValueError("grok-cli 输出的 JSON 数组解析失败：%s" % e)
    if not isinstance(arr, list):
        raise ValueError("grok-cli 输出不是数组")
    out = []
    for el in arr:
        if not isinstance(el, dict):
            continue
        title = str(el.get("title") or "").strip()
        url = str(el.get("url") or "").strip()
        summary = str(el.get("summary") or "").strip()
        if not title and not summary:
            continue
        out.append({
            "title": title or (summary[:40] if summary else "(无标题)"),
            "summary": summary,
            "url": url,
        })
        if len(out) >= limit:
            break
    if not out:
        raise ValueError("grok-cli 输出数组里无有效帖子")
    return out


def search_x(query, limit=20, since=None):
    """在 X 上检索 query，返回结构化帖子列表 [{title, summary, url}]。

    未配置（grok 命令/key 缺失）或 Agent 输出无法解析 → 抛异常，由上游优雅处理。
    """
    query = (query or "").strip()
    if not query:
        raise ValueError("空 query")
    try:
        limit = max(1, min(int(limit), 50))
    except (TypeError, ValueError):
        limit = 20
    text = _run(query, limit, since)
    return _parse_posts(text, limit)
