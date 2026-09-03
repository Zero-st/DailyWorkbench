# 个人工作台（PWA · DailyWorkbench）

一套代码、手机和电脑都能用的**个人知识飞轮操作台**——把「**输入 → 捕获 → 沉淀 → 蒸馏 → 复用**」这条闭环摊在一块「随身面板」上：刷到的内容随手扔进收件箱，蒸馏成可复用的**六维经验卡**沉进 Obsidian，再靠「今日温故」把存过的东西每天推回你眼前。

**打个比方**：它就像你随身带的一本"电子活页夹"——不只是翻着看，更是**帮你把碎片内容炼成自己的知识、还定期拿出来温习**。翻开（打开网页）就能看，手机、电脑翻的是同一本；WiFi 断了也照样能翻上次看过的那几页。不用装软件、不用先连服务器、不用等它"编译打包"。

> 📐 **动手改架构前，先翻 [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md)**（技术宪章：北极星原则 + 模块边界 + 工程护栏 + 协作流程）。改了架构请顺手更新它。

---

## 一、这是什么 · 为什么这么造

它是一个 **PWA**（Progressive Web App，"能装到手机主屏、当 App 用的网页"）。**主心骨＝个人知识飞轮**：让内容从「刷到」一路走到「真的复用到」，而不是存了一堆再也不看（方向见 [`docs/planning/知识飞轮-路线图.md`](docs/planning/知识飞轮-路线图.md)）。工程上的核心信条一句话：

> **零构建 · 零依赖 · 离线可跑**

拆成大白话：

- **零构建**——代码写完直接就能跑，没有"先 build 一下"这一步。别的前端项目常常改一行字也得先 `npm run build` 编译半天；这里不用，源码就是成品。好比**手写笔记本 vs 需要冲印的胶卷**：写完就能看，不用送去冲洗。
- **零依赖**——前端不装任何框架（没有 React/Vue）、不引打包工具，用的是浏览器**原生 ES Modules**。少一样外部零件，就少一个"三年后它自己坏掉"的风险。
- **离线可跑**——靠 Service Worker（浏览器里的"离线随身缓存包"）把页面存在本地，断网也能打开看上次的数据。

为什么这么拧巴地追求"简单"？因为这是**一个人维护**的项目。单人项目最大的死法不是"功能不够"，而是"某天它突然跑不起来了"。所以宁可朴素，也要保证 `git clone` 下来、双击 `index.html` 就能看。

前端之外，另配一个**可选的本地 Python 服务**（`backend/server.py`，只用标准库、零第三方依赖），给你补上「一键刷新 / AI 代理 / Obsidian 知识库」这些需要"联机干活"的能力。不想要？不开它，纯网页照样跑。

---

## 二、功能一览

侧边栏就是知识飞轮本身——**6 个视图，顺着「输入→捕获→沉淀→蒸馏→复用」排**（对应 v0.8.0 的 MVP 聚焦）：

| 视图 | 在飞轮里的角色 | 干什么 |
|---|---|---|
| **今日** | 捕获 + 复盘中枢 | 每日清单（自动带当天日报头条）+ 速记 / 待办 / 收藏（纯浏览器本地、不上传）+ **今日温故卡**：旧蒸馏经验卡按简化间隔重复(Leitner-lite)每天浮现，👍有用 / ✓已内化 / 打开 三态反馈，把"存了不用"变"会回头用"。 |
| **资讯** | 输入端 | AI 日报，每天约 08:30 自动抓当日 AI 资讯（模型 / 产品 / 行业 / 论文 / 技巧分栏），可点「让 AI 讲讲」。 |
| **收件箱** | 捕获层 | 刷到的链接 / 灵感**秒存**（自动识别平台，如小红书），一键「→蒸馏」转进蒸馏库；蒸馏完自动回标「已蒸馏」。 |
| **知识库** | 沉淀 | 读写本地 Obsidian 库（列目录 / 读笔记 / 搜索 / 沉淀），是所有内容的**权威副本**。 |
| **蒸馏库** | 蒸馏 | 把一条内容炼成**六维经验卡**（核心观点 / 方法步骤 / 适用场景 / 边界反例 / 可复用动作 / 出处），带平台 / 作者 / 主题筛选，落 Obsidian `蒸馏库/`。 |
| **AI 助手** | 贯穿全程 | 直接对话（经后端中转，绕开浏览器跨域）。 |
| **模型管理**（设置） | — | 模型配置读写（Supabase 云端多端共享，没配则退回浏览器本地）。 |

**通用体验**：浅色 / 深色主题一键切换并记住偏好 · 立即同步数据 · **桌面自适应**（宽窗双栏 / 窄窗单列）· **离线可开**（Service Worker 缓存）· 数据异常显示友好错误卡、不整页白屏。

> 🧰 **代码保留、暂未挂导航**（双向门，随时可恢复）：遥测三件套（系统状态 / 动态 / 能力速达）与课程表（Excel 导入）——它们对"看机器在干嘛"有用，但不推动知识在飞轮里流动，为 MVP 聚焦从侧边栏下架，`js` 文件与 `#view-*` section 全部保留。详见 [`docs/design/产品-IA评审.md`](docs/design/产品-IA评审.md)。

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

> **当前聚焦 PC 端**：原生/安卓 APK 移动交付已下线（见 [`docs/adr/0005-pc-first-drop-native-mobile.md`](docs/adr/0005-pc-first-drop-native-mobile.md)），飞轮功能成型后再回头做移动端。

工作台能落地成 **4 种形态**。别一股脑全上——先对号入座，看你是哪种情况：

| 你的情况 | 用哪套 | 一句话比喻 |
|---|---|---|
| 只想在电脑浏览器里看看 | **A · 纯静态本地** | 翻开笔记本就看 |
| 想要完整功能（刷新/AI/知识库） | **B · 本地全功能后端** | 给笔记本配个私人助理 |
| 想随时随地在线访问、还自动更新 | **C · GitHub Pages** | 把笔记本搬上云、还请人每天帮你续写 |
| 想装成 App（桌面/手机浏览器都行） | **D · PWA 安装** | 给网页穿件"App 马甲" |

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

### 场景 D · 装成 App（PWA 安装 · 桌面/手机通用）

- **适合谁**：想在桌面或手机主屏上有个图标，点开像原生 App，还能离线开。
- **怎么做**：用 Chrome/Edge 打开线上地址（场景 C），点地址栏右侧「安装」图标；手机浏览器则用菜单「**添加到主屏幕**」。
- **比喻**：给网页**穿了件"App 马甲"**——外表和真 App 没差，其实里子还是那个网页，所以它跟着线上版一起更新，不用重新下载。
- ⚠️ **原生 App / 安卓 APK（Flutter `mobile/` + TWA `twa/`）已下线**：一人维护并行多套 UI 成本最高，当前 PC-first；来日重做优先经"云收件箱中转"而非重起原生（见 ADR 0005）。

---

### 场景 E · 浏览器扩展捕获（读帖当场沉淀，推荐搭配场景 B）

刷小红书 / B站 / 微博 / 即刻时，**选中那段精华 + 写一句感悟**，一次点击存进「收件箱」，之后可一键升级成六维经验卡。

```bash
# 1) 先按场景 B 起后端（扩展要往它写）
python -m backend.server 8899

# 2) Chrome 打开 chrome://extensions → 右上「开发者模式」打开
#    → 点「加载已解压的扩展程序」→ 选本仓的 extension/ 目录
```

装好后三种用法：

| 入口 | 怎么用 | 适用 |
|---|---|---|
| **选中浮按钮** | 在小红书/B站/微博/即刻选中文字，旁边浮出「存到工作台」 | 四站读帖时最快 |
| **右键菜单** | 任意网页选中 → 右键「存到工作台收件箱」 | 知乎/公众号等**全站可用** |
| **工具栏图标** | 点扩展图标：快速存 + 改后端端口 + 开关浮按钮 + 看连接状态 | 无选区时 / 调设置 |

面板里 `感悟` 会自动聚焦（这是最该趁热写的），`⏎` 保存、`Esc` 取消。

- 扩展只往 `127.0.0.1` 写，**不联外网**；写端点有 Origin 允许列表，别的网页写不进来。
- 后端没起时会明确提示「工作台后端未启动」，不会静默丢数据。
- 数据落在仓根 `inbox.local.json`（已 gitignore，不会被提交）。
- 扩展**零站点解析**（只用选区 + `og:*` 元信息），平台改版不会失效；为什么自研而不用 Obsidian Web Clipper，见 [`docs/adr/0006`](docs/adr/0006-self-built-browser-extension-for-capture.md)。

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
# 或：Windows 小白双击 scripts/refresh.cmd（默认用 PATH 里的 python；要指定解释器就设环境变量 WB_PYTHON）
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
| `inbox` | `{path}`，捕获收件箱数据文件位置（浏览器扩展写入的落点） | 用仓库根 `inbox.local.json` |
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

版本戳由**内容 hash** 生成，不用手改数字、不会漏改。资产清单也不用手写——脚本**自动扫描** `js/**/*.js`、`css/`、`vendor/`、manifest 与 icons；新增 JS 文件只需加进 `sw.js` 的 `FILES` 预缓存列表，漏加或引用了已删文件，`--check` 同样报红。`--check` 是 **CI 硬门槛**——漏 bump 直接红灯，进不了主干。

---

## 八、幕后自动化（GitHub Actions）

`.github/workflows/` 下 4 个工作流，各司其职：

| 工作流 | 干什么 | 触发 | 跑在哪 |
|---|---|---|---|
| `ci.yml` | 质量门禁：`bump --check` + flake8 + pytest + `tsc --noEmit` | push/PR 到 main | GitHub 托管（ubuntu） |
| `deploy-pages.yml` | 把整仓发布成 GitHub Pages 网站 | push 到 main / 数据流水线跑完后 | GitHub 托管 |
| `sync.yml` | 每小时重抓真实数据、重建 `data.json` 并 push | cron `13 * * * *` | **自助 runner**（你的 Windows 机器） |
| `daily-ai.yml` | 每天约 08:30 抓当日 AI 资讯 | cron（北京 08:30） | **自助 runner** |

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
├── js/                            # app.js(入口) · kb/schedule/model-manager(经典脚本·window.WB)
│   │                              #   core/{net,state,util,icons,platforms} · types/(JSDoc)
│   │                              #   views/{info,distill,ai,dash/cap/sess/ov(下架保留)}
│   │                              #   features/{inbox(捕获),recall(温故),notes,todos,favs}
├── vendor/                        # marked.min.js（第三方：Markdown 渲染）
├── icons/                         # icon.svg · icon-192/512 · maskable-512
│  ── 数据 · 配置（前端 fetch 或后端产出，钉在根）──
├── data.json                      # 聚合快照（backend/pipeline/export_data.py 生成）
├── ai_daily.json  daily_news.json # 抓取的资讯数据
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
│   ├── clients/                   # supabase · kb（Obsidian vault）· inbox（捕获收件箱）
│   └── pipeline/                  # export_data · fetch_* · daily_ai · local_refresh · sync · sync_status
│  ── 浏览器扩展（捕获层，Chrome load unpacked，无需构建）──
├── extension/                   # manifest(MV3) · background(右键+fetch出口) · content(浮按钮+shadow面板) · popup · icons/
│  ── 文档 · 其它交付形态 · 自动化 ──
├── docs/                          # README(文档地图) · TECH_CHARTER · 版本管理规范 · adr/
│   │                              #   guides/ design/ planning/ research/ reference/（按 Diátaxis 改编分类）
├── scripts/                       # 本机启动/同步脚本（refresh·start_workbench·setup_runner·delete_workbench_tasks；解释器经 WB_PYTHON 环境变量指定，不含机器路径）
└── .github/workflows/             # ci · deploy-pages · sync · daily-ai
```

> 后端脚本作为 package 运行：`python -m backend.server 8080`、`python -m backend.pipeline.export_data` 等（详见各 workflow 与 `scripts/refresh.cmd`）。

---

## 十、文档索引

> 📑 **完整分类与命名规范见 [`docs/README.md`](docs/README.md)（文档地图·单一真源）**——docs 已按 Diátaxis 改编 + ADR 分为 `adr/ guides/ design/ planning/ research/ reference/`。下面只列最常翻的几篇：

- [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md) —— 技术宪章：北极星原则 + 模块边界红线 + 工程护栏 + 协作流程（改架构先翻它）。
- [`docs/planning/知识飞轮-路线图.md`](docs/planning/知识飞轮-路线图.md) —— 三层大脑模型 + 四阶段路线图（往哪走）。
- [`docs/adr/`](docs/adr/) —— 架构决策记录（单向门才写）：0001 零构建北极星 · 0002 原生 ES Modules 不上框架 · 0003 JSDoc+checkJs 而非全量 TS · 0004 经典脚本保留 window 桥接 · 0005 PC-first 弃原生移动端 · 0006 捕获层自研浏览器扩展。
- [`docs/design/知识库沉淀存储方案.md`](docs/design/知识库沉淀存储方案.md) —— Obsidian 沉淀存储设计。
- [`docs/design/捕获收件箱-浏览器扩展-设计.md`](docs/design/捕获收件箱-浏览器扩展-设计.md) —— 捕获环设计：摘录+感悟成对、扩展零站点解析、API 优先+离线队列。
- [`docs/guides/Supabase上线操作指南.md`](docs/guides/Supabase上线操作指南.md) · [`docs/reference/supabase_schema.sql`](docs/reference/supabase_schema.sql) —— Supabase 配置上线步骤 + 建表 DDL（前端永不持有 Supabase 密钥，全走本机 `server.py` 的 service_role key）。

---

## 十一、更新记录

变更记录统一维护在 **[`CHANGELOG.md`](CHANGELOG.md)**（遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) + 语义化版本）；「为什么这么做、代价取舍」见对应 `docs/design/` 设计文档与 `docs/adr/`；方向见 [`docs/planning/知识飞轮-路线图.md`](docs/planning/知识飞轮-路线图.md)。落位与写法规矩见 [`docs/版本管理规范.md`](docs/版本管理规范.md)。

**当前里程碑**：`v0.10.0`（2026-09-03）· **捕获环补齐**——浏览器扩展读帖当场存「摘录+感悟」，收件箱上后端（`inbox.local.json` 真源 + 离线队列）。（`v0.9.0`（2026-09-02）· **PC-first 收敛**——移除移动端原生/APK 交付、彻底删除下架视图（能力速达/系统状态/动态/课程表）与死代码，先把桌面端做扎实。）（`v0.8.0` · MVP 聚焦：侧边栏收敛到飞轮最窄闭环 6 视图、蒸馏库落下首张真实经验卡。）
