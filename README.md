# 个人工作台（双端 PWA · DailyWorkbench）

一套代码，手机和电脑都能用的个人工作台——把你的 skills、自动化、模型、AI 日报、待办、课程表全摊在一块「随身面板」上。

**打个比方**：它就像你随身带的一本"电子活页夹"。翻开（打开网页）就能看，手机、电脑翻的是同一本；WiFi 断了也照样能翻上次看过的那几页。不用装软件、不用先连服务器、不用等它"编译打包"。

> 📐 **动手改架构前，先翻 [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md)**（技术宪章：北极星原则 + 模块边界 + 工程护栏 + 协作流程）。改了架构请顺手更新它。

---

## 一、这是什么 · 为什么这么造

它是一个 **PWA**（Progressive Web App，"能装到手机主屏、当 App 用的网页"）。核心信条一句话：

> **零构建 · 零依赖 · 离线可跑**

拆成大白话：

- **零构建**——代码写完直接就能跑，没有"先 build 一下"这一步。别的前端项目常常改一行字也得先 `npm run build` 编译半天；这里不用，源码就是成品。好比**手写笔记本 vs 需要冲印的胶卷**：写完就能看，不用送去冲洗。
- **零依赖**——前端不装任何框架（没有 React/Vue）、不引打包工具，用的是浏览器**原生 ES Modules**。少一样外部零件，就少一个"三年后它自己坏掉"的风险。
- **离线可跑**——靠 Service Worker（浏览器里的"离线随身缓存包"）把页面存在本地，断网也能打开看上次的数据。

为什么这么拧巴地追求"简单"？因为这是**一个人维护**的项目。单人项目最大的死法不是"功能不够"，而是"某天它突然跑不起来了"。所以宁可朴素，也要保证 `git clone` 下来、双击 `index.html` 就能看。

前端之外，另配一个**可选的本地 Python 服务**（`backend/server.py`，只用标准库、零第三方依赖），给你补上「一键刷新 / AI 代理 / Obsidian 知识库」这些需要"联机干活"的能力。不想要？不开它，纯网页照样跑。

---

## 二、功能一览

- **顶部 KPI 指标条**：Skills / 自动化 / 模型 / 记忆条目，一眼看全家底。
- **能力速达**：本机能力卡片网格，点一下即复制"调用指令"；按你实际用的频率排序、热门的标 🔥。
- **AI 日报**：每天 08:30 自动抓当日 AI 资讯（模型 / 产品 / 行业 / 论文 / 技巧分栏），可直接点「让 AI 讲讲」。
- **今日引导**：每日清单，会自动带上当天日报头条。
- **状态看板**：自动化、模型、数据更新状态一目了然。
- **我的速记 / 待办 / 收藏**：随手记，**纯浏览器本地存储，不上传**。
- **课程表**：支持 Excel 导入（`.xlsx`，第三方库懒加载，用到才下载）。
- **浅色 / 深色主题**：右上角一键切换，记住你的偏好。
- **全局搜索**（快捷键 `/` 聚焦）、**会话热力图**（点格子看当天聊了啥，`Esc` 关详情）、**立即刷新**。
- **响应式**：手机竖屏单列、电脑宽屏双栏；**离线可开**（Service Worker 缓存）；数据异常时显示友好错误卡，不整页白屏。

---

## 三、五分钟先跑起来

**最快**：把仓库下下来，双击 `index.html`。此时用的是内置示例数据，够你先看个样子。

想接真实数据、或测试"装到主屏"，起个本地服务器更稳：

```bash
cd DailyWorkbench
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> **手机同屏预览**：电脑和手机连同一个 WiFi，手机浏览器开 `http://<电脑内网IP>:8080` 即可。

> 注意：`python -m http.server` 只是个"纯搬运工"，能把网页递给浏览器，但**点不动"一键刷新 / AI 助手 / 知识库"那几个联机按钮**——那些要下面第四节场景 B 的后端服务。

---

## 四、不同平台部署 ★

工作台能落地成 **6 种形态**。别一股脑全上——先对号入座，看你是哪种情况：

| 你的情况 | 用哪套 | 一句话比喻 |
|---|---|---|
| 只想在电脑浏览器里看看 | **A · 纯静态本地** | 翻开笔记本就看 |
| 想要完整功能（刷新/AI/知识库） | **B · 本地全功能后端** | 给笔记本配个私人助理 |
| 想随时随地在线访问、还自动更新 | **C · GitHub Pages** | 把笔记本搬上云、还请人每天帮你续写 |
| 想在手机上当 App 用 | **D · 手机 PWA** | 给网页穿件"App 马甲" |
| 想要能安装的安卓 APK | **E · 安卓 APK（两种）** | 套壳 or 重盖一栋原生的房子 |
| 只要个极简、纯静态的轻量版 | **F · lite 版** | 一本随身便签，不带助理 |

---

### 场景 A · 只在电脑浏览器看（纯静态）

- **适合谁**：只想看看界面、看示例数据，或已有现成 `data.json`。
- **怎么做**：双击 `index.html`，或 `python -m http.server 8080` 后开 `http://localhost:8080`。
- **比喻**：像翻一本已经写好的笔记本，翻开就看，不需要任何人在旁边伺候。

---

### 场景 B · 本地全功能后端（推荐日常自用）

- **适合谁**：想用"一键刷新真实数据 / AI 对话 / Obsidian 知识库沉淀"这些联机能力。
- **怎么做**（从仓库根目录）：

```bash
python -m backend.server 8080     # 端口可省，默认 8080；只绑 127.0.0.1，不对外网开放
# 浏览器开 http://localhost:8080
# Windows 小白可直接双击 scripts/start_workbench.cmd（自动起服务 + 开浏览器）
```

- **它比纯搬运工多了啥**（`/api/*` 联机能力）：

  | 接口 | 干什么 | 没配置时 |
  |---|---|---|
  | `POST /api/refresh` | 一键重抓本机 WorkBuddy 真实数据、重建 `data.json` | 总能用 |
  | `POST /api/chat` | 当 AI 接口的"中转站"（绕开浏览器跨域限制） | 需在配置里填上游主机白名单 + key |
  | `GET/POST /api/models` | 模型配置读写（存到 Supabase 云端，多端共享） | 没配 Supabase → 自动退回浏览器本地存储 |
  | `GET /api/kb/*`、`POST /api/kb/save` | 读写 Obsidian 知识库（列目录 / 读笔记 / 搜索 / 沉淀） | 没配 vault → 返回"未配置"，前端隐藏相关功能 |

- **比喻**：纯静态是"一本笔记本"；开了后端，就是**给这本笔记本配了个私人助理**——你说"更新一下"，它跑去把最新数据抄进来。
- 联机能力要配什么，见 **第六节·可选配置**。

---

### 场景 C · GitHub Pages 在线版（固定网址 + 自动更新）

- **适合谁**：想随时随地（换台电脑、在外面用手机）都能打开，而且**数据自己会更新**。
- **固定线上地址**：https://Zero-st.github.io/DailyWorkbench/ ｜ 仓库：https://github.com/Zero-st/DailyWorkbench
- **怎么部署**：`.github/workflows/deploy-pages.yml` 会在你 push 到 `main` 后，把**整个仓库**发布成 Pages 网站。
  > ⏳ push 后要等 **30–50 秒** GitHub 才构建完，别立刻 `curl` 验证，会看到旧版。
- **怎么做到"自动更新"**（核心，现行机制）：不是靠 Windows 计划任务，而是 **GitHub Actions + 你自己机器当"自助 runner"**：
  1. 在你常开机的 Windows 机器上跑一次 `scripts/setup_runner.ps1`，把它注册成 `Zero-st/DailyWorkbench` 的 **self-hosted runner**（自助跑手）。
  2. 之后两个定时工作流自动在这台机器上跑：
     - `sync.yml`——**每小时**重抓本机真实数据（日报 + 新闻 + 汇总），重建 `data.json` 并自动 push。装了新 skill / 加了新自动化，最多 **1 小时**后线上就更新。
     - `daily-ai.yml`——**每天约北京 08:30** 抓当日 AI 资讯。
- **为什么非得用"自己的机器"当 runner**？因为要读的是你**本机** WorkBuddy 的真实数据（skills 目录、数据库、模型配置），GitHub 云端的机器读不到。所以把"跑手"放回你自己家。
- **原理点睛**：`data.json` 在 Service Worker 里被设成"**永远走网络、不吃缓存**"（见 `sw.js`），所以后台一 push，你刷新页面立刻看到新数据；其余静态资源才走缓存。
- **比喻**：把笔记本搬上云端谁都能翻，同时**雇了个人每小时帮你把最新内容续写进去**。

---

### 场景 D · 手机上当 App 用（PWA 安装）

- **适合谁**：想在手机主屏上有个图标，点开像原生 App，还能离线开。
- **怎么做**：手机浏览器打开线上地址（场景 C），浏览器菜单选「**添加到主屏幕**」。搞定，主屏就多了个"工作台"图标。
- **比喻**：给网页**穿了件"App 马甲"**——外表和真 App 没差，其实里子还是那个网页，所以它跟着线上版一起更新，不用重新下载。

---

### 场景 E · 安卓 APK（两条完全不同的路）

想要一个真能安装的 `.apk`？项目里**有两个不同来源的 APK，千万别搞混**：

| | **TWA 壳** | **Flutter 原生** |
|---|---|---|
| 目录 | `twa/` | `mobile/` |
| 本质 | 给线上网页**套个安卓壳**，里面还是那个 PWA | **照着工作台重新写的原生安卓 App**（另一套代码） |
| 怎么构建 | GitHub Actions `build-apk.yml` 在**云端 ubuntu** 跑 `./gradlew assembleRelease` + `apksigner` 签名 | 本机 Windows 跑 `scripts/build-apk.bat`（`flutter build apk --release`） |
| 产物 | `twa/workbench-signed.apk`，并自动发一个 GitHub Release（tag `apk-<编号>`） | `mobile/build/.../app-release.apk`，拷到 `APK/app-release.apk` |
| 更新方式 | 网页更新，它跟着更新（壳不用重装） | 改了要重新 `flutter build` 再装 |

- **怎么触发 TWA 构建**：改了 `twa/**` 并 push，或在 GitHub Actions 页面手动 `workflow_dispatch`，跑完去 Release 下载 APK。
- **比喻**：TWA 是**给现成的网页套个安卓外壳**（省事，随网页更新）；Flutter 是**照着样子重新盖了一栋原生的房子**（体验更"原生"，但要单独维护、单独重建）。
- ⚠️ 技术宪章提醒：一个人**长期并行维护两套 UI 最贵**。这两条路（还有下面的 lite）都属"按需存在、别放任漂移"，明确要长期投入某一端时再收敛。

---

### 场景 F · lite 轻量版（纯静态、独立）

- **适合谁**：只想要个极简版，**完全不依赖本机后端**，随便找个静态空间一挂就能用。
- **怎么做**：单独把 `lite/` 这个文件夹静态托管即可（它自带 `index.html / app.js / sw.js / manifest / icons`）。
- **和主版的区别**：lite 不走 `data.json` 那套后端流水线，而是**直接从公开 API 拉数据**（AI 日报 / 每日新闻 / AI 助手 / 待办 / 速记 / 收藏 / 课程表，全存浏览器本地）。
- **比喻**：主版是"笔记本 + 私人助理"，lite 是**一本随身便签**——轻、独立、不用伺候，但也没那些联机高级功能。

---

## 五、数据从哪来（`data.json` 契约）

面板默认读同目录下的 `data.json`——**它就是这个项目的"数据库"**，只不过是拿一个 JSON 文件当账本用（单人、无并发，够用且零依赖）。

`data.json` 由 `backend/pipeline/export_data.py` 自动从本机 WorkBuddy 抓取生成，覆盖示例数据：

- **Skills**：扫描 WorkBuddy 的 `skills/` 目录，读每个 `SKILL.md` 的 frontmatter（名称 / 描述）。
- **自动化**：读 WorkBuddy 数据库，只取未删除的活跃任务，算下次运行时间。
- **模型**：读模型配置，按 `localhost` 自动标「本机 / 云端」。
- **记忆**：统计 memory 目录的文件数。
- **今日引导**：根据真实自动化动态生成。

**手动重建一次**（二选一）：

```bash
python -m backend.pipeline.export_data     # 命令行
# 或：Windows 小白双击 scripts/refresh.cmd（已配好托管 Python 路径，跑完自动刷新）
```

数据落地在三处，各管各的：**`data.json` 文件**（主快照）+ **Supabase 云端**（只存需要多端共享的模型配置）+ **浏览器 localStorage**（速记 / 待办 / 收藏 / 偏好，纯本地不上传）。

> ⚠️ `data.json` 是**前后端唯一契约**，类型定义只有一处——`js/core/net.js` 里的 `@typedef WBData`。改它的结构 = **单向门**（不可逆，牵一发动全身），动前务必想清楚、必要时写 ADR。

---

## 六、可选配置（`workbench.local.json`）

后端的联机能力要不要开、连哪台机，全在一个配置文件里。从模板拷一份即可（真实文件已 gitignore、不会被提交）：

```bash
cp workbench.local.json.example workbench.local.json
```

| 配置键 | 作用 | 不填会怎样 |
|---|---|---|
| `workspace` | WorkBuddy 工作区根目录 | 用平台默认 `~/.workbuddy/workspace` |
| `ollamaExe` | Ollama 可执行文件路径（`"auto"`=从 PATH 找） | 自动探测 |
| `disks` | 要统计的磁盘，如 `["C:\\","D:\\"]` | 平台默认 |
| `supabase` | `{url, serviceKey}`，开启 `/api/models` 云端模型配置 | 退回浏览器本地存储 |
| `kb` | `{vault, depositRoot}`，Obsidian 库路径，开启 `/api/kb/*` | KB 功能返回"未配置" |
| `chatProxy` | `{allowHosts}`，`/api/chat` 允许中转的上游主机白名单 | 空 = 不限制 |

**三级覆盖优先级**：`环境变量` ＞ `workbench.local.json` ＞ `平台默认`。每个键都能被同名环境变量临时顶掉。**全部可选**——不填就是把对应功能优雅地关掉，主界面照常跑。

---

## 七、改前端必做：bump 版本号（已自动化）

Service Worker 会缓存静态资源。你改了前端却不更新版本戳，用户端会**一直吃旧缓存、页面"裸掉"**。

**打个比方**：改了商品却不换快递单号，快递员按老地址把旧货又送了一遍——用户拿到的还是旧页面。所以每次改完前端资产（`css/`、`js/` 等），跑一次：

```bash
python bump_version.py         # 按文件内容 hash 自动同步 index.html + sw.js 的 ?v= 与 CACHE 名
python bump_version.py --check # 只校验是否同步（CI 会跑，不一致直接失败）
```

版本戳由**内容 hash** 生成，不用手改数字、不会漏改。`--check` 是 **CI 硬门槛**——漏 bump 直接红灯，进不了主干。

---

## 八、幕后自动化（GitHub Actions）

`.github/workflows/` 下 5 个工作流，各司其职：

| 工作流 | 干什么 | 触发 | 跑在哪 |
|---|---|---|---|
| `ci.yml` | 质量门禁：`bump --check` + flake8 + pytest + `tsc --noEmit` | push/PR 到 main | GitHub 托管（ubuntu） |
| `deploy-pages.yml` | 把整仓发布成 GitHub Pages 网站 | push 到 main / 数据流水线跑完后 | GitHub 托管 |
| `sync.yml` | 每小时重抓真实数据、重建 `data.json` 并 push | cron `13 * * * *` | **自助 runner**（你的 Windows 机器） |
| `daily-ai.yml` | 每天约 08:30 抓当日 AI 资讯 | cron（北京 08:30） | **自助 runner** |
| `build-apk.yml` | 构建 + 签名 TWA 安卓 APK，发 Release | push `twa/**` / 手动 | GitHub 托管（ubuntu） |

> CI 是**真门禁**（真会变红），项目约定**禁止 `|| true` 假绿**——宁可诚实删掉一个测试，也不留"看着在测其实没测"的绿灯。

> 为什么 `daily_ai` 用 Python 而不是 `.cmd`：cmd.exe 走 GBK 代码页，含中文的 UTF-8 批处理会直接崩（实测退出码 `-1073741510`，脚本第一行都跑不到）。Python 无此问题。

---

## 九、项目结构

> 按类分区。前端因 GitHub Pages「从仓库根部署」（`deploy-pages.yml` 上传 `path: .`）+ 文档相对路径而**钉死在根**；后端已收敛为分层 Python package。详见 [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md)。

```
DailyWorkbench/
│  ── 前端 PWA（钉死在根：Pages 根部署 + 相对路径）──
├── index.html                     # 唯一 HTML 入口
├── sw.js  manifest.json  .nojekyll # Service Worker / PWA 配置 / 禁 Jekyll
├── css/styles.css                 # 深色/浅色主题 + 响应式
├── js/                            # app.js(入口) · kb/schedule/model-manager(经典脚本·window.WB) · core/ views/ features/ types/
├── vendor/                        # marked.min.js · xlsx.full.min.js（第三方：Markdown / 课程表导入·懒加载）
├── icons/                         # icon.svg · icon-192/512 · maskable-512
│  ── 数据 · 配置（前端 fetch 或后端产出，钉在根）──
├── data.json                      # 聚合快照（backend/pipeline/export_data.py 生成）
├── ai_daily.json  daily_news.json # 抓取的资讯数据
├── app-data.json                  # 移动端云端备份 blob（GitHub API 契约，勿改名）
├── workbench.local.json.example   # 本机配置模板（真实 *.local.json 均 gitignore）
│  ── 前端工程工具（留根）──
├── bump_version.py                # 缓存戳自动同步（CI 硬门禁，改前端后必跑）
├── test_workbench.py  conftest.py # 测试（conftest 把仓库根加 sys.path）
├── jsconfig.json                  # JSDoc + checkJs 类型检查
│  ── 后端（Python 分层 package）──
├── backend/
│   ├── server.py                  # 本地 HTTP 服务（静态 + /api/{refresh,chat,models,kb}）
│   ├── core/                      # config（配置层）· paths（路径单一来源）
│   ├── utils/                     # common（github_push / http_get / frontmatter / log）
│   ├── clients/                   # supabase · kb（Obsidian vault）
│   └── pipeline/                  # export_data · fetch_* · daily_ai · local_refresh · sync · sync_status · push_schedule
│  ── 文档 · 其它交付形态 · 自动化 ──
├── docs/                          # TECH_CHARTER · adr/ · 各操作指南 · supabase_schema.sql
├── twa/                           # Android TWA 构建（网页套壳：gradle + bubblewrap）
├── lite/                          # 轻量版 PWA（独立纯静态分叉，不依赖后端）
├── mobile/                        # Flutter 原生移动端（照工作台重写的原生 App）
├── scripts/                       # 本机启动/同步/构建脚本（refresh·start_workbench·run_refresh·setup_runner·build-apk·grab-crash·delete_workbench_tasks，含机器路径）
└── .github/workflows/             # ci · deploy-pages · sync · daily-ai · build-apk
```

> 后端脚本作为 package 运行：`python -m backend.server 8080`、`python -m backend.pipeline.export_data` 等（详见各 workflow 与 `scripts/refresh.cmd`）。

---

## 十、文档索引

- [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md) —— 技术宪章：北极星原则 + 模块边界红线 + 工程护栏 + 协作流程（改架构先翻它）。
- [`docs/adr/`](docs/adr/) —— 架构决策记录（单向门才写）：
  - `0001-zero-build-north-star.md` · 零构建北极星
  - `0002-es-modules-no-framework.md` · 选原生 ES Modules、不上框架
  - `0003-jsdoc-checkjs-not-full-ts.md` · 用 JSDoc+checkJs 而非全量 TS
  - `0004-classic-scripts-keep-window-bridge.md` · 经典脚本保留 window 桥接
- [`docs/模型管理模块操作指南.md`](docs/模型管理模块操作指南.md) —— 模型管理模块怎么用。
- [`docs/知识库沉淀存储方案.md`](docs/知识库沉淀存储方案.md) —— Obsidian 知识库沉淀存储设计。
- [`docs/Supabase上线操作指南.md`](docs/Supabase上线操作指南.md) —— Supabase 配置上线步骤。
- [`docs/supabase_schema.sql`](docs/supabase_schema.sql) —— Supabase 建表 DDL（前端永不持有 Supabase 密钥，全走本机 `server.py` 的 service_role key）。

---

## 十一、更新记录

### 2026-08-28 · README 全面重写
- 补齐**六种平台部署**（纯静态 / 本地后端 / GitHub Pages / 手机 PWA / 安卓 APK 两种 / lite），新增"你是哪种情况→用哪套"对照表。
- 讲清 **TWA 壳 vs Flutter 原生**两个 APK 的区别；自动更新机制更正为 **GitHub Actions 自助 runner + cron**（旧的本机计划任务叙述已废）。
- 全篇加大白话比喻；命令全部对齐 `backend/` package 运行方式（`python -m backend.X`）。

### 2026-08-17 · 网页端 PWA 健壮性 & 交互打磨
- **防白屏（健壮性）**：新增 `normalizeData()` 兜底 `data.json` 缺字段；`render()` 包 `try/catch`，数据异常显示友好错误卡而非整页空白。
- **弹窗统一（一致性）**：`aiClear` / `aiMemoryClear` 的原生 `confirm` 与 `aiSend` 无 Key 提示统一改为自定义 `WB.dialog`。
- **交互增强（体验）**：快捷键 `/` 聚焦搜索、`Esc` 关热力图详情；新增离线提示条（`offline`/`online` 事件）。
- **版本 bump（部署纪律）**：`index.html` `?v=62→63`、`sw.js` `CACHE workbench-v76→v77`（三处一致，避免用户吃旧缓存）。
