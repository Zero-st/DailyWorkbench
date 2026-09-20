# profile：DailyWorkbench（个人工作台 · 零构建本地单页应用 + 轻后端）

> 本 profile 是 `_TEMPLATE.md` 的**裁剪版**：DailyWorkbench 没有登录体系、没有角色体系、没有业务单据与关系库，
> 模板中「登录 / 凭据 / 切角色 / 写路径联调 / 数据库核对」五节在本项目**结构性不适用**，
> 已逐节标注「不适用」并给出本项目的等价替代物。**不要**照 iris-ecnu / iris-wust 的形状硬套。

## mode

**默认 `read-only-walkthrough`（只读走查），且本项目基本只用这一种。**

本项目的"写"不是业务单据，而是**会改本地数据/花钱/污染知识库**的前端动作。因此：

- 允许：浏览、切视图、切主题、开合 dock、读控制台/网络、截图、只读 `evaluate_script` 读取 DOM 与状态。
- **禁止调用**（会写盘 / 发外部请求 / 花钱）：
  `recallOpen` `recallUseful` `recallArchive` `distillSave` `distillRun` `kbSave` `kbSaveChat` `kbSaveReview`
  `inboxAdd` 及一切 `inbox*` `refreshData` `selfCheck` `backupImport` `exportAll` `addLink` `delLink`
  `modelDelete` `modelSetActive` `saveModelForm` `aiSend` `aiAsk` `dockAsk` `infoSem`
- **两个只读陷阱（务必记住）**：
  1. `wb_inbox` 非空时**切到收件箱视图**会把离线队列 `POST` 出去——切 `inbox` 前先读 `localStorage.wb_inbox`，非空则跳过该视图并在报告里记「⚪ 未走查：收件箱（离线队列非空，切入会触发写）」。
  2. `infoSem()` 会调外部 embedding 接口**产生真实费用**，任何情况下不主动调。
- **页面加载本身就会 `POST /api/models`**——这是应用自发行为，不是走查造成的写，看到不要误报。

**核对手段**：本项目**没有数据库可 SELECT**。核对真值的替代手段是——
读 `data.json` / `workbench.local.json`（只读 `cat`）、读 `localStorage`、看 `/api/*` 响应体，**不看前端 toast**。

**作用域红线**：本机 `/home/dev_st/mtools/DailyWorkbench` 是**个人工作副本，非多人共享环境**，
但 `kb.vault` 指向真实 Obsidian 库 `/home/dev_st/mtools/devmd`——**绝不**通过走查写入该库。
分不清某个动作会不会落盘 → **停下报告**，不试。

### 写路径流程

**不适用。** 本项目无「新增→提交→审核→退回」业务链路，无单据主键，无禁自审/组织隔离规则。
确需验证某个写动作（如蒸馏落盘）时，不走本 skill，改用 `docs/开发测试规范.md` 的最小测试先行流程在后端侧验证。

## 环境 / 前置

- **走查前置（必做，否则打到静态源或旧代码）**：
  1. 起后端（仓库根，**不能** `python backend/server.py`，包导入会失败）：
     `cd /home/dev_st/mtools/DailyWorkbench && /home/dev_st/iriswork/tools/anaconda/bin/python -m backend.server 8899`
  2. 探活：`GET /api/inbox/ping`（**本项目没有 `/api/health`**）。
  3. 改过 `backend/*.py` → 必须重启后端（stdlib `http.server` 不热载）：`pgrep` 拿数字 PID → 排除 `$$` → `kill <pid>` → 同命令重拉。**绝不 `pkill -f`**（会匹配到自己 shell 命令行导致自杀，exit 144）。
  4. 改过 `css/ js/ index.html` → 先跑 `python bump_version.py`，否则浏览器吃旧缓存，走查看到的是上一版。
  5. 令牌门禁 `python check_design_tokens.py` 应为绿——视觉走查前先跑，避免把「引用未定义变量」当成渲染 bug 报。
- **前端无构建**（零构建北极星，ADR 0001/0010），改完刷新即生效，无编译步骤。
- **多实例/分流**：不适用，单实例本地后端。
- `baseUrl`：`http://127.0.0.1:8899/index.html`（环境类型：本机 dev；页面不热加载，改资产靠 `bump_version.py` 破缓存）。
- **必须从后端源打开**：直接开静态文件或 GitHub Pages 页，`/api/chat` 等端点不可达会报 **"Failed to fetch"**——**这是预期行为，不是 bug**，见到即说明打开方式错了，别记成缺陷。

### 浏览器驱动方式（本项目特有，照做否则卡死）

- 调试 Chrome 常死，先 `systemctl --user start chrome-mcp.service`，之后 MCP 每次调用自动重连 19222。
- **绝不 `new_page(目标URL)`、绝不 `navigate` reload**：本页是带 service worker + 定时轮询的 SPA，**网络永不 idle**，这类调用会等"网络空闲"直到超时卡死。
- 正确姿势二选一：
  - 已有标签：`list_pages` 找到 `个人工作台 http://127.0.0.1:8899/index.html` 标签 → `select_page`。
  - 新开标签：`new_page("about:blank")` → `evaluate_script(waitForStableDom:false)` 里设 `location.href`。
- 之后一律用 `evaluate_script(waitForStableDom:false)` 驱动挂在 `window` 上的真实处理器。
- `take_screenshot` 的 `filePath` **只能落工作区根（DailyWorkbench）内**，`~/桌面/comtools/tmp` 会被拒——省事就不传 `filePath` 走内联返回。
- 调试 Chrome 时区是 America/Los_Angeles（systemd 用户服务无 `TZ`），**页面时钟显示 01:xx 不是 bug**，别误报。
- **本机是多用户共享机**：`pgrep -cf chrome-devtools-mcp` 可能数到上百，绝大多数属于别的用户，**无权也不该 kill**；只处理自己 uid（先 `id -un`）的进程。
- **非交互 / auto-mode 会话限制**：chrome-devtools MCP 调用（连 `list_pages`）会被权限分类器直接拒绝；退而起独立 `--headless=new` 时连不到 `127.0.0.1` 端口（沙箱网络限制，`--no-proxy-server` 无效）。
  → **浏览器走查必须在交互会话里跑**。非交互会话中触发本 profile：**停下报告「需交互会话」**，不要浪费预算绕。

## 凭据来源

**不适用。** 本项目无登录、无账号、无验证码，无需 `walkthrough-accounts.json`。

唯一的敏感文件是 `workbench.local.json`（含 supabase service_role key，已 gitignore）——
走查中**只读不改，密钥绝不出现在报告 / 截图 / 任何输出里**。截图若可能带出密钥，改为文字描述。

## 切角色

**不适用。** 本项目无角色、无 `roleId`、无角色选择页、无权限隔离面。

等价的"面"是**视图 + 主题 + dock 三组状态**，走查时按此遍历（`evaluate_script` 驱动）：

- 视图（6 个，`switchView(...)`）：`home` `info` `inbox` `kb` `distill` `models`
  - `inbox` 受上文只读陷阱 1 约束，先查 `localStorage.wb_inbox`。
  - **没有 `ai` 整页视图**了（已改为右侧全局浮游 AI 副驾 dock）；代码里残留的 `switchView("ai")` 不是可走查的视图。
- 主题（`toggleTheme()`，**三态循环**）：亮 / 暗 / 跟随系统。**深色模式是已知缺陷高发区**（曾测出对比度 1.1:1），每个视图都要在深色下看一遍。
- dock（`dockOpen()` / `dockClose()`）：开合各看一次，重点看**浮游层是否遮挡内容、缩放后布局是否错乱**。

走查矩阵 = 6 视图 × 亮/暗 2 主题（+ dock 开合抽查），而非"每账号 × 每角色"。

## 数据核对

**不适用关系库。** 本项目无 Oracle/MySQL，无数据库 MCP。替代手段：

- `data.json`：前端数据契约真源（**9 键**，改契约 = 单向门需写 ADR），只读 `cat` 比对页面渲染是否一致。
- `localStorage`：`wb_inbox` 等前端状态，用只读 `evaluate_script` 读取。
- `/api/*` 响应体：经 `list_network_requests` / `get_network_request` 看，不看 toast。
- Supabase（模型配置云端真源）与 `kb.vault`（devmd 库）：**只观察不写入**。

## 落盘

- 报告：调用方给了任务目录时 `Write` 落到 该目录/`walkthrough-report.md`（**唯一允许 Write 的文件**），并在返回文本同时给正文；没给目录只返回文本。
- 截图：存到 `docs/reference/devhtml/walkthrough/screenshots/`（在工作区内，符合 `take_screenshot` 的 `filePath` 限制）；文件名带 视图+主题，如 `info-dark.png`。
- 走查产出的**分析类文档**若要长期留存，按 `docs/README.md` 的后缀词表落位并补它的 §4 索引；实施计划类走 `.claude/plan/`。

## 预算

- 单次走查浏览器操作 **≤ 40 步**（6 视图 × 2 主题 + dock 抽查 + 截图，正常约 25–35 步）；接近即收敛、立即出报告。
- 同一操作连续 2 次无进展 → 记「受阻：现象」跳过，继续下一项，绝不空转。
