# 0009 · 页面驱动 agent：后端 subprocess 拉起无头 `claude -p` + SSE 流式回页面（只读白名单）

- 状态：**已接受（Phase 2 落地）**
- 日期：2026-09-09
- 关联：[0008 MCP 集成层](0008-mcp-integration-layer.md)（**本 ADR 是其「何时重估·Phase 2」的兑现**）、[0007 OpenCLI 取数层](0007-opencli-ingestion-source.md)（同源心法：重运行时工具经 subprocess 关在集成层 + 优雅劣化）、[0001 零构建北极星](0001-zero-build-north-star.md)、[TECH_CHARTER](../TECH_CHARTER.md)、`.claude/plan/agent-mcp-sidecar.md`（路线图 + 落地记录）

## 背景

Phase 1（ADR 0008）把知识库能力工具化成 MCP，但**入口只在终端**：蒸馏靠 `distill.js` 的「复制指令→贴进 Claude Code→跑→贴回来→保存」人肉接力，站内 `ai.js` 还主动拦截 agent 式指令、把人赶去 Claude Code。**页面里没有任何驱动 agent 的路子**。

心法（把「谁调谁」拆两轴，承 Phase 1）：**编排权归 harness、入口归页面、中间 MCP 打通**。Phase 2 补「页面入口」——在零依赖 SPA 里**不重造 agent loop**，而是让后端 subprocess 拉起无头 `claude -p`（真正的编排在 harness），把过程流式送回页面。

## 决策

**后端加 `POST /api/agent`（流式 SSE）**：`backend/clients/agent.py` 用 `subprocess.Popen` 拉起 `claude -p --output-format stream-json`，逐行解析事件、映射成精简 SSE（`meta/text/tool/result/error`）经 `self.wfile` 逐块 `flush()` 回页面（`ThreadingHTTPServer` 每请求独立线程，天然支持长连接流；dispatch 核心零改）。前端 `js/core/agent-stream.js`（本仓首个流式消费者，`fetch`+`getReader`）作脊柱，两个入口复用：蒸馏库「▶ 直接蒸馏」、AI 助手「带工具」模式。

**零依赖守护**：subprocess 拉 `claude` 二进制，**不引任何 Python 第三方依赖**（同 `local_refresh.py` / `opencli_cmd` 范式）。`claude` 未配置（`config.claude_cmd()==None`）→ agent 层产出 `error(configured:false)`、页面显示「未配置」，App 仍零依赖离线可跑；「复制指令」离线退路保留。

**安全边界（纵深，每层真机验证）**：页面触发的 agent 白名单 = 4 个只读 kb 工具 + WebFetch；**写库永远走人工闸**（前端渲染起草卡 → 人点「保存」→ 现成 `/api/kb/save`）。具体：

- `--restricted`：移除 Bash/REPL 等跑代码工具，**且无视 user/project/local 设置**（本机 ambient 已放行 Bash，只有它能压住）。
- `--tools "<只读集>"`：收窄「可用工具集」（WebFetch 在 restricted 下须显式点名才留）。
- **MCP server 以 `--read-only` 拉起**：`backend/mcp/server.py` 只读模式**不注册 `kb_save`** → 写工具在协议层就不存在（`--tools`/`--allowedTools` 点名管不住 MCP server 暴露的工具集，唯有让它不存在才硬）。
- `--strict-mcp-config --mcp-config '<内联 dailyworkbench>'`：只挂我们这一个 server，与用户其余（含未授权 claude.ai 连接器）隔离，不依赖 Phase 1 的 user-scope 注册。
- `--permission-prompts none`：凡还会弹窗的一律自动拒。
- `_guard_origin()`：起子进程的动作端点照收件箱写端点加来源门（无 Origin 的本地请求仍放行）。

**成本/兜底**：`--model`（默认 `sonnet`，可配；避免 CLI 默认吃 opus 让路由级蒸馏太贵）+ `--max-budget-usd` + 后端墙钟看门狗杀进程（CLI **无** `--max-turns`/`--timeout`，已核实）。

**未改 `data.json` 契约、未改 `/api/*` 现有端点**——只新增端点 + 前端视图。

## 理由

- **不砸北极星**：subprocess 拉二进制 = 零新依赖；SSE 全 stdlib（`Popen`+`wfile.flush`）；重工具（claude：Node/联网/鉴权）关在集成层、优雅劣化，够不到 App 核心。选 subprocess 而非 Agent SDK 正为躲开 `claude-agent-sdk` 这个 Python 依赖。
- **编排在 harness**：多步 / 抓取 / 调 MCP / 子 agent 全归 `claude`，SPA 只当「入口 + 进度视图」，不背 agent-loop 维护债。
- **写库留人手**：页面一键触发的 agent 若能自动写用户真实 Obsidian vault，风险面过大；「只读 agent 起草 + 人点保存」把写权收在人手，且复用现成 `kbSave` 全链路。
- **面向未来**：`stream-json` 事件解析层 harness 无关；上服务把 `main()` 的 stdio 之外，用 `--mcp-config` 自带配置也让「页面触发的 agent」不绑 Phase 1 注册。

## 代价（明确承担）

- **App 运行时现在能拉起一个 LLM agent 子进程**——一道能力单向门（但**不引新依赖、不改契约**，故非零依赖红线/`data.json` 门；是「运行时职责」的扩张）。撤销成本≈0：删端点 + `agent-stream.js` + 两处按钮即回到 Phase 1。
- **依赖外部 `claude` 二进制 + 鉴权 + 联网**：不具备则该功能不可用（优雅劣化为「未配置」），不影响其余。
- **每次运行有 API 成本**（sonnet 分钱级；缓存工具定义约 4 万 token 是主要成本项，可后续优化）。
- **安全配置对 CLI 版本敏感**（本机 claude 2.1.265 核实）。**尤其记死两个真机排出的坑，勿「简化」**：
  1. `--permission-mode dontAsk` 语义是**「别问·直接放行」**（不是「拒绝非白名单」）——单用它 Bash 会真跑。靠 `--restricted` + `--tools` + `--permission-prompts none` 才收窄。
  2. `--allowedTools`/`--tools` 点名**管不住 MCP server 暴露的工具**（`kb_save` 仍可用）——必须让 MCP server 只读模式**不注册**写工具。
  落地前应 `claude -p --help` 复核标志名（探查阶段有 `--max-turns`/`--timeout` 等疑似不存在项）。

## 何时重估

- **给页面触发的 agent 开任何写/动作能力**（自动落库、跑刷新等）：**必须重审人工闸**，另记 ADR；当前刻意只读。
- **上常驻服务 / 多端**：stdio 无碍（subprocess 每次拉起），但需评估并发、鉴权、成本配额。
- **Phase 3 · `distill` skill**：把六维 craft（现在 `js/core/distill-template.js`）收成 CC skill，页面与 agent 共用同一真源，避免 JS/Python 双份。
- **回退**：删 `/api/agent` handler + `backend/clients/agent.py` + `js/core/agent-stream.js` + 两处入口按钮即断；`backend/mcp/server.py` 的 `--read-only` 开关对 Phase 1 无副作用（终端注册那路不带此标志，`kb_save` 照常）。
