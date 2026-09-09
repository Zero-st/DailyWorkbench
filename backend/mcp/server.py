# -*- coding: utf-8 -*-
"""DailyWorkbench MCP 工具层（集成层 —— 不进 App 运行时）。

把 `backend.clients.kb` 的纯函数薄封装成 MCP tools，让 Claude Code 等 MCP 宿主
以「工具」直接读写工作台知识库（Obsidian vault + 沉淀库）。

北极星守护（同 ADR 0007「重工具关取数层」范式）：
    - `mcp` 是第三方依赖，**只在显式运行本模块时才需要**；
    - App 核心（`backend/server.py` 与前端 SPA）**永不 import 本模块**，故
      `git clone` + 双击 `index.html` / `python -m backend.server` 仍零依赖离线可跑。

运行（stdio，供 `claude mcp add` 拉起；用绝对路径最稳，绕开 cwd 问题）：
    <anaconda-python> /abs/path/DailyWorkbench/backend/mcp/server.py
或（cwd = 仓库根时）：
    <anaconda-python> -m backend.mcp

依赖：pip install -r backend/mcp/requirements.txt
配置：复用 workbench.local.json（vault/depositRoot 经 backend.core.config.kb() 解析）。
"""
import os
import sys
from typing import Any, Optional

# 让本文件被绝对路径直接运行（`python /abs/.../server.py`）时也能 import backend.*：
# 把仓库根塞进 sys.path（backend/mcp/server.py -> backend/mcp -> backend -> 仓库根）。
# 必须在 `from backend...` 之前执行。
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from mcp.server.mcpserver import MCPServer  # 第三方依赖（mcp 2.x，v1 的 FastMCP 已改名）：仅本集成层需要，App 核心不引用
from backend.clients import kb  # 数据层单一真源（纯函数；import 时经 config 解析 vault/depositRoot）

mcp = MCPServer("dailyworkbench")

# 只读模式：env WB_MCP_READONLY=1（或 argv 带 --read-only）时**不注册写工具 kb_save**，
# 从 MCP 协议层根断写路径。页面触发的无头 agent（backend/clients/agent.py）就以此模式拉起
# 本 server —— 写库一律走前端「起草→人点保存」的 /api/kb/save 人工闸（见 ADR 0009）。
# 终端里 `claude mcp add` 注册的那路不设此环境变量，kb_save 照常可用（Phase 1 行为不变）。
_READONLY = bool(os.environ.get("WB_MCP_READONLY")) or ("--read-only" in sys.argv)


@mcp.tool()
def kb_tree() -> dict:
    """列出 Obsidian 知识库（vault）里全部 Markdown 笔记（树/清单）。

    只读。返回 {configured, root, files:[{rel,name,title,mtime,size}], sig}；
    未配置 vault 时返回 {configured: False}。"""
    if not kb.VAULT:
        return {"configured": False}
    files, sig = kb.scan()
    return {"configured": True, "root": kb.VAULT, "files": files, "sig": sig}


@mcp.tool()
def kb_note(path: str) -> dict:
    """读取单篇笔记全文。path = 相对 vault 的路径（取自 kb_tree 的 rel / kb_search 的 path）。

    只读。返回 {configured, note:{path,raw,fm,body,sibs}}；空 path / 越界 / 不存在返回 error。"""
    if not kb.VAULT:
        return {"configured": False}
    rel = (path or "").strip()
    if not rel:
        return {"error": "missing path"}
    res = kb.read_note(rel)
    if res is None:
        return {"error": "not found or out of vault"}
    return {"configured": True, "note": res}


@mcp.tool()
def kb_search(q: str, type: str = "full") -> dict:
    """检索知识库。type: full=正文子串 | title=文件名/标题 | tag=frontmatter/行内标签。

    只读。返回 {configured, results:[{path,title,snippet,hl}], q, type}（≤50 条）。"""
    if not kb.VAULT:
        return {"configured": False, "results": []}
    q = (q or "").strip()
    stype = (type or "full").strip()
    res = kb.search(q, stype) if q else []
    return {"configured": True, "results": res, "q": q, "type": stype}


@mcp.tool()
def kb_deposits(module: str = "") -> dict:
    """列出「沉淀」记录（工作台各模块存进库的卡片，新→旧）；可按 module 过滤。

    只读。module 例：蒸馏库 / AI助手 / 今日 / 资讯 / 会话档案 / 知识库 / 收件箱（空=全部）。
    返回 {configured, deposits:[{savedAt,module,date,relPath,fileName,title,source,bytes,
    platform?,topic?,tier?, vaultPath}]}。tier=内容价值分档 S/A/B/C/D。"""
    if not kb.DEPOSIT:
        return {"configured": False, "deposits": []}
    module = (module or "").strip() or None
    return {"configured": True, "deposits": kb.list_deposits(module)}


if not _READONLY:
  @mcp.tool()
  def kb_save(module: str, source: str, title: str, body: str,
            extra: Optional[dict[str, Any]] = None) -> dict:
    """【写操作·会写用户真实 Obsidian vault】把一篇内容沉淀进知识库。

    三级目录 depositRoot/<module>/<date>/<清洗后标题>.md + YAML frontmatter + 追加
    _index.jsonl；同名自动加序号，**永不覆盖**。

    module（白名单，非白名单会报错）：今日 | 资讯 | AI助手 | 会话档案 | 知识库 | 蒸馏库 | 收件箱
    source（枚举，非法回退 note）：review | ai-daily | news | ai-chat | session | note | distill
    title：显示用原标题（清洗结果只用作文件名）
    body：Markdown 正文
    extra（可选，蒸馏经验卡等用）：{platform, author, url, topic, tier, actionable}
        —— platform/topic/tier 同时写进 _index.jsonl 供「蒸馏库」按平台/主题/分档筛选；
        tier=S/A/B/C/D；actionable 支持字符串或字符串列表。

    返回 {ok, path, fileName, savedAt} 或 {ok: false, error}。"""
    return kb.save(module, source, title, body, extra)


def main():
    # stdio 传输（mcp.run 是同步入口）。将来「上服务」改 transport="streamable-http" 即可，工具函数不动。
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
