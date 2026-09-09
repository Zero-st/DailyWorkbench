# 工作台 × Agent 集成 · Phase 1 已落地（`backend/mcp/` MCP 工具层）

> 日期：2026-09-09　性质：实施计划 + 落地记录
> 决策与理由的**单一真源** = [ADR 0008](../../docs/adr/0008-mcp-integration-layer.md)（本文不重复，只留形状 + 进度 + 路线图）
> 关联：[接入deepseekHarness-选型.md](../../docs/research/接入deepseekHarness-选型.md)（评估前身，路径③；其「仓库外」结论已由 ADR 0008 修订）、ADR 0007（同源心法）

## 缘起（一句话）
站内 AI 助手是没工具的哑聊天，跑不了 skill；蒸馏靠人肉在工作台↔Claude Code 之间搬运。**心法：编排权归 harness、入口归页面、中间 MCP 打通**（别在零依赖 SPA 里重造 agent loop）。

## 三层架构（终态；本次落工具层）
```
入口层   [页面按钮·主路(Phase 2)]      [终端 Claude Code·顺手(Phase 1 起即用)]
编排层   无头 harness（claude -p / Agent SDK）：多步·抓取 skill·WebFetch·子 agent
工具层   backend/mcp/（MCPServer，import backend.clients.kb）   ← ✅ 本次已落地
数据层   backend/clients/kb.py（零改动·单一真源） + workbench.local.json 配置
```

## ✅ Phase 1（已实施 2026-09-09）
- **新增**（全在集成层，App 核心不引用）：`backend/mcp/{__init__,__main__,server}.py` + `requirements.txt`（`mcp>=2.2,<3`）+ `README.md`；`docs/adr/0008-mcp-integration-layer.md`。
- **工具**（薄封装 `kb.py` 纯函数；harness 侧 `mcp__dailyworkbench__*`）：`kb_tree` / `kb_note` / `kb_search` / `kb_deposits`（读）+ `kb_save`（写）。
- **打包 = A（项目内模块 + import kb）**：`import backend.clients.kb` 直接同进程调用；`server.py` 顶部把仓库根塞进 `sys.path`，绝对路径拉起无视 cwd。
- **零依赖守护**：`mcp` 只在 `backend/mcp/requirements.txt`；核心零引用、`import backend.server` 不加载 `mcp`（已验证）。
- **配置零新增**：复用 `workbench.local.json`（`config.kb()`）；未配置 vault → 工具优雅返回 `{configured:false}`/`{ok:false}`。
- **注册**：`claude mcp add dailyworkbench --scope user -- <anaconda-python> <abs>/backend/mcp/server.py`（写 `~/.claude.json`，仓库零改动）。
- **验证**：`list_tools` 5 工具 schema OK；`call_tool` 写【MCP测试】卡→`kb_deposits` 命中 tier=S→删卡；`kb_tree`=303/`kb_search`=50；`claude mcp list` **✔ Connected**；零依赖回归绿。
- **踩坑记录**：装到的是 **mcp 2.x**（`FastMCP` 已改名 `MCPServer`、`list_tools/call_tool` 是协程、`run` 同步）；装 `mcp` 顺带升级共享 anaconda 的 pydantic 2.10→2.13（同环境有钉老 pydantic 的项目宜给 MCP 单开 venv）。

## Phase 1 即时价值
CC 里「蒸馏 `<url>`」→ 抓取+六维 → 直接 `kb_save` 落库，**不用把产出粘回页面**（人肉搬运少一趟）。前端「复制指令」保留作离线退路。

## 路线图
- **Phase 2 · 页面入口（主路）** —— ✅ **已落地 2026-09-09**：`POST /api/agent`（`subprocess claude -p` + SSE 流式）+ `backend/clients/agent.py` + 前端脊柱 `js/core/agent-stream.js` + 两入口（蒸馏「▶ 直接蒸馏」、AI 助手「带工具」）。只读白名单 + 写库人工闸。决策/理由/踩坑单一真源 = [ADR 0009](../../docs/adr/0009-page-driven-agent.md)；实施记录见 [page-driven-agent.md](page-driven-agent.md)。
- **Phase 3 · `distill` skill**（未做）：六维 craft（现在 `js/core/distill-template.js`）收成 CC skill，避免 Python 复刻漂移。
- **上服务**（未做）：`main()` 的 stdio 换 `transport="streamable-http"`，工具函数不动。

## 回退 ≈ 0
`claude mcp remove dailyworkbench` + 删 `backend/mcp/` 即断，工作台无感。
