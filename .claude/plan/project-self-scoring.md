# 项目自评打分 · 第二步：真机复验（chrome-devtools MCP）并回填首张卡

> 日期：2026-09-17 16:45　仓：`/home/dev_st/mtools/DailyWorkbench`　性质：实施计划（获批后复制到 `.claude/plan/project-self-scoring.md` 覆盖旧版）
> 前置已完成（同日上午，已落盘）：`docs/guides/项目自评打分-指南.md`（12 节）、`docs/planning/复盘-项目自评打分-2026-09.md`（首张卡，置信带 [27, 35]）、README §4 两行、心法 §7/§8、judgment-practice 指南 §7/§8、dogfood W1 顶部指针。本计划**不重做**这些，只补证据、改数字。

## Context（为什么做）

首张卡打分时后端没在跑、浏览器无已开工作台标签，于是：质量层四维全标「今日未复验」（沿 09-02 证据）；硬门「频率门」未判定；结果层「复用留存」N/A；置信带宽 8 分。用户要求：**用 chrome-devtools MCP 做真机复验**，把能量的量出来，收窄置信带，更新卡。

只读探查确认的运行时事实（本节全部已核实）：
- **后端**未运行（8899 → 000）。启动必须在仓根 `python -m backend.server 8899`（`server.py:30-35` 绝对包导入，不能直跑文件）。健康探针用 `GET /api/inbox/ping`（无 `/api/health`）。
- **调试 Chrome 已死**：`chrome-mcp.service` inactive，19222 无监听，`list_pages` 现报「Could not connect」。MCP wrapper 以 `--browserUrl=http://127.0.0.1:19222` 连接，**每次调用时连**，Chrome 一回来即可用。Profile = `/home/dev_st/桌面/comtools/chrome/profile`（09-01/09-02 两次走查用的就是它）。
- 本用户另有 **18 个进程的日常桌面 Chrome**（无调试参数，MCP 接不上）。其 `~/.config/google-chrome/Default/Local Storage` 里**有** `127.0.0.1:8899` 源的痕迹（strings 命中 4 次），键名因 LevelDB 压缩看不到；anaconda 里无 LevelDB 解析库。
- 前端入口地图（探索代理，均带 file:line）：`switchView(id)` 六个 id = `home info inbox kb distill models`（`js/app.js:220-243`）；dock = `dockOpen/dockClose`（`js/features/convo-dock.js:116-118`，写 `wb_dock_open`，不发网络）；主题 = `toggleTheme()` 三态循环 dark→light→system（`js/app.js:58-64`）；温故只读渲染 `renderRecall()`，**禁**`recallOpen/recallUseful/recallArchive`（`recall.js:174-195` 写 `wb_recall`）。
- **两个只读陷阱**：① `switchView("inbox")` → `_pull()` → `_flush()` 会把 `localStorage.wb_inbox` 里的离线条目 **POST 出去**（`inbox.js:44-78`）——先读 `wb_inbox`，非空就不切该视图、改用 `fetch('/api/inbox')`；② 资讯视图首挂载会 `POST /api/info/search {q:""}`（服务端空 q 短路，只读，`server.py:355-357`），但 `infoSem()` 会调外部 embedding + Zilliz（花钱），**不触发**。
- **禁触**清单：`distillSave/distillRun/kbSave/kbSaveReview/kbSaveChat/inboxAdd/inboxArchive/inboxToDistill/inboxDropItem/refreshData/selfCheck/infoSem/_aiSendNow/agentStream`。
- localStorage **按源分桶**：统一开 `http://127.0.0.1:8899/index.html`（与历史走查同源），不用 `localhost`。
- 网络永不完全 idle（`maybeReload` 30s 轮询 `HEAD data.json`，`kb` 视图下 30s 轮询 tree），所以**不用** `new_page(url)` 直开，也不等网络空闲。

## 执行步骤

### 0 · 拉起运行时（可逆的状态变更，用完不强制回收）
1. 后端：`cd 仓根 && nohup /home/dev_st/iriswork/tools/anaconda/bin/python -m backend.server 8899 > <scratchpad>/backend-8899.log 2>&1 &`（Bash `run_in_background`）。`curl /api/inbox/ping` 确认 `{ok:true}`。stderr 请求行进 scratchpad 日志——顺带成为「本次只有 GET」的可审计证据。
2. 调试 Chrome：`systemctl --user start chrome-mcp.service` → `curl 127.0.0.1:19222/json/version` 有 Browser 字段 → `list_pages` 能列页。**若 `list_pages` 仍连不上**（MCP 进程缓存了旧连接）→ 停下报告，请用户在交互会话 `/mcp` 重连；不自行 kill 任何进程。
3. 开标签：`new_page(url:"about:blank")`（无网络、秒回）→ `select_page` → `evaluate_script(waitForStableDom:false)` 执行 `location.href="http://127.0.0.1:8899/index.html"` → `wait_for` 选择器 `#recallBlock`/`.view.active`（**不等网络空闲**）。兜底：`new_page(url, timeout:8000)` 接受超时错误后 `list_pages` 找到标签继续。
4. 收尾不关后端、不关 Chrome、不关标签（都是用户自己的常驻工具），在报告里给 PID / 日志路径，用户想停自己 `kill <pid>`。

### 1 · 第一条脚本：只读快照（任何视图切换之前）
`evaluate_script(waitForStableDom:false)` 一次拿：`location.origin`、`document.title`、SW 状态、`Object.keys(localStorage)`，并解析：
- `wb_recall` → 每卡 `{box, lastReviewed, archived}`（这是「温故点开」的唯一行为证据）
- `wb_review_*` → **只取日期列表**（不取正文）= 真写过复盘的天数
- `wb_inbox` → 条数（决定能否切收件箱视图）
- `wb_todos / wb_notes / wb_favs / wb_links` → 条数，`favs[].at` 日期
- `wb_ai_history / wb_ai_memory` → 条数 + `ts` 日期（不取文本）
- `wb_tab / wb_theme / wb_dock_open / wb_dock_rect` → 原值（用于收尾还原）
- **只记存在、不读值**：`wb_models_v2 / wb_ai_key_* / wb_gh_token`（明文密钥）
把快照 JSON 存到 `<scratchpad>/ls-snapshot-before.json`（不进仓）。

### 2 · 六视图只读走查（每视图三件事：console error 数 · DOM 证据 · 内联截图）
| 视图 | 驱动 | 取什么证据 |
|---|---|---|
| `home` | `switchView("home")` | `#recallBlock` 是否浮现温故卡、几张、按钮文案；待办/速记/复盘块存在；**不点**卡上按钮 |
| `info` | `switchView("info")` | 分组/条目数、`#infoSearchBar` 存在、「上次同步」陈旧提示是否可见（数据 09-10）；`infoKw("MCP")` 词面过滤有结果 → `infoClear()`；**不碰** `#infoSemInput` |
| `kb` | `switchView("kb")` | `#kbCnt` 篇数、`#kbTree` 节点数、`#kbTree` innerText 是否含 emoji（U1 复验）；`kbSearch("蒸馏")` 只读 |
| `distill` | `switchView("distill")` | `#distillCnt`、卡数（应为 1）、平台/tier 筛选片；`distillOpen(<那张真卡 vaultPath>)` 只读渲染六维正文 |
| `models` | `switchView("models")` | 模型卡数、密钥是否脱敏（innerText 含 `••••` 且不含 `ark-`/`sk-` 明文） |
| `inbox` | **仅当 `wb_inbox` 为空**才 `switchView("inbox")`；否则 `fetch('/api/inbox')` | 空态文案、条数 0 |
| dock | `dockOpen()` → 截图 → `dockClose()` | 渲染、历史条数、宽高；**不发消息** |
| 主题 | 记 `wb_theme` 原值 → `toggleTheme()` 到另一态 → 在 `home`、`kb` 各补一张截图 → 继续 `toggleTheme()` 直到 `localStorage.wb_theme === 原值` | 深浅色可读性（U2/X2 复验） |
截图一律 `take_screenshot` 不传 `filePath`（内联，不落仓）。

### 3 · 网络与服务端证据
- `list_network_requests` → 统计非 2xx / failed；预期只有 GET + 一条 `POST /api/info/search`（空 q 探针）。
- curl（只读 GET）：`/api/inbox/ping`、`/api/kb/deposits?module=蒸馏库`（计数）、`/api/kb/tree`（`files.length`、`configured`）、`/api/models`（**只打印 `configured` 与条数**，不落盘响应体）、`/data.json` 的 `sync` 字段。
- scratchpad 后端日志：`grep -c POST` 应 ≤ 1（那条探针），作为「复验只读」的证据。

### 4 · 还原与自检
- `switchView(<原 wb_tab>)`；`wb_theme`、`wb_dock_open` 已按上表还原；再跑一次步骤 1 脚本存 `ls-snapshot-after.json`，比对 `wb_recall / wb_review_* / wb_inbox / wb_todos / wb_notes / wb_favs` **逐字节一致**（`wb_tab/wb_theme/wb_dock_open` 允许等于原值）。不一致 → 在卡里如实写「复验改动了 X」。

### 5 · 可选：日常 Chrome profile 的使用证据（只读元数据；网络不通就放弃）
- `cp -r ~/.config/google-chrome/Default/"Local Storage"/leveldb <scratchpad>/ls-daily/`（避开运行中 Chrome 的锁）。
- `pip install --target <scratchpad>/pylib ccl_chromium_reader`（纯 Python，含 snappy 解码；**不装进 anaconda**）。失败 → 本步标 N/A。
- 解析 `http://127.0.0.1:8899` 源：**只输出键名与其中的日期**（`wb_review_YYYY-MM-DD` 键列表、`wb_recall` 的 `lastReviewed/box`），不输出任何值文本、不碰 `wb_ai_*`/密钥键。
- 结果用于**频率门**（真实使用天数）与**复用留存**；写进卡时注明来源 profile。

### 6 · 回填首张卡（同一文件原地更新，不新开）
`docs/planning/复盘-项目自评打分-2026-09.md`：
- 头部「取证条件」行 → 改写为复验条件：后端 8899（本次拉起）、调试 Chrome profile、日常 profile 是否读到；**证据范围声明**：localStorage 证据只代表被读到的 profile + `127.0.0.1` 源。
- §1 总分表：重算 G（频率门可能→过/不过）、O 覆盖率（复用留存若有 `wb_recall` 数据即计分）、Q 四维**按指南 §6 锚点重打**（不再「未复验」）、置信带；G 判定后若覆盖率 ≥ 0.5 → 发布点估计。
- §2 频率门行：填 `wb_review_*` 天数 / `favs.at` / `wb_recall.lastReviewed` 等日期证据。
- §3：复用留存行（`wb_recall` box/lastReviewed → 分或仍 N/A）；判断校准行补「复盘天数」；质量层四行的「事后实际 / 证据等级」改为「09-17 真机复验：console X 处、404 Y 处、emoji Z、脱敏 ✓/✗ …」，等级升为「行为记录（09-17 真机）」；技术健壮性行补本次发现的任何报错。
- 新增「复验发现的缺陷清单」小节（只记不修；修代码不在本批范围）。
- §6 复盘补「复验做对/踩坑」；§8 变更记录 `v1.1 · 2026-09-17 · 真机复验回填`。
- 同步改：`docs/README.md` §4 该行末尾的置信带数字；记忆文件 `project-self-scoring.md` 的取证段与 `MEMORY.md` 钩子。
- 不改代码、不进 CHANGELOG、不 commit、不写 judgment-practice `data/*.md`。

## 验证
- 只读性：`grep -c "POST" <scratchpad>/backend-8899.log` ≤ 1；`ls-snapshot-before/after` 非易失键一致；`inbox.local.json` 与 `devmd/_index.jsonl` 的 mtime/行数不变。
- 文档：卡内每个改动格子有「09-17 真机」字样与证据；总分/置信带手算一遍与文中一致；README 行数字与卡一致；6 文件相对链接 `test -e` 全通过。
- 无副作用：`git status` 只出现 `docs/planning/复盘-项目自评打分-2026-09.md`、`docs/README.md`（+ `.claude/plan/project-self-scoring.md`）；`bump_version.py --check` 仍绿。
- 运行时交接：报告后端 PID + 日志路径、Chrome 服务状态、留着的标签。

## 风险与兜底
- MCP 连不上重启后的 Chrome → 停下要用户 `/mcp` 重连（不 kill 进程、不 `pkill -f`）。
- `new_page` 卡住 → `timeout:8000` + `list_pages` 接管。
- `wb_inbox` 非空 → 不切收件箱视图，只 GET。
- 日常 profile 解析库装不上 → 步骤 5 标 N/A，频率门维持「未判定」并说明原因。
- 复验若发现新 bug：只记录进卡与「下一步」，不在本批修。
