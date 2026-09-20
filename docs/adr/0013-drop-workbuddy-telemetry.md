# 0013 切除本机 WorkBuddy 遥测数据线（data.json 契约收窄 17 键 → 9 键）

- 状态：已接受
- 日期：2026-09-20
- 关联：ADR 0007（取数层 + 优雅劣化范式）、ADR 0011 / 0012（此前两次**扩**契约，同为单向门）；本 ADR 是第一次**收窄**契约。上游 IA 决策见 CHANGELOG `[0.7.0]`（13 视图→9）与 `[0.9.0]`（PC-first 收敛，删下架视图）。

- 背景：`data.json` 原有 17 个顶层键，其中 8 个来自 `export_data.py` 对本机 **WorkBuddy** 及本机环境的遥测采集（`kpi` `skills` `sessions` `knowledge` `weekly` `status` `guide` `quickActions`）。四条事实叠在一起，说明这条线已经彻底空转：

  1. **源头是断的**。`export_data.py:31` 写死 `os.path.expanduser(r"~\.workbuddy")`——Windows 反斜杠写法，在 Linux 上 `expanduser` 连 `~` 都不展开，返回字面量 `'~\.workbuddy'`（一个相对路径）。而 `~/.workbuddy` 与 `wb_config.workspace()` 的默认值在本机本就都不存在。
  2. **数据全空**。`kpi` 六项全 0、`skills`/`weekly` 为 `[]`、`sessions` 空、`status.{automations,models,localModels,mcp}` 全空。真实值最后一次出现在 2026-08-26 的 upstream 快照（skills 20），自 `b99d911`（09-10）起即全零。用户已不再使用 WorkBuddy。
  3. **消费者早已删光**。这 8 个键原来喂的是 `ov`（系统状态）、`cap`（能力速达）、`sess`（动态）、`stats`（Skill 统计）、`week`（本周动态）五个视图，分别于 `28cd805`（IA 重构 13→9）与 `c7b14ad`（PC-first 收敛 v0.9.0）删除。**删视图时没有顺手删数据线**，于是它空转至今。前端只剩 `dash.js` 读 `sessions.recent`（恒空，永远显示「今天还没有会话记录」），以及 `app.js` 读两个时间戳——而这两个时间戳由 `export_data.py:543,549` **无条件**写成 `now`，与是否抓到数据无关，页脚因此永远显示「skills 数据 今天 · 记忆库 今天」，是**假新鲜度**。
  4. **它不是惰性代码，是地雷**。8 个 WorkBuddy getter 缺数据时静默返回空壳，且**不回读上一版 data.json**（与 7 个资讯源走 `feeds.merge_history` 的 keep-last-good 相反），而 `main()` 每次都原子覆盖整个 `data.json`。因此在任何没有 WorkBuddy 的机器上跑一次 `export_data`，就会把这 8 个键用空值硬覆盖——[`复盘-OpenCLI取数层接入.md`](../planning/复盘-OpenCLI取数层接入.md) §「本机无 `~/.workbuddy`」早有记载。这些 getter **零测试覆盖**。

- 决策：**删除整条本机遥测数据线，并把 `data.json` 契约收窄为 9 个顶层键。**
  - **契约**（单向门，本 ADR 即其记录）：删 `kpi` `skills` `sessions` `knowledge` `weekly` `status` `guide` `quickActions` 八键。保留 `generatedAt`（快照戳 + 前端刷新轮询判据）、`sync`（由 `sync_status.py` 事后补写）、以及 7 个资讯源键。
  - **后端**：`export_data.py` 584 → 97 行，删 13 个采集函数（`fm` `get_skills` `get_automations` `get_models` `get_local_models` `get_ollama_models` `memory_count` `get_sessions` `get_knowledge` `get_disk` `get_weekly_changes` `_probe_mcp_url` `get_mcp`）与全部 WorkBuddy 路径常量；模块职责收窄为「聚合 7 个资讯源并原子写出」。`config.py` 删随之成为孤儿的 `workspace()` / `ollama_exe()` / `disks()`（已验证只被 `export_data.py` 调用）及 `IS_WIN`；`workbench.local.json.example` 删对应三个键。
  - **前端**：`normalizeData` 删 8 组兜底；删 `renderFreshness` 整个函数与页脚 `#freshness`（假新鲜度）；删 `dash.js` 的 `revSessions` 块与 `index.html` 的「📌 今日完成」整块；`net.js` 的 `WBData` typedef 收窄到 9 条；删随宿主 DOM 失效的 `.rev-h`/`.rev-list` 共 7 条 CSS 规则。
  - **一并修正用户可见文案**：`js/core/feeds.js` 两处空状态原本写「也可以让 WorkBuddy 手动跑 `fetch_ai_daily.py`」，改为真实可用的 `python -m backend.pipeline.fetch_ai_daily`。

- 理由：删掉的不是「暂时没人用的功能」，而是**一个恒为空、且会主动污染真数据的写入通道**，外加一处持续对用户说谎的 UI。保留它的成本是真实的（每次 export 的覆盖风险、13 个零测试函数的维护面、契约里 8 个误导后人的字段），收益为零。契约收窄后 `data.json` 的每一个键都有活的消费者，这正是「接口就是测试面」要的形状。

- 代价 / 护栏 / 何时重估：
  - **单向门**：已发布的 `data.json` 形状回不去——老版本前端（或缓存住的 GitHub Pages 页面）读新 `data.json` 会拿不到这 8 个键。护栏：这 8 个键在前端**已无渲染代码**，`normalizeData` 此前的兜底只是防白屏，删键不会崩；且 `bump_version.py` 会换 SW CACHE 戳，客户端拿到的是配套的新前端。
  - **代码可逆**：实现全在 git 里（本次改动前的完整版见本 ADR 之前的 `export_data.py`），真要恢复 `git revert` 即可，属双向门。**不可逆的只有契约**。
  - **何时重估**：若将来要在工作台展示「本机/agent 使用遥测」（例如 Claude Code 的 session、已装 skill 统计），**不要复活这条线**——它的形状是围绕 WorkBuddy 的目录与 sqlite 表设计的。正确做法是先想清楚消费视图，再按 ADR 0007 的「取数层 + 优雅劣化 + keep-last-good」范式重新接一条，并为新键单独写 ADR。
  - **顺带未清**：`css/styles.css` 里 `.kpi*` 一批规则自 `[0.7.0]` 删 KPI 指标条起就是死 CSS，本次未动（与本 ADR 无因果，留给后续样式清理）；`backend/utils/common.py` 的 `User-Agent: workbuddy-sync` 仅为字符串，未改。

- 被否方案：
  - **保留 8 个键、只删采集实现（写死空壳常量）**：不用动契约、零前端风险。否掉的理由是这只是把死字段从「空转」改成「明写的空」，契约里仍留 8 个误导后人的键，而真正的风险（覆盖真数据）虽消除、维护面却没减多少。
  - **保留采集、加配置开关默认关闭**：适合「将来可能换回 WorkBuddy」。否掉的理由是用户已明确不再使用，且即便将来要做遥测也不会是 WorkBuddy 的形状（见「何时重估」），留着等于养一份永远不会被验证的代码。

- 修订记录：
  - 2026-09-20：首版，切除本机遥测数据线，`data.json` 契约 17 键 → 9 键。
