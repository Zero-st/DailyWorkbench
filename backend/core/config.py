# -*- coding: utf-8 -*-
"""集中式配置解析：把「随机器/随用户而变」的环境绑定参数从代码里外置。

解析优先级（每个键独立）：
    环境变量  >  workbench.local.json  >  旧的分文件(supabase/kb.local.json)  >  平台默认

- 新增/迁移「环境绑定」参数（路径、盘符、密钥、主机白名单）统一放
  workbench.local.json（已 gitignore，不入库）；参考 workbench.local.json.example。
- 纯逻辑常量（如「日报保留 14 天」）不要放这里——那属于代码。
- 只用标准库，保持本项目「零第三方依赖」。
"""
import json
import os
import platform
import shlex
import shutil
import sys
import tempfile

from backend.core.paths import ROOT  # *.local.json 配置钉在仓库根

IS_WIN = platform.system() == "Windows"


def _load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


# 统一本地配置文件（缺失即为空 dict，全部回退平台默认）
_LOCAL = _load_json(os.path.join(ROOT, "workbench.local.json"))


def _first(*vals):
    for v in vals:
        if v:
            return v
    return None


def workspace():
    """WorkBuddy 工作区根目录（原硬编码 E:\\AITools\\workbuddy\\workspace）。"""
    default = os.path.join(os.path.expanduser("~"), ".workbuddy", "workspace")
    return _first(os.environ.get("WB_WORKSPACE"), _LOCAL.get("workspace"), default)


def ollama_exe():
    """Ollama 可执行文件路径：优先 PATH(shutil.which)，再配置，最后 None。

    配置值为 "auto"（或缺失）表示只靠 PATH 查找。
    """
    cfg = _LOCAL.get("ollamaExe")
    found = shutil.which("ollama")
    if found:
        return found
    if cfg and cfg != "auto":
        return cfg  # 交给调用方 os.path.isfile 判断是否真实存在
    return None


def opencli_cmd():
    """OpenCLI 调用命令（argv 列表），供**取数层**抓取器 subprocess 调用。

    OpenCLI 把网站封装成确定性 CLI（需 Node>=20），只在抓数据时被调用，**不进 App 运行时**，
    故属「环境绑定」参数：优先级 env WB_OPENCLI_CMD > workbench.local.json opencliCmd >
    PATH 上的 opencli。值可为字符串（"opencli" 或 "node /path/to/dist/src/main.js"，按 shell
    词法切分）或数组（["node", "/path/to/main.js"]）。**返回 None 表示未配置**——抓取器据此
    优雅跳过、保留旧数据，不影响其余管道（守北极星：App 仍零依赖离线可跑）。
    """
    raw = os.environ.get("WB_OPENCLI_CMD") or _LOCAL.get("opencliCmd")
    if isinstance(raw, list):
        argv = [str(x) for x in raw if str(x).strip()]
        return argv or None
    if isinstance(raw, str) and raw.strip():
        return shlex.split(raw)
    found = shutil.which("opencli")
    return [found] if found else None


def claude_cmd():
    """Claude Code CLI 调用命令（argv 列表），供**页面触发的无头 agent** subprocess 拉起。

    同 opencli_cmd 心法：claude 是「集成层重工具」（需 Node/联网/鉴权），只在页面点触发时
    被 `backend/clients/agent.py` 调用，**不进 App 核心运行时**，故属「环境绑定」参数：
    优先级 env WB_CLAUDE_CMD > workbench.local.json claudeCmd > PATH 上的 claude。
    值可为字符串（"claude" 或 "/abs/claude"，按 shell 词法切分）或数组。**返回 None 表示
    未配置**——agent 层据此产出 error 事件优雅劣化（页面显示「未配置」），App 仍零依赖离线可跑。
    """
    raw = os.environ.get("WB_CLAUDE_CMD") or _LOCAL.get("claudeCmd")
    if isinstance(raw, list):
        argv = [str(x) for x in raw if str(x).strip()]
        return argv or None
    if isinstance(raw, str) and raw.strip():
        return shlex.split(raw)
    found = shutil.which("claude")
    return [found] if found else None


def mcp_server_argv():
    """dailyworkbench MCP server 的启动 argv：[python, server.py]。

    供 agent 层组 `--strict-mcp-config --mcp-config` 内联配置用——只挂我们这一个 server，
    与用户其余（可能未授权的）MCP 隔离，且不依赖 Phase 1 的 `claude mcp add` user-scope 注册。
    python：env WB_MCP_PYTHON > workbench.local.json mcpPython > 跑本后端的解释器（sys.executable，
    通常即装了 mcp 的那个 anaconda）。server.py 路径由仓库根推导。
    """
    py = os.environ.get("WB_MCP_PYTHON") or _LOCAL.get("mcpPython") or sys.executable
    server = os.path.join(ROOT, "backend", "mcp", "server.py")
    return [py, server]


def agent_model():
    """页面触发 agent 的模型别名（控成本：CLI 默认可能是 opus，路由级蒸馏太贵）。

    env WB_AGENT_MODEL > workbench.local.json agentModel > 'sonnet'。
    显式设为空串 "" 表示「用 CLI/账户默认模型」（不传 --model）。
    """
    v = os.environ.get("WB_AGENT_MODEL")
    if v is None:
        v = _LOCAL.get("agentModel")
    return "sonnet" if v is None else v


def agent_budget_usd():
    """单次 agent 运行的花费上限（--max-budget-usd），兜底防跑飞。默认 1.0 美元。"""
    v = os.environ.get("WB_AGENT_BUDGET") or _LOCAL.get("agentBudgetUsd")
    try:
        return float(v) if v else 1.0
    except (TypeError, ValueError):
        return 1.0


def diag_log():
    """sync 诊断日志路径（原硬编码 D:\\AIWork\\sync_diag.log）。

    默认放系统临时目录：跨平台、且在仓库外，避免被 runner 的 git clean 清掉。
    """
    return _first(
        os.environ.get("WB_DIAG_LOG"),
        _LOCAL.get("diagLog"),
        os.path.join(tempfile.gettempdir(), "wb_sync_diag.log"),
    )


def disks():
    """要探测占用的磁盘根路径列表（原硬编码 ("C:\\","D:\\")，仅 Windows）。"""
    cfg = _LOCAL.get("disks")
    if cfg:
        return list(cfg)
    return ["C:\\", "D:\\"] if IS_WIN else ["/"]


def supabase():
    """返回 (url, service_key)。兼容旧 supabase.local.json 与环境变量。"""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    sb = _LOCAL.get("supabase") or {}
    url = url or sb.get("url") or ""
    key = key or sb.get("serviceKey") or sb.get("service_role") or ""
    if not url or not key:
        legacy = _load_json(os.path.join(ROOT, "supabase.local.json"))
        url = url or legacy.get("url", "")
        key = key or legacy.get("serviceKey") or legacy.get("service_role") or ""
    return url.rstrip("/"), key


def kb():
    """返回 (vault, deposit_root)。兼容旧 kb.local.json 与环境变量。"""
    vault = os.environ.get("KB_VAULT", "")
    deposit = os.environ.get("KB_DEPOSIT", "")
    k = _LOCAL.get("kb") or {}
    vault = vault or k.get("vault") or ""
    deposit = deposit or k.get("depositRoot") or ""
    if not vault:
        legacy = _load_json(os.path.join(ROOT, "kb.local.json"))
        vault = vault or legacy.get("vault", "")
        deposit = deposit or legacy.get("depositRoot", "")
    return (os.path.normpath(vault) if vault else ""), (os.path.normpath(deposit) if deposit else "")


def inbox_path():
    """捕获收件箱数据文件路径（默认仓库根 inbox.local.json，已 gitignore）。

    收件箱是「暂存工作集」，故意不写进 Obsidian vault：沉淀根可能是公开库，
    且状态流转不该靠改 frontmatter。详见 docs/design/捕获收件箱-浏览器扩展-设计.md。
    """
    cfg = _LOCAL.get("inbox") or {}
    return _first(
        os.environ.get("WB_INBOX_PATH"),
        cfg.get("path"),
        os.path.join(ROOT, "inbox.local.json"),
    )


def chat_allow_hosts():
    """AI 聊天代理目标主机白名单；空列表 = 不限制（保持旧行为）。"""
    cp = _LOCAL.get("chatProxy") or {}
    return list(cp.get("allowHosts") or [])


# ---------- 资讯语义检索：enrich（摘要/标签/向量）与 Zilliz 向量库 ----------
# 全属「环境绑定 + 密钥」：只填在 workbench.local.json（gitignore），缺失即整条能力
# 优雅停用（enrich 跳过、语义搜索端点回 configured:false），App 其余部分不受影响。
# 见 ADR 0011。

def enrich_chat():
    """enrich 生成「摘要+标签」用的 chat 模型：返回 (base_url, model, key)。

    OpenAI 兼容 /chat/completions；base_url 填到 /v1 层级（如 https://.../v1）。
    缺任一即视为未配置 -> enrich 跳过摘要/标签（保留各源原始 summary）。
    """
    e = (_LOCAL.get("enrich") or {}).get("chat") or {}
    base = os.environ.get("WB_ENRICH_CHAT_BASEURL") or e.get("baseUrl") or ""
    model = os.environ.get("WB_ENRICH_CHAT_MODEL") or e.get("model") or ""
    key = os.environ.get("WB_ENRICH_CHAT_KEY") or e.get("key") or ""
    return base.rstrip("/"), model, key


def enrich_embedding():
    """enrich/查询向量化用的 embedding 模型：返回 (base_url, model, key, dim)。

    OpenAI 兼容 /embeddings；dim 可留空(0)，由建库脚本探测、检索时以实际返回维度为准。
    查询与文档必须同一模型（对称性），故语义搜索端点复用本配置。
    """
    e = (_LOCAL.get("enrich") or {}).get("embedding") or {}
    base = os.environ.get("WB_ENRICH_EMBED_BASEURL") or e.get("baseUrl") or ""
    model = os.environ.get("WB_ENRICH_EMBED_MODEL") or e.get("model") or ""
    key = os.environ.get("WB_ENRICH_EMBED_KEY") or e.get("key") or ""
    dim = e.get("dim")
    try:
        dim = int(dim) if dim else 0
    except (TypeError, ValueError):
        dim = 0
    return base.rstrip("/"), model, key, dim


def enrich_limits():
    """enrich 成本护栏：返回 (max_items_per_run, batch_size)。默认 200 / 10。"""
    e = _LOCAL.get("enrich") or {}
    try:
        mx = int(e.get("maxItemsPerRun") or 200)
    except (TypeError, ValueError):
        mx = 200
    try:
        bs = int(e.get("batchSize") or 10)
    except (TypeError, ValueError):
        bs = 10
    return max(1, mx), max(1, bs)


def zilliz():
    """Zilliz Cloud 向量库：返回 (endpoint, token, collection)。

    endpoint = serverless 集群地址（https://in03-....cloud.zilliz.com，REST v2 直接拼 /v2/vectordb/...）。
    缺 endpoint/token 即未配置 -> 向量 upsert/search 跳过（enrich 仍可只写摘要/标签）。
    collection 缺省 'wb_info'。
    """
    z = _LOCAL.get("zilliz") or {}
    endpoint = os.environ.get("WB_ZILLIZ_ENDPOINT") or z.get("endpoint") or ""
    token = os.environ.get("WB_ZILLIZ_TOKEN") or z.get("token") or ""
    collection = os.environ.get("WB_ZILLIZ_COLLECTION") or z.get("collection") or "wb_info"
    return endpoint.rstrip("/"), token, collection
