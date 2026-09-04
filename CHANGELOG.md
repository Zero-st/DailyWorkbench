# 更新日志 Changelog

本项目所有值得记录的改动都写在这里。

- 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
- 版本号遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/)；
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)。
- **本文件只记「做了什么」（简）**；「为什么这么做、代价与取舍」（详）见对应 `docs/` 设计文档与 `docs/adr/`；方向见 `docs/planning/知识飞轮-路线图.md`。规则见 [`docs/版本管理规范.md`](docs/版本管理规范.md)。

版本语义（本项目，无对外 API）：**MAJOR**=北极星/架构级变化或破坏用户数据·URL｜**MINOR**=新模块/新能力｜**PATCH**=修 bug/小优化。`0.x` 表示仍在演进、未冻结。

---

## [Unreleased] · 下个版本目标

> 详见 [`docs/planning/知识飞轮-路线图.md`](docs/planning/知识飞轮-路线图.md)。当前方向：**先把"蒸馏闭环"彻底跑顺**，再拓宽飞轮。

- **补完蒸馏闭环剩余摩擦**（候选）：捕获侧"从链接到卡尽量一步"（后端直跑蒸馏）；复用端"相关时浮现"（按 topic/tag 匹配，非仅时间驱动）。
- **Phase 2 · 灵感留存 + 备份**（候选）：随手记灵感 → Obsidian `灵感/日期/`；Obsidian 库纳入 git 自动备份（复用 self-hosted runner）。
- 温故卡复用状态从 localStorage 迁到卡片 frontmatter（跨端持久，需后端"更新已存笔记 frontmatter"能力）。

> **2026-09-03 止血批次**（工程帽半天，随后换产品帽 dogfood 一周，见 `.claude/plan/next-steps-dogfood-w1.md`）：

### Removed
- **`lite/` 轻量版分叉 + `vendor/xlsx.full.min.js`**：lite 与主站 58 处同名函数重复、其 xlsx 引用路径已断、无实际使用；881KB 的 xlsx 库仅被 lite 引用却随 Pages 整仓部署。PC-first 收敛的延续，见 [`docs/adr/0005`](docs/adr/0005-pc-first-drop-native-mobile.md) 修订。
- `scripts/run_refresh.vbs`（指向已不存在的仓库路径，属计划任务时代遗留）。

### Fixed
- **`bump_version.py` 资产清单漂移**：手写 `ASSETS` 含 4 个已删文件、漏 `js/features/inbox.js` 与 `js/core/platforms.js`——单独改这两个文件不会换 SW CACHE，客户端吃旧缓存，CI `--check` 检不出（清单本身错）。改为自动扫描 `js/**/*.js`/`css/`/`vendor/`/manifest/icons；`--check` 与 `apply` 同时校验 `sw.js` FILES 无遗漏、无幽灵条目（幽灵条目会让 `addAll` 404、新 SW 永远装不上）。
- **经验卡标题被改写**：`kb.save` 把清洗后的文件名当 `title` 写进 frontmatter 与 `_index.jsonl`，蒸馏库/温故卡显示成 `Codex-Claude-进阶必装的-10-个-…`。现 `title` 存用户原标题（加引号防冒号破坏 YAML），清洗名只留 `fileName`。
- 知识库视图 30s 自动刷新守卫读裸 `__view`（走查评审 T2），改读 `state.js` 镜像的 `window.__view`。
- `app.js` 僵尸：`switchTab` 纯转发别名（调用者改 `switchView`）、`backupExport/Import` 重复挂载。
- `scripts/` 去硬编码：`.cmd` 改读 `WB_PYTHON` 环境变量（不设则用 PATH 里的 python）；`setup_runner.ps1` 的 runner 目录改参数、清掉三台机器混杂的注释路径。

### Added
- `kb.save`/`list_deposits` 回归测试 ×3（飞轮唯一写路径此前零覆盖；含同名后缀、越界标题、非白名单 source）+ `bump_version` 扫描/FILES 校验/「新增模块必换 CACHE」测试 ×3。

> **2026-09-04 设计契约批次**（缘起：X 帖「先 design.md → 出效果图 → 再写代码」；回查 `styles.css` 全史 21 次提交 +1987/−888、08-26 单日四次换皮——准则写了没人查就漂，实测差距见 [`界面设计准则.md`](docs/design/界面设计准则.md) §2.1）：

### Added
- **`check_design_tokens.py` 令牌门禁进 CI**：引用未定义 CSS 变量（孤儿）直接红；化石令牌（定义了全仓无人引用）只许降不许升（棘轮基线 19）；裸 px 466 vs 令牌 57、硬编码 hex 22 行先只统计立基线。思路见 [`TECH_CHARTER.md`](docs/TECH_CHARTER.md) 维度三。
- **项目级 `CLAUDE.md`**（10 行纯指针）：agent 开工自动读到文档归位 / 宪章 / 界面准则(=DESIGN.md) / bump / 令牌门禁 / 心法。
- **效果图门禁**（准则 §6.0）：新视觉语言 / 新组件类 / 新布局骨架 → 先用 `artifact-design` 出一页 HTML 效果图存 `docs/reference/devhtml/` 过目，再碰 `styles.css`；沿用现成类的小改不触发；不替代走查。

### Changed
- 界面设计准则 v1.2 定位改「本仓的 DESIGN.md」，§0 订正 `frontend-design` 从未安装、HTML 产物实由内置 `artifact-design` 产出；开发心法总纲 v1.2 设计步补一行；选型账本 v1.6 §3 补「视觉契约先定 / 效果图门禁」两条做法与 Claude Design（未实测）；工具链地图 v1.4 设计规范「由谁强制」改为脚本。

---

## [0.10.0] · 2026-09-03 — 捕获层：浏览器扩展 + 收件箱上后端

> 补上飞轮**捕获环**：从"事后回工作台补录链接"改成"读帖当场选中一段 + 写下感悟"。
> 为什么这么做、三条候选路（Obsidian Web Clipper / 书签小工具 / 自研扩展）如何取舍，
> 见 [`docs/design/捕获收件箱-浏览器扩展-设计.md`](docs/design/捕获收件箱-浏览器扩展-设计.md) 与 [`docs/adr/0006`](docs/adr/0006-self-built-browser-extension-for-capture.md)。

### Added
- **浏览器扩展 `extension/`**（MV3，开发者模式 load unpacked，无需构建）：三个入口共用一个 shadow DOM 面板——四站选中即现浮按钮、右键菜单（**全站可用**，非四站靠 `scripting` 临时注入，知乎/公众号等文章页也能存）、工具栏 popup（快速存 + 端口/浮按钮设置 + 连接状态）。**零站点解析**：只用 `getSelection()`/`og:*`/`document.title`，不含任何平台专属 DOM 选择器，站点改版不会失效。
- **收件箱后端化**：`backend/clients/inbox.py` + 五路由（`GET /api/inbox`、`/api/inbox/ping`，`POST /api/inbox/add|update|delete`）。真源为仓根 `inbox.local.json`（gitignore），tmp+`os.replace` 原子写，文件损坏则备份 `.bak` 空启动。
- **摘录 + 感悟成对**（Readwise 式 highlight+annotation）：条目新增 `title/excerpt/note/source/updatedAt`；卡片渲染摘录引用块 + 感悟 + 来源角标（扩展/工作台）。
- **`→蒸馏` 内嵌摘录**：带摘录时蒸馏指令改为「据此提炼，无需再抓取页面」。**小红书/微博反爬抓不到正文的问题由"人工取材"绕过**——选中那段就是精华，这是本批次对飞轮的最大加成。
- **拖拽即存**：选中文字/链接拖到捕获卡即预填（`text/uri-list`/`text/plain`）。
- 平台枚举扩到 **微博 / 即刻**，并抽出共享模块 `js/core/platforms.js`（inbox 与 distill 共用，避免两处漂移）；`detectPlatform()` 支持无协议头链接。

### Changed
- **收件箱数据层改「API 优先 + 离线队列」**：后端可达走 API；不可达则写 localStorage 并标 `pending`，下次拉取成功自动补推——守住"离线可跑"北极星。
- `/api/inbox/*` 写端点加 **Origin 允许列表**（放行无 Origin、本机工作台、`chrome-extension://`，其余 403）。此前后端对 JSON 统一放 `ACAO:*`，任意网页可用简单请求写本地 API。
- `distillNew()` 支持预填（`url/platform/excerpt/note`），无参时行为不变。

### Fixed
> 以下三条由 chrome-devtools 全链路走查发现（2026-09-03）。

- **收件箱并发写会毁数据**（走查发现，最严重）：后端是 `ThreadingHTTPServer`，而前端补推用 `Promise.all` 并行、扩展也可能连点，于是多线程同时进 `add()` 的读-改-写：① 都写同一个 `.tmp`，先 `os.replace` 的把它移走、后者找不到源 → 返回「写入失败」(400)；② 各自基于旧快照覆写 → **静默丢条目**。实测无锁时 **25 条并发提交仅 0 条存活**，并把 `inbox.local.json` 写成非法 JSON 触发「损坏恢复」把数据清空。现全局锁包住读-改-写、tmp 名带 pid+线程 id、失败清理残留 tmp；补 2 条并发回归测试（已验证对旧代码会失败）。前端补推同时改为**串行**。
- **旧版遗留捕获永远上不了后端**：`_flush()` 只推带 `pending` 标记的条目，而升级前纯 localStorage 时代的条目没有该标记 → 既不上云也不在列表显示（联机后列表取自后端），等于静默消失。现队列内一切都视为「后端还没有的」全量补推，连接状态计数同步修正。
- **感悟文字重复显示**：工作台存的条目没有 `title`，卡片标题回退用感悟，而感悟行的去重比的是 `r.title`（空）没挡住 → 同一句话在标题和感悟行各出现一次。改为标题函数返回「取自哪个字段」，据此隐藏重复的摘录块/感悟行。
- `distillPickPlat` 重绘平台按钮时读不存在的 `p.emoji`（显示 `undefined`），改用 `icon(p.ic)`，与首次渲染一致。

---

## [0.9.1] · 2026-09-02 — 表现层修复：emoji→SVG + 深色侧栏 + 主题跟随系统

**思路**：PC-first 收敛后接着消化上一份走查评审的表现层 backlog（见 [`docs/design/工作台走查评审-v0.8.0.md`](docs/design/工作台走查评审-v0.8.0.md) 的 U1/U2/X2）。均为双向门小修，真机走查逐条验证（6 视图零 console error）。

### Fixed
- **X2 主题「跟随系统」颜色反转**：`_themeLight()` 在 system 模式下把「系统偏好深色」当作「浅色」返回（布尔取反 bug），导致系统偏好浅色时反显深色、从深色切「跟随系统」不生效。`!!` 改 `!`（`js/app.js`）。审计原猜「未清内联 override」为误诊——机制是 `body.light` class 切换，真因是这一处取反。
- **U2 深色模式侧边栏发白**：`.sidebar` 基础规则硬编码白色渐变（而基础规则=深色基线），深色下侧栏仍白。改用 `var(--panel)→var(--paper)` token 自适应（`css/styles.css`）。
- 顺带修 `#refreshBtn` 同步后丢 SVG 图标：`old` 用 `textContent` 捕获会剥掉图标 SVG，改 `innerHTML` 捕获/恢复（`js/app.js`）。

### Changed
- **U1 消灭 emoji 图标豆腐块**（本次最大观感修复）：知识库树（📁×81/📄×252）、模型管理（供应商徽标 + 🧠/➕/👁）、AI 助手（🧠/📥/📘/⚠️）、今日「更多工具」（🎬/💡/🧹）、顶栏时钟 🕐、同步/自检按钮与状态栏（⏳/✅/⚠️/❌/🔍）全部改内联描边 SVG。`js/core/util.js` 的 `ICONS` 新增 folder/film/eye/cpu/alertTriangle/check/clock，经典脚本（kb/model-manager）走已桥接的 `WB.ic`，ES 模块（dash/ai）直接 `import { ic }`。缺 emoji 字体的系统（如本 Linux/Chromium、许多服务器）不再满屏 □。dingbat 类符号（✓✕★☆）各系统基础字体均可渲染，保留不动。

---

## [0.9.0] · 2026-09-02 — PC-first 收敛：删移动端 + 删下架视图 + 清死代码

**思路**：战略转向「**先把 PC 端做扎实，功能成型后再回头做移动端**」。据此把上一阶段"下架但保留代码"的东西**彻底删除**，减少一人维护的垃圾代码与漂移面。移动端删除是方向级决策，见 [`docs/adr/0005-pc-first-drop-native-mobile.md`](docs/adr/0005-pc-first-drop-native-mobile.md)。

### Removed
- **移动端原生 + APK 两条交付**：删 `mobile/`（Flutter 原生 App）、`twa/`（Android TWA 壳）、`app-data.json`（移动云备份 blob）、`.github/workflows/build-apk.yml`、`scripts/build-apk.bat`、`scripts/grab-crash-log.bat`。**保留** PWA manifest/SW（桌面 PWA 用）与 `lite/`。
- **下架视图彻底删除**：能力速达 `cap`（`js/views/cap.js`）、系统状态 `ov`（`ov.js`）、动态 `sess`（`sess.js`）、课程表 `schedule`（`js/schedule.js` + `backend/pipeline/push_schedule.py` + `SCHEDULE_LOCAL_JSON`）——含各自 `#view-*` section、热力图弹窗、路由/导入/标题接线、专属 CSS。
- **死控件清理**：死快捷键 `/`（聚焦不存在的 `#q`）、死按钮 `#todayBtn` + `copyToday()`、无调用者的 `goKPI()`。
- **移动端 CSS 断点**：删 `@media(max-width:820px)` 侧栏→底栏、`@media(max-width:780px)`（先只做 PC 布局）；顺带清理约 140 行下架视图专属死 CSS。

### Changed
- `ghToken()`/`GH_REPO`/`GH_TOKEN_KEY`（同步/功能自检用）从已删的 `schedule.js` 迁入 `js/app.js`。
- 渲染异常/数据加载失败的兜底容器由已删的 `#col-cap` 改为 `.main` 顶部插卡。

### Fixed
- 消除每次加载都触发的 `schedule.json` 404（下架的 schedule.js 仍请求 GitHub raw）。
- 恢复全局隐藏 `#cmdbox`（复制指令的手动兜底框，原随 cap 视图消失），使复制命令兜底在所有视图可用。

> 消化了 [`docs/design/工作台走查评审-v0.8.0.md`](docs/design/工作台走查评审-v0.8.0.md) backlog 的 X1（移动端导航）/X3（死搜索）/X4（死按钮）/T1（schedule 404）/T3（孤儿视图）。

## [0.8.0] · 2026-09-01 — MVP 聚焦（9 视图 → 6）

**思路**：为跑通 **MVP**，把侧边栏收敛到「知识飞轮最窄闭环」这一条主线——只留飞轮五件（今日/资讯/知识库/蒸馏库/AI助手）+ 设置·模型管理。所有"看机器在干嘛"的**遥测类**视图（系统状态/动态/能力速达）对 MVP 是噪音，下架。延续 [`docs/design/产品-IA评审.md`](docs/design/产品-IA评审.md) 诊断（遥测四件套重叠）。这是**双向门**（design-principles 卡 5），故只下架、保留全部代码/数据，随时可恢复。

### Removed
- **系统状态 `ov`、动态 `sess`、能力速达 `cap` 从导航下架**：三者均属"看机器"遥测/工具，不推动知识在飞轮里流动。**js 文件、`#view-*` section、数据全部保留**（恢复只需在 `side-nav` 加回按钮）。
- 侧边栏由「今日 / 飞轮 / 工具 / 设置」四组收敛为「今日 / 飞轮 / 设置」三组。

### Fixed
- 历史标签兼容扩展：`localStorage.wb_tab` 为已下架视图（cap/sess/ov，及更早的 dash/stats/week/schedule）时统一重定向到今日（home），刷新不再卡在无导航入口的视图。
- 默认视图回落由 `cap` 改为 `home`（`renderActiveTab` 兜底）。

## [0.7.0] · 2026-08-31 — 信息架构重构（13 视图 → 9）

**思路**：落地 v0.6.0 的 [`docs/design/产品-IA评审.md`](docs/design/产品-IA评审.md) 提案——诊断出「信息架构过度碎片化 + 模块重叠 + 分组错配」，按**知识飞轮顺序**把侧边栏从 13 项收敛到 9 项（7 飞轮一等公民 + 2 设置），去重、去离题。原则：改动小 × 可逆 × 收益大先做（Nielsen 极简 / Krug 别让我思考 / DRY）。

### Changed
- **侧边栏重排为飞轮顺序**：今日 / 飞轮（资讯·知识库·蒸馏库·AI助手）/ 工具（能力速达·动态）/ 设置（模型管理·系统状态）。资讯从「能力」re-home 到「飞轮」输入端；模型管理 + 系统状态降级到「设置」。
- **今日 = 捕获+复盘中枢**：吸收原仪表盘的 速记 / 收藏 / 常用入口 / 快捷启动台四个交互件。
- **会话档案 → 动态**：吸收原「本周动态」为一张「本周变更」卡（含类型筛选）。

### Removed
- **仪表盘（dash）拆解下线**：交互件并入今日；KPI 指标条 + 今日速览（与系统状态/资讯重复）删除。
- **Skill 统计（stats）并入 能力速达**：TOP10 使用 + 分类分布移入 cap 侧栏（删 `js/views/stats.js`）。
- **本周动态（week）并入 动态**（删 `js/views/week.js`）。
- **系统状态**删「内容与知识生产」卡（与知识库重复）；其动作入口（新建笔记/蒸馏/搜索）改在**知识库**内提供。
- **课程表从导航下架**（`js/schedule.js` 与云端 `schedule.json` 代码/数据保留，可随时恢复入口）。

### Fixed
- 历史标签兼容：`localStorage.wb_tab` 为已下线视图（dash/stats/week/schedule）时自动重定向到承接者（home/cap/sess/home），刷新不再落空。

## [0.6.0] · 2026-08-31 — 产品/IA 评审 + 知识飞轮复用端

**思路**：界面视觉已修（见 v0.5.0），但用户仍觉"产品/模块设计不合理"。经 `/brainstorming` 确认主心骨=**个人知识飞轮**，并诊断"整条飞轮从没跑通"→ 采用**"先跑通一条最窄闭环"**策略（walking skeleton），选中**蒸馏闭环**、先攻**复用端**（存了不用是知识库头号死法）。详见 [`docs/design/产品-IA评审.md`](docs/design/产品-IA评审.md)、[`docs/design/温故复用-设计.md`](docs/design/温故复用-设计.md)。

### Added
- **今日「温故」卡**（`js/features/recall.js`）：旧蒸馏经验卡按简化间隔重复(Leitner-lite)每天在「今日」浮现，👍有用/✓已内化/打开三态反馈；复用 `/api/kb/deposits` 与 `distillOpen`，纯前端 + localStorage，零后端零依赖。
- `docs/design/产品-IA评审.md`：13 模块过度碎片化诊断（仅 5 个日用）+ 收敛到 ~7 的重构提案（Nielsen/Krug/design-principles）。
- `docs/research/需求澄清工具选型.md`：需求澄清工具选型对比（spec-kit/BMAD/brainstorming，真实热度 + 安全评级）。
- [`docs/research/工具链-MCP与Skill地图.md`](docs/research/工具链-MCP与Skill地图.md)：本项目用到的 MCP/Skill × 开发阶段复盘 + 换机复用手册（chrome-devtools MCP、/brainstorming、Spec-Kit、design-principles 等，含证据出处与安装/触发速查）。
- [`docs/research/开发阶段-Skill选型账本.md`](docs/research/开发阶段-Skill选型账本.md)：通用选型账本——软件开发各阶段（选型/全流程/前端/后端/测试）GitHub 优质 Skill/MCP/SDD 框架对比（gh api 实测 star 快照 + Snyk 安全红线 + 决策指引），面向任意项目/设备复用。
- `CHANGELOG.md` + `docs/版本管理规范.md`：建立版本管理体系。

### Fixed
- `distill.js` 4 处 `onclick` 漏外围引号（`fn(值)` 应为 `fn('值')`）——导致蒸馏库**筛选片/点卡开卡/平台选择**点击此前一直失效；已修并真机走查。

### Changed
- 知识飞轮路线图 / 项目总览回写本次方向共识。
- 工具链：本地引入 GitHub Spec-Kit 做需求澄清（`.specify/`、speckit 技能**不入库**，见 `.gitignore`）。

## [0.5.0] · 2026-08-31 — Phase 1 蒸馏库 + 界面优化

### Added
- **蒸馏库**视图（`js/views/distill.js`）：链接→skill 六维萃取→经验卡→落 Obsidian `蒸馏库/`，可筛选/检索；后端 `kb.save(extra)` + `GET /api/kb/deposits`（第 9 条 API）。(`6fb14d0`)
- `docs/design/界面设计准则.md`：codify 设计系统 v7 + 图标红线 + 新视图检查清单。(`d9d8380`)

### Changed
- 关键图标 emoji→内联 SVG（新增 `js/core/icons.js`；侧边栏 13 项迁移），修复缺 emoji 字体系统上的豆腐块。(`d9d8380`)

### Fixed
- 蒸馏库排版：补齐 10 个从未写 CSS 的类 + 全局 `.chip.on` 选中态（镜像 v7 现有组件）。(`d9d8380`)

## [0.4.0] · 2026-08-30 — 分层交付 + 文档化

### Changed
- 后端收敛为 `backend/{core,utils,clients,pipeline}` 分层 package；前端资源按类归位（`css/ js/ vendor/ icons/`）；本机脚本归 `scripts/`；Android/TWA 归 `twa/`。(`8f940dd` `360d4ee` `e392acc` `4c59646`)
- README 全面重写为分平台部署手册（大白话比喻）。(`6b180f0`)

### Added
- `docs/planning/知识飞轮-路线图.md` + `docs/planning/项目总览-需求与进度.md` + Phase1 计划。(`af8908b`)

## [0.3.0] · 2026-08-29 — ES Modules 零构建 + 类型化 + 治理

### Changed
- 前端从 2157 行巨石 IIFE 拆为浏览器原生 ES Modules（`core/` + `views/` + `features/`，零构建）。(`030d99a`…`3b58ff5`)

### Added
- JSDoc + `checkJs` 零构建类型化（覆盖 state/net 边界，CI `tsc --noEmit` 门禁）。(`bae05cc`)
- `docs/TECH_CHARTER.md`（技术宪章）+ 4 条 ADR（`docs/adr/`）。(`0087db7`)

### Fixed
- `state.js` 潜伏 bug：镜像 `window.__data/__view` + 暴露 `window.renderAI`。(`8db406f`)

## [0.2.0] · 2026-08-28 — 工程化硬化（P0/P1 重构）

### Changed
- 抽 `wb_config` 清除硬编码本机路径（换机可移植）；抽 `wb_common` 消除跨脚本重复；`server.py` 拆路由表 + 分层。(`0f6bcdf` `2335a3d` `e8f0329`)

### Added
- 缓存版本自动 bump（`bump_version.py`，CI 硬门禁）；CI 真正跑 flake8 + pytest。(`7bcea15`)

### Fixed
- `data.json` 原子写入，杜绝半写损坏导致前端白屏。(`4c70b36`)
- CI YAML 解析、GitHub Pages 自动启用。(`1f37760` `22b91bc`)

## [0.1.0] · 2026-08-27 — 初始工作台

### Added
- 侧边栏导航 + 首页聚焦今日代办/复盘；番茄钟；活动热力图。(`228759c`)
- AI 模型管理 + Supabase 云端配置 + 本地 Obsidian 知识库接入。(`7823757`)
- 设计系统 v6（冷色硬朗）→ v7（活力糖果圆润科技风）；深/浅/跟随系统三态主题。(`6238932`…`c6bed47`)
- Python CI（lint + tests）。(`e92f1c6`)

---

[Unreleased]: https://github.com/Zero-st/DailyWorkbench/compare/main...HEAD
