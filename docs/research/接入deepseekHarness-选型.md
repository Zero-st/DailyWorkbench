# 选型评估 · DailyWorkbench 作为工具接入 deepseekHarness（能不能 / 该不该 / 怎么接）

> 日期：2026-09-08　性质：选型/可行性评估（**仅评估存档，未实施**）
> 关联：`docs/adr/0007-opencli-ingestion-source.md`（同源心法：重运行时工具关进集成层）、`docs/TECH_CHARTER.md`（北极星红线）、`docs/planning/复盘-OpenCLI取数层接入.md`（取数层劣化范式）、外部 `/home/dev_st/mtools/deepseekHarness/`
> 一句话：**能，而且顺**——但正确姿势不是「把工作台塞进 harness」，而是**让 DeepSeek agent 通过工作台早就有的那套本地 API 去调它**；工作台一行不改、北极星不动，胶水代码全落在 harness 侧 / 仓库外。

---

## 1 · 一句话结论

**可行且划算，工作台零改动。** 工作台早已是个本地 REST 服务（`server.py` 监听 `127.0.0.1:8080`），天生能被当「工具」调用；deepseekHarness 是「一切皆插件」的 agent harness，加一个工具就是加一个插件。二者互补：harness 缺「能调工作台的工具」，工作台缺「agent 多步推理 + 工具编排」。把前者补上就通了，**而补的代码在 harness 那边，不进本仓**。

---

## 2 · 为什么能接（两边现状）

### 工作台暴露面 —— 它早就是个「本地 API」
`backend/server.py` 已有一批干净端点，前端本来就靠它们吃饭，天生可被外部当工具调：

| 端点 | 类型 | 干什么 |
|---|---|---|
| `GET /api/kb/search?q=&type=` | 读 | 搜 Obsidian 知识库 |
| `GET /api/kb/note?path=` | 读 | 读单篇笔记全文 |
| `GET /api/kb/tree` · `GET /api/kb/deposits` | 读 | 库树 / 沉淀清单 |
| `GET /api/inbox` · `/api/inbox/ping` | 读 | 捕获收件箱列表 / 计数 |
| `POST /api/inbox/add|update|delete` | 写 | 收件箱增改删（有 Origin 校验） |
| `POST /api/refresh` | 动作 | 后台跑 `local_refresh.py` 重抓资讯、重建 `data.json` |
| `POST /api/chat` | 动作 | AI 聊天代理（**带 API key，不建议暴露**） |
| `GET/POST /api/models` | 读/写 | 模型配置（Supabase / localStorage） |

### deepseekHarness —— 「一切皆插件」的 agent harness
- **是什么**：TS/Node、基于 Cordis 的 agent harness（DeepSeek 模型 + 工具循环）。入口 `apps/cli/`。
- **工具怎么加**：一个工具 = 一个 `tool-*` 包，在 `apply(ctx)` 里 `ctx.tools.register(defineTool({name, description, parameters, execute}))`；装配靠 `apps/cli/config/agent-presets/*/agent.cordis.yml` 加一条 `- name: '@deepseek-ai/dsh-tool-xxx'`。**没有集中式 tools.json**，配置真源是 Cordis 的 `*.cordis.yml`。
- **内置 MCP 客户端**：`packages/mcp/mcp-client/` 支持 `stdio` 和 `streamable-http` 两种 transport，把外部 MCP server 的 tools 自动注册成 `mcp__<server>__<tool>`（Claude Code/Codex 同款命名）。**但只桥接 tools**（Resources/Prompts 未实现），且对端必须说 MCP 协议——普通 REST 不能被它直接消费。

---

## 3 · 方向要说清（核心心法，和接 OpenCLI 同源）

你说的「作为插件整合进 harness」，真实发生的是：

> **工作台 = 被调用方（服务端）；harness = 调用方（客户端）。**

由此推出三条关键性质：

1. **插件/胶水代码写在 harness 侧 / 仓库外，不进工作台仓库** → 工作台**零改动、零新依赖、照样离线单机跑**。
2. 这与 `ADR 0007` 接 OpenCLI **同一个心法**：耦合只发生在**集成层**，不下沉到 App 运行时。上次是「取数层」，这次是「被调用的服务端」——都是把外部重工具（Node/联网）关在缝的另一侧，够不到 App 的北极星。
3. 工作台的 `/api/*` 是它**自家前端本来就在用**的接口，所以接 harness **需要工作台改的代码 = 0**。真正的新代码只有 harness 侧那一层适配器。

> **规律**：接外部 harness，先问「谁调谁」。只要能让自己当**被调用的服务端**、把适配器留在对方那边，你这侧就零成本、可逆、不破北极星。

---

## 4 · 接通后能解锁什么（大白话）

在 DeepSeek agent 里说人话让它干活，例如：

- 「把收件箱今天的东西按主题理一下，重复的合并」 → 它调 `/api/inbox` 拿数据 + 自己推理归并。
- 「知识库里关于『架构护城河』我沉淀过啥，给我串一遍」 → 它调 `/api/kb/search` + `/api/kb/note`。
- 「先刷新资讯，再挑三条值得读的、说清为啥」 → 它调 `/api/refresh`，再读 `data.json`。

这些**单靠工作台自带的 AI 聊天做不到**——harness 给的是**多步骤 + 组合多个工具（你的 KB + 联网 + 文件 + 子 agent）+ 工作流**这套编排能力，这正是「想用上的 harness 能力」。

---

## 5 · 三条接入路径对比

| 路径 | 做法 | 省力度 | 代价 / 局限 |
|---|---|---|---|
| **① bash + curl** | 用 harness 自带 `tool-bash`，让 agent 直接 `curl 127.0.0.1:8080/api/...` | 🟢 **零编码**，10 分钟验证通不通 | 模型自己拼 URL/解析 JSON，体验糙；不适合长期 |
| **② harness 内写 `tool-dailyworkbench`** | 照抄 `packages/shell/tool-bash` 骨架，为各端点各写一个 `defineTool`，`execute` 里 `fetch()` 调本地 API | 🟡 语义清晰、**体验最好** | 要写 TS；**绑死 deepseekHarness 这套小众/年轻的插件 API**，别的宿主不能复用 |
| **③ 独立 MCP server** | 把这几个端点包成一个 MCP server（stdio 或 http），**放工作台仓库之外**；harness 配置加一条 `mcp-client` 即连上 | 🟡 **最标准 · 可复用**（Claude Code 等 MCP 宿主也能用同一个 server） | 多跑一个进程、多一层协议；MCP server 自带 Node/Python-SDK 依赖，**必须放仓库外**，否则污染工作台零依赖 |

---

## 6 · 建议

- **只想先尝甜头 / 验证价值** → 走 **①**（今天就能试，零成本）。
- **想长期用，且希望这套封装 Claude Code 也能复用**（你天天用 CC）→ 走 **③**（一次封装，到处接）。这是长期最优。
- **②** 只在「只服务 deepseekHarness 一家」时才划算——把力气押在小众框架的私有 API 上，**不推荐**。

> 决策顺序建议：先 ① 花 10 分钟确认「agent 调工作台确实有用」，觉得值 → 直接跳到 ③（跳过 ②，别在私有插件 API 上沉没成本）。

---

## 7 · 坑位清单（真接的时候看）

- **别暴露 `/api/chat`**：它带你的 API key 做代理，暴露成工具没必要，还多一个泄漏面。
- **`/api/refresh` 是「动作类」**：会起子进程重抓，接的时候给它**单独确认 / 门禁**，别让 agent 随手狂刷。
- **写端点的 Origin 放行**：`server.py._origin_ok()` 对**无 Origin 头**的请求（curl / 本地脚本 / MCP 子进程）一律放行——意味着本地工具**能写** inbox。正因为能写，动作类工具要审慎（只读端点随便接，写/动作端点要克制）。
- **联网 + Node 是 harness 的性质，不是工作台的**：harness 要调 DeepSeek API（联网）、要 Node 运行时；这些负担全在 harness 侧。工作台**该离线单机还能离线单机**，接不接 harness 都不变。

---

## 8 · 状态 & 何时重估

- **状态**：~~仅评估存档，未实施~~ → **2026-09-09 路径③已落地**（Claude Code 变体，见 [ADR 0008](../adr/0008-mcp-integration-layer.md) + `backend/mcp/`）。
- **⚠️ 结论修订（ADR 0008）**：原文多处「MCP server **必须放仓库外**」（§5-③、§6、下方「走 ③」）**已推翻**——落地采 **in-repo `backend/mcp/` + 直接 `import kb`**，严格更优：跟 `git clone` 走（可部署/迁移）、`import` 同一份 `kb.py` 永不漂移、`mcp` 依赖隔离在子目录仍守零依赖。当初把「不进 App 运行时」与「不在 repo 里」混为一谈。
- **何时动手**：用户决定走哪条路径时，**另开 plan 执行**——
  - 走 ③（MCP server）：新起一个仓库外小项目，把 §2 只读端点包成 MCP tools，动作端点加门禁；harness 侧 `agent.cordis.yml` 加一条 `mcp-client`。**这不触及工作台代码，故不需要工作台侧 ADR**（除非顺带改了 `/api/*` 契约）。
  - 走 ②：需评估是否值得绑定 deepseekHarness 私有插件 API。
- **回退成本**：≈0。工作台侧本就没改；撤掉 harness 侧那条配置 / 那个 server 即断开，工作台无感。
