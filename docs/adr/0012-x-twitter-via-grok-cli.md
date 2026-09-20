# 0012 接入 X/推特资讯源（经 grok-cli 取数引擎，扩 data.json 契约）

- 状态：已接受
- 日期：2026-09-14
- 关联：ADR 0007（取数层外部 CLI + 优雅劣化范式）、ADR 0009（页面触发无头 agent / MCP 隔离）、ADR 0010（依赖极简且可撤回）、ADR 0011（enrich 理解层 + `aiSummary`/`aiTags` 契约）

- 背景：用户希望把 X（推特）上的信息接进工作台，点名评估 [superagent-ai/grok-cli](https://github.com/superagent-ai/grok-cli)。判定：grok-cli **不是**取 X 数据的工具，而是一个用 xAI Grok 的编程 Agent CLI（Bun/TypeScript），内置 `search_x` 工具、底层调 xAI 的 X Search，头less 支持 `--prompt`/`--format json`/`--max-tool-rounds`，鉴权必须 `GROK_API_KEY`（xAI 付费，无免费档）。X 数据其实也可**直连** xAI（老 `search_parameters` 已下线返回 410，现走 Responses API `/v1/responses` + `x_search` 工具）。用户拍板：定时源 + 按需查询**都要**、**坚持用 grok-cli**、但想先看免费/替代（结论：无既免费又可靠的 X 取数路；若求省，直连 xAI 比 grok-cli 更省，拿的是同一份数据）。

- 决策：新增 **X 取数引擎 `backend/clients/grok.py`**（subprocess grok-cli headless、PROMPT 强约束只吐 JSON 数组、容错解析 ndjson 事件流 → 结构化帖子 `{title, summary, url}`），一份引擎喂两个适配：
  - **定时源**：`backend/pipeline/fetch_x.py`（模板＝`fetch_hacker_news.py`），对 `config.x_queries()` 每个查询各检索一次、合并去重 → `x.json`（keep-last-good）；登记进 `local_refresh.STEPS`（`fetch_sspai` 后、`enrich` 前）、`enrich.SOURCES`（shape `items`，自动获得摘要/标签/向量）、`export_data.get_x()`（新顶层键 `x`，滚动 14 天 history）。
  - **按需查询**：`backend/mcp/server.py` 新增只读工具 `x_search(query, limit)`（只读模式下也注册），并把 `mcp__dailyworkbench__x_search` 加进 `agent.py` 的 `READ_ONLY_TOOLS` 白名单 → AI 副驾可自然语言触发「X 上在聊啥」。
  - **配置**：`config.grok_cmd()`（照抄 `opencli_cmd()`）、`config.grok_api_key()`、`config.x_queries()`；填在 `workbench.local.json`（gitignore）。
  - **data.json 契约扩键**：新增顶层 `x`（结构同其它资讯源）——**这是单向门**（本 ADR 即其记录）；前端 `net.js` WBData typedef + `app.js` normalizeData 兜底 + `info.js` 资讯卡 + `infosearch.js` 词面检索 + `index.html` `#xBlock` 同步。

- 理由：完全复用既有「取数层外部 CLI + 优雅劣化」（ADR 0007）与「MCP 隔离只读工具」（ADR 0009）两条缝，X 帖子自动流经 enrich 拿到统一摘要/标签/向量与语义检索（ADR 0011），零新增 App 运行时依赖（grok-cli 只在取数/按需被 subprocess 调用）。引擎抽象在 `grok.py` 一层，日后切直连 xAI x_search 只改该文件，上游与契约不动（守 ADR 0010「可撤回」）。

- 代价 / 护栏 / 何时重估：
  - **依赖红线**：新增 Bun 运行时 + grok-cli（撞「依赖极简」）。护栏：隔离在取数/集成层，未配置（`grokCmd`/`grokApiKey` 缺失）时 X 源**优雅停用**（该源不出现、其余管道与前端照常），App 核心仍不引新依赖、可离线跑。
  - **输出脆弱**：grok-cli 是 Agent，`--format json` 是事件流不是干净帖子数组；结构化靠 PROMPT 强约束 + 容错解析，**非契约级稳定**——真实事件 schema 需按落地时手跑一次校准 `grok.py` 的 `_extract_text`/`_parse_posts`。
  - **成本**：每个 query / 每次 `x_search` ＝ 一轮 Agent（多轮工具），消耗 xAI 付费额度；用 `--max-tool-rounds 3` + `x_queries` 精简 + `PER_QUERY` 上限压。ADR 0007 曾点名登录墙源（Twitter）需单独处理——本路经 xAI，**无需推特登录**，绕开该问题。
  - **密钥红线**：`GROK_API_KEY` 只写 `workbench.local.json`（gitignore），不入库、不进对话、不下放前端。
  - **回滚**：删 `local_refresh.STEPS` 一行 + `enrich.SOURCES`/`export_data` 的 `x` 装配 + `grok.py`/`fetch_x.py` + MCP `x_search` + 前端 `x` 分支 → 回到接入前；`x` 键前端有兜底，删了不崩。
  - **何时重估**：① 若在意成本/求确定 → 把 `grok.py._run()` 换成直连 xAI x_search（Responses API），上游不动；② grok-cli 输出格式变动导致解析频繁失败时优先考虑 ①。

- 修订记录：
  - 2026-09-14：首版，X 源经 grok-cli 接入（定时源 + 按需 MCP 工具）。
