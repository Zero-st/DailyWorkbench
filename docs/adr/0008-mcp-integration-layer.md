# 0008 · MCP 集成层：把工作台知识库能力工具化（in-repo `backend/mcp/`，不进 App 运行时）

- 状态：**已接受（Phase 1 落地）**
- 日期：2026-09-09
- 关联：[0001 零构建北极星](0001-zero-build-north-star.md)、[0007 采纳 OpenCLI 作取数层源](0007-opencli-ingestion-source.md)（**同源心法**：重运行时/重依赖关进集成层 + 优雅劣化）、[TECH_CHARTER](../TECH_CHARTER.md)（零依赖红线 + 单向门清单）、[接入deepseekHarness-选型.md](../research/接入deepseekHarness-选型.md)（本决策的评估前身，路径③；**本 ADR 修订其「必须仓库外」结论**）

## 背景

站内「AI 助手」是无工具的哑聊天（`/api/chat` 直转外部 LLM、无 tool-use），跑不了 skill；蒸馏靠「复制指令→人肉贴进 Claude Code→贴回来」搬运。真正能编排工具/skill 的是 harness（Claude Code），工作台只是被**人肉当胶水**。

要让 harness 直接读写工作台的知识库（Obsidian vault + 沉淀库），标准做法是把能力暴露成 **MCP tools**——MCP 是 Claude Code / Codex / OpenCode / dsh 等严肃 harness 都作为 client 说的通用语。

选型评估（`接入deepseekHarness-选型.md`，路径③）当时结论是「MCP server **必须放仓库外**，否则污染零依赖」。**本 ADR 修订该条**：它把两件事混为一谈——「不在 App 运行时」和「不在 repo 里」。二者可分离。

## 决策

**在仓库内新增 `backend/mcp/`**：用 `MCPServer`（`mcp` 2.x）把 `backend.clients.kb` 的纯函数薄封装成 5 个工具（`kb_tree / kb_note / kb_search / kb_deposits` 读 + `kb_save` 写），**直接 `import backend.clients.kb`**（不走 HTTP，同进程调用、无「后端要在跑」依赖），stdio 传输，经 `claude mcp add --scope user` 接进 Claude Code。

**隔离依赖**：`mcp` 只写在 `backend/mcp/requirements.txt`；**App 核心（`backend/server.py` + 前端 SPA）永不 `import backend.mcp`**。已验证：`import backend.server` 不把 `mcp` 拉进 `sys.modules`。故 `git clone` + 双击 `index.html` / `python -m backend.server` 仍**零依赖离线可跑**。

**只读优先、写克制**：只暴露 kb 读 + `kb_save` 写；**不暴露** `/api/chat`（带 key）、`/api/refresh`（起子进程）、模型/收件箱写端点。

## 理由

- **in-repo 严格优于「仓库外孤儿目录」**：跟着 `git clone` 走（可部署 / 可迁移）、`import` 同一份 `kb.py` **永不版本漂移**、与它包的端点同仓演进。选型 doc 当初怕的「污染零依赖」由「不进运行时 + 依赖隔离」解决，与「在不在 repo」无关。
- **同 ADR 0007 心法**：`mcp` 是像 OpenCLI 那样的「集成层重依赖」，关在缝的另一侧、优雅劣化（未配置 vault → 工具返回 `{configured:false}` / `{ok:false}`），够不到 App 北极星。
- **harness 无关、面向未来**：MCP 是通用协议，今天接 Claude Code，明天换 Codex/OpenCode 用同一个 server 不改代码。
- **上服务不返工**：stdio → `transport="streamable-http"` 一个参数切换，工具函数不动。

## 代价（明确承担）

- **引入 `mcp` 依赖（+ pydantic/anyio/httpx/starlette 等传递依赖）**：对「零依赖」洁癖的一次让步——用「不进运行时 + 依赖隔离 + 优雅劣化」把它关在集成层：不装它，工作台照常离线可跑；装它，才多出 agent 能力。
- **装 `mcp` 时升级了共享 anaconda 的 pydantic（2.10→2.13）等**：若同环境有项目钉老 pydantic，宜给 MCP 单开 venv（`backend/mcp/README.md` 已注明）。
- **`mcp` 2.x API（`MCPServer`；v1 的 `FastMCP` 已改名）**：`requirements.txt` 钉 `mcp>=2.2,<3` 防装到 v1（无 `MCPServer`）/ v3 破坏性变更。
- **未触及 `/api/*` 契约、未改 App 核心** → 本 ADR 记录的是**「引依赖」这道单向门**（宪章零依赖红线），不是 `data.json`/契约门。

## 何时重估

- **上常驻服务 / 多端**：把 `main()` 的 stdio 换 `streamable-http`；若 agent 也搬服务端，另评估鉴权/并发（Phase 2）。
- **页面直接驱动 agent（Phase 2）**：后端加 `subprocess claude -p` 触发端点 + `allowedTools` 白名单 + 流式回页面，**另写 ADR**（那才触及 App 运行时 / 可能改契约）。
- **想彻底零依赖**：把 stdio JSON-RPC 手写成 stdlib（去掉 `mcp` 包），代价是自维护协议帧——目前不划算。
- **回退**：`claude mcp remove dailyworkbench` + 删 `backend/mcp/` 即断，工作台无感。
