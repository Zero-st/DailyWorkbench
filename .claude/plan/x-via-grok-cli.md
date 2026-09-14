# grok-cli 接入工作台：X/推特资讯源 + 按需查询

## Context（为什么做、要什么）

用户想把 X/推特上的信息接进 DailyWorkbench，并点名评估
[superagent-ai/grok-cli](https://github.com/superagent-ai/grok-cli)。

**对 grok-cli 的判定**：它**不是**"取 X 数据的工具"，而是一个用 xAI Grok 的
**编程 Agent CLI**（Bun/TypeScript，类似 Claude Code）。它内置 `search_x` 工具，
底层调 xAI 的 X Search。头less 可用：`--prompt/-p`、`--format json`（ndjson 事件流）、
`--max-tool-rounds N`、`--batch-api`。安装：`curl … install.sh | bash` 或 `bun add -g grok-dev`。
鉴权：必须 `GROK_API_KEY`（xAI 付费）。MCP 方面它是 **host（消费方）**，不是可被别人调用的 server。

**用户已拍板**：定时源 + 按需查询**都要**；**坚持用 grok-cli**；但**想先看免费/替代方案**。

**硬约束（必须先摆明）**：grok-cli 跑不起来就**必须** `GROK_API_KEY`，
**没有免费档能用 `search_x`**。所以"用 grok-cli"与"免费"无法同时满足——
下文 §1 给出替代/免费方案对比，§2+ 给出 grok-cli 落地方案（**无 key 时优雅降级、可先并脚手架**）。

契合度前提（探查确认）：本仓工程红线＝**依赖极简·离线可跑·零构建**（TECH_CHARTER / ADR 0010）；
App 核心 **Python 纯标准库**；重工具（OpenCLI/Claude CLI/Zilliz）一律**隔离在取数层/集成层 + 优雅降级**。
grok-cli 属"取数层/集成层外部 CLI"，正好复用 OpenCLI（ADR 0007）与 Claude CLI（ADR 0009）两条既有缝。

---

## §1 免费 / 替代方案对比（回答"先看免费"）

> 结论先行：**没有既免费又可靠的 X 取数路**。若在意成本，**直连 xAI x_search（跳过 grok-cli 的 Bun+Agent 开销）比 grok-cli 更省**，拿的是同一份数据。价格均需上官网核实当期值（下列为估量，勿当准数）。

| 方案 | 免费? | 登录墙 | 可靠性 | 合规 | 备注 |
|---|---|---|---|---|---|
| **xAI x_search 直连**（Responses API `/v1/responses`，`sources:["x"]`） | 否，按次计费（约每源几美分） | **无需推特登录** | 高（官方） | 好 | 老 `search_parameters` 已下线(410)，现走 Responses API x_search 工具 |
| **grok-cli**（本次要做） | 否，同样吃 `GROK_API_KEY` | 无需推特登录 | 中（Agent 输出需解析） | 好 | = xAI x_search + Bun 运行时 + Agent 开销 |
| 官方 X API v2 free | 名义免费但**读几乎为 0**（月读上限极低） | 需 App key | 高 | 好 | Basic 档约 $200/mo 起，成本高 |
| RSSHub / rss-bridge 的 Twitter 路由 | 免费 | **需登录 cookie/token** | 低（频繁失效） | 灰 | ADR 0007 已点名登录墙源要单独立 ADR |
| Nitter | 免费 | — | 极低（基本停摆） | 灰 | 不建议 |
| 直接爬 X | 免费 | 登录墙 | 低脆弱 | **违反 ToS** | 不做 |

**给用户的建议**：grok-cli 按你要求照做；但方案在 `backend/clients/grok.py` 这层做**引擎抽象**，
把"调 grok-cli"隔离成一个可替换函数——**日后若想省钱，切到直连 xAI x_search 只改这一个文件**，
上游 `fetch_x.py` / MCP 工具 / `data.json` 契约全不动（低成本可逆，守 charter"可撤回"）。

---

## §2 架构：一份引擎、两个适配（满足"两者都要"）

```
backend/clients/grok.py         ← 唯一引擎：subprocess grok-cli，解析 ndjson，产出结构化 X 帖子列表
        │
        ├── backend/pipeline/fetch_x.py   ← 定时源：调引擎 → 统一 item → x.json（keep-last-good）
        │        └→ 进 local_refresh / enrich / export_data → data.json 新键 x → 前端卡片 + 语义检索
        │
        └── backend/mcp/server.py:x_search()  ← 按需：AI 副驾里问"X 上在聊啥"时实时调引擎
```

**为何这样切**：`fetch_x.py`（定时）与 MCP 工具（按需）共用同一解析逻辑，避免两处维护 grok-cli 输出解析；
引擎函数纯输入输出，便于单测（用抓下来的样例 ndjson 离线测），也便于日后换直连 xAI。

---

## §3 实现改动（按执行顺序，贴现有 idiom）

### 3.1 引擎：`backend/clients/grok.py`（新建）
- 参照 `backend/clients/agent.py` 的 subprocess 驱动 + `fetch_hacker_news.py` 的退出码/JSON 解析范式。
- 函数 `search_x(query, *, limit=20, since=None) -> list[dict]`：
  - 命令 `argv = [*wb_config.grok_cmd(), "--prompt", PROMPT, "--format", "json", "--max-tool-rounds", "3"]`；
    `env` 注入 `GROK_API_KEY=wb_config.grok_api_key()`；`subprocess.run(..., timeout=…, encoding="utf-8", errors="replace")`。
  - **PROMPT 强约束输出**：指令 grok "用 search_x 搜 `<query>`，只返回 JSON 数组，每项 {title,url,summary}，不要多余文字"。
    解析：逐行 `json.loads` 事件流，取最终 assistant message，从中提取 JSON 数组；解析失败/空 → 抛异常。
  - `grok_cmd() 返回 None`（未配置）或 `grok_api_key()` 为空 → 抛 `RuntimeError`（上游据此优雅跳过）。
- **风险点（务必标注在代码注释）**：grok-cli 是 Agent，`--format json` 是**事件流不是干净帖子数组**，
  PROMPT 强约束 + 容错解析是本方案最脆的一环；这也是"直连 xAI 更确定"的根因。

### 3.2 配置：`backend/core/config.py`（+ `workbench.local.json.example`）
- 新增 `grok_cmd()`：**照抄 `opencli_cmd()`**（env `WB_GROK_CMD` > local.json `grokCmd` > PATH `grok`；返回 argv 或 None）。
- 新增 `grok_api_key()`：env `GROK_API_KEY` > local.json `grokApiKey` > `""`（**红线：只在 gitignored 的 local.json，绝不入库/不推前端**）。
- 可选 `x_queries()`：定时源要跟踪的关键词/查询列表（放 local.json `x.queries`），缺省给 1~2 个示例词。
- `workbench.local.json.example` 补 `grokCmd` / `grokApiKey` / `x.queries` 三个占位 + 注释。

### 3.3 定时源：`backend/pipeline/fetch_x.py`（新建，模板＝`fetch_hacker_news.py`）
- `OUT = X_JSON`；`build()` 调 `grok.search_x()` → 映射统一 item `{title, summary, url, source:"X"}`；
  `main()` 失败**不覆盖**旧 `x.json`（keep-last-good），print `[WARN]/[OK]` 同风格。
- 输出信封 `{date, fetchedAt, source:"X (via grok-cli)", canonical:"https://x.com/", count, items[], warnings[]}`。

### 3.4 路径 & 三处清单登记
- `backend/core/paths.py`：加 `X_JSON`（钉仓库根 `x.json`）。
- `backend/pipeline/local_refresh.py`：`STEPS` 里在 `fetch_sspai` 后、`enrich` 前插 `fetch_x`。
- `backend/pipeline/enrich.py`：`SOURCES` 加 `x.json`（shape `"items"` 扁平）——自动获得 AI 摘要/标签/向量。
- `backend/pipeline/export_data.py`：加 `get_x()` + `main()` 装配，新顶层键 `x`，滚动 14 天 `history`。

### 3.5 按需查询：`backend/mcp/server.py`
- 加 `@mcp.tool()` `x_search(query, limit=20)`，内部调 `backend/clients/grok.py` 的 `search_x`，返回结构化帖子。
- 属**读工具**（无副作用），read-only 模式下**照常注册**（与 `kb_save` 的写工具区分）。
- 副驾（Claude CLI，ADR 0009）已挂 `mcp__dailyworkbench__*`，加此工具后可直接被"问 X 上在聊啥"触发；
  副驾前端 dock（`ai.js`）如需一个显式入口按钮再议，非必需（工具已可被自然语言触发）。

### 3.6 前端契约（`data.json` 是单向门）
- `js/core/net.js`：`WBData` typedef 加 `x` 键。
- `app.js`：`normalizeData` 加 `x` 的兜底（缺失回退空），并像 PH/HN 一样渲染一张资讯卡。
- **复用现成资讯卡类**（沿用现成类的小改，按界面准则**无需**先出效果图）；只用 token 变量、图标内联 SVG。
- 改了 `js/`/`app.js`/`css`/`index.html` 任何资产 → **跑 `python bump_version.py`**（CI `--check` 会红）。

### 3.7 决策记录：`docs/adr/0012-x-twitter-via-grok-cli.md`（新建，**必须**）
- 触发两条单向门：① `data.json` 新增 `x` 键（契约变更）；② 新增外部 CLI 依赖 grok-cli + Bun 运行时。
- 按本仓 ADR 模板：状态/日期/关联、背景、决策、理由、**代价**（Bun 依赖、Agent 输出脆弱、xAI 付费）、
  **何时重估**（→ 迁直连 xAI x_search 的触发条件）、修订记录。关联 ADR 0007（登录墙源）/0009/0010/0011。

---

## §4 验证（最小测试先行，省 token；见记忆 minimal-test-first-workflow）

按"静态门 → 纯逻辑 → 单点接口 → 小样 → 全量"逐级放行：

1. **静态门**：`python check_design_tokens.py`（动了前端）；`python bump_version.py`；
   JS 语法用 `import()` 区分 SyntaxError（记忆 js-syntax-gate，勿信 `node --check` 假阴性）；`pytest test_workbench.py`。
2. **纯逻辑**（无网）：抓一份真实 grok-cli ndjson 样例存 fixture，单测 `grok.search_x` 的解析 → 统一 item。
3. **单点接口**（需 key）：手跑一次 `grok --prompt "search_x …" --format json` 看真实输出形状，校准 PROMPT/解析。
4. **小样**：`python -m backend.pipeline.fetch_x` 单跑一个 query，验证 `x.json` 结构 + keep-last-good（断网/清 key 再跑，旧文件不被覆盖）。
5. **全量**：`python -m backend.pipeline.local_refresh` 端到端 → `data.json` 有 `x` 键且 enrich 出摘要/标签 →
   前端卡片渲染 → `POST /api/info/search` 语义检索能命中 X 条目。
6. **按需路**：`python -m backend.mcp` 起 server，调 `x_search` 工具验证返回；再在副驾里自然语言触发一次。

**无 key 时的验收**：1、2 全绿即可先合入脚手架；3~6 中依赖 key 的部分在 grok_cmd/grok_api_key 缺失时应**优雅跳过**
（该源不出现、其余管道不受影响），拿到 key 后再点亮。

---

## §5 风险与代价（诚实清单）
- **依赖红线**：新增 Bun 运行时 + grok-cli，撞"依赖极简"。缓解：隔离在取数/集成层、优雅降级、写 ADR 记代价。
- **输出脆弱**：grok-cli 是 Agent，结构化 X 帖子靠 PROMPT 强约束 + 容错解析，非契约级稳定。
- **成本**：每次取数/查询＝一轮 Agent（多轮工具），比直连 xAI x_search 贵；用 `--max-tool-rounds`/`--batch-api` 压。
- **可逆退路**：引擎抽象在 `grok.py` 一层——想省钱/求稳可**只改该文件**切直连 xAI x_search，上游不动。
