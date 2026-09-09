# DailyWorkbench MCP 工具层（`backend/mcp/`）

把工作台的知识库能力暴露成 **MCP tools**，让 **Claude Code**（及任何 MCP 宿主）以
「工具」直接读写工作台的 Obsidian 知识库与沉淀库——不用再「复制指令→人肉贴来贴去」。

> **集成层，不进 App 运行时。** App 核心（`backend/server.py` + 前端 SPA）永不 import
> 本模块；`mcp` 依赖只在运行本模块时才需要。所以 `git clone` + 双击 `index.html` /
> `python -m backend.server` 照样**零依赖离线可跑**。心法同 [ADR 0007](../../docs/adr/0007-opencli-ingestion-source.md)，
> 决策见 [ADR 0008](../../docs/adr/0008-mcp-integration-layer.md)。

## 工具

| 工具 | 作用 | 读/写 |
|---|---|---|
| `kb_tree()` | 列 vault 全部笔记 | 读 |
| `kb_note(path)` | 读单篇笔记全文 | 读 |
| `kb_search(q, type=full\|title\|tag)` | 检索知识库 | 读 |
| `kb_deposits(module?)` | 列沉淀卡（含 tier/platform/topic） | 读 |
| `kb_save(module, source, title, body, extra?)` | 沉淀一篇进库 | **写** |

harness 侧命名为 `mcp__dailyworkbench__kb_*`。**未暴露** `/api/chat`（带 key）、`/api/refresh`（起子进程）、模型/收件箱写端点。

### 只读模式（`--read-only` / `WB_MCP_READONLY=1`）

带 `--read-only` 参数（或设环境变量 `WB_MCP_READONLY=1`）拉起时，**不注册 `kb_save`** —— 写工具在 MCP 协议层就不存在。**页面驱动的无头 agent**（Phase 2，`backend/clients/agent.py`，见 [ADR 0009](../../docs/adr/0009-page-driven-agent.md)）正是以此模式拉起本 server，从根上断掉写路径（写库改由用户在页面「起草→点保存」经 `/api/kb/save` 落地）。终端 `claude mcp add` 注册那路**不带**此标志，`kb_save` 照常可用。

## 安装

```bash
/home/dev_st/iriswork/tools/anaconda/bin/python -m pip install -r backend/mcp/requirements.txt
```

（装进哪套 Python 无所谓，只要跑本模块时用的是它。想更干净可以给它单开一个 venv。）

## 注册进 Claude Code（工作台仓库零改动）

用**绝对路径**跑 `server.py` 最稳（顶部会自动把仓库根塞进 `sys.path`，从任何 cwd 拉起都能 import）：

```bash
claude mcp add dailyworkbench -- \
  /home/dev_st/iriswork/tools/anaconda/bin/python \
  /home/dev_st/mtools/DailyWorkbench/backend/mcp/server.py
```

然后在 Claude Code 里 `/mcp` 应能看到 `dailyworkbench` 及上面几个工具。撤销：`claude mcp remove dailyworkbench`。

## 配置

复用工作台的 `workbench.local.json`（`kb.vault` / `kb.depositRoot`，经 `backend.core.config.kb()` 解析）——**无需给 MCP 单独配置**。未配置 vault 时，只读工具返回 `{configured: false}`，`kb_save` 返回 `{ok:false,error}`（优雅劣化）。

## 传输 / 上服务

现在是 stdio（`mcp.run()`）。将来要把工作台跑成常驻服务、多端连，把 `server.py::main()` 改成
`mcp.run(transport="streamable-http")` 即可，工具函数一行不用动。
