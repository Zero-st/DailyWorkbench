# 个人工作台（双端 PWA）

一套代码、手机 + 电脑都能用的个人工作台。**深色主题、响应式、可"添加到主屏幕"当 App 用**。前端**零构建 · 零依赖 · 离线可看**（原生 ES Modules，无框架/无打包）；另配一个**可选的本地 Python 服务**（`server.py`，标准库零第三方依赖）提供「立即刷新 / AI 代理 / Obsidian 知识库」等联机能力。

> 📐 **工程约定与技术选型见 [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md)**（技术宪章：北极星原则 + 模块边界 + 工程护栏 + 协作流程）。改架构请顺手更新它。

## 功能

- 顶部 KPI 指标条：Skills / 自动化 / 模型 / 记忆条目
- **能力速达**：本机能力卡片网格，点一下即复制调用指令；按实际使用频率排序并标 🔥
- **AI 日报**：每天 08:30 自动抓取当日 AI 资讯（模型/产品/行业/论文/技巧分栏），可直接点「让 AI 讲讲」
- **今日引导**：每日清单，会带上当天日报头条
- **状态看板**：自动化、模型、数据更新状态
- **我的速记**：随手记待办，纯浏览器本地存储，不上传
- **浅色/深色主题**：右上角一键切换，记住偏好
- 全局搜索、会话热力图（点格子看当天聊了啥）、立即刷新
- 手机竖屏单列、电脑宽屏双栏；离线可开（Service Worker 缓存）

## 本地预览

直接双击 `index.html` 即可看（此时用内置示例数据）。

要接真实数据或测试 PWA 安装，建议起一个本地服务器：

```bash
cd personal-workbench
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 手机预览同一局域网：电脑和手机连同一 WiFi，手机浏览器开 `http://<电脑内网IP>:8080`。

## 数据注入（接 WorkBuddy 真实数据）

面板默认读同目录下的 `data.json`。把 WorkBuddy 的 skills / 自动化 / 模型 / 记忆导出成如下结构即可：

```json
{
  "kpi": { "skills": 44, "automations": 3, "models": 6, "memory": 128 },
  "skills": [
    { "name": "技能名", "desc": "一句话说明", "cmd": "复制给 AI 的指令" }
  ],
  "guide": ["今日引导项 1", "今日引导项 2"],
  "status": {
    "skillsLastUpdate": "2026-08-02",
    "automations": [{ "name": "名称", "next": "下次时间" }],
    "models": [{ "name": "模型名", "type": "本机|云端" }],
    "memoryLastUpdate": "2026-08-02"
  }
}
```

## 接真实数据（一键刷新）

面板默认读同目录 `data.json`。已内置 `export_data.py`，自动从本机 WorkBuddy 抓取真实数据生成 `data.json`，覆盖示例：

- **Skills**：扫描 `C:\Users\13115\.workbuddy\skills\`，读取每个 SKILL.md 的 frontmatter（名称/描述）
- **自动化**：读 `C:\Users\13115\.workbuddy\workbuddy.db`，只取未删除的活跃任务，算下次运行时间
- **模型**：读 `C:\Users\13115\.workbuddy\models.json`，按 `localhost` 自动标记「本机/云端」
- **记忆**：统计 `D:\Users\qingdeng-ws\.workbuddy\memory\` 文件数
- **今日引导**：根据真实自动化动态生成

**运行方式**（二选一）：

```bash
# 方式 A：命令行
python export_data.py

# 方式 B：小白双击 refresh.cmd（已配好托管 Python 路径，跑完自动刷新）
```

跑完刷新浏览器，工作台即显示最新真实数据。

## 部署（GitHub Pages，固定地址 + 自动同步）

- **线上地址（固定，推荐）**：https://Zero-st.github.io/DailyWorkbench/
- 仓库（公开）：https://github.com/Zero-st/DailyWorkbench
- 手机 / 电脑浏览器直接开；手机浏览器菜单「添加到主屏幕」即变成 App，离线也能开。
- **自动同步（核心）**：两个本机计划任务
  - `WorkbenchAutoSync` —— 每小时跑 `sync.cmd`，重抓本机真实数据 → `git push`。装了新 skill / 加了新自动化，最多 1 小时后线上更新。
  - `WorkbenchAiDaily` —— 每天 08:30 跑 `daily_ai.py`，抓当日 AI 资讯 → 重生成 data.json → `git push`。已开「错过则尽快补跑」「电池模式也跑」。
- 原理：`data.json` 已改为「永远走网络、不缓存」（见 sw.js）；两个任务都用本机 git 凭据（credential.helper=store）自动推送。
- 想立刻更新：双击 `sync.cmd`，或命令行 `python daily_ai.py`（含日报）。

### 改前端必做：bump 版本号（已自动化）
Service Worker 会缓存静态资源，改了前端却不更新版本戳，用户端会一直吃旧缓存、「页面裸掉」。**改完 `styles.css` / `app.js` 等前端资产后，跑一次：**

```bash
python bump_version.py        # 按文件内容 hash 自动同步 index.html + sw.js 的 ?v= 与 CACHE
python bump_version.py --check # 只校验是否同步（CI 会跑，不一致直接失败）
```

版本戳由内容 hash 生成，不再手改数字、不会漏改。CI 的 `bump_version.py --check` 是硬门槛，漏 bump 直接红。push 后要等 **30-50 秒** GitHub Pages 才构建完，别立刻 curl 验证。

### （备选）CloudStudio 静态快照
- 之前用 `cloudstudio-deploy` 部署过（链接形如 `https://<id>.sh4.agentos-app.net`）。**它是静态快照，需手动重部署才更新**，已主用 GitHub Pages，此方案仅作备份。
- 管理/删除已发布应用：WorkBuddy「设置 - 数据管理 - 我发布的应用」

## 文件结构

> 按类分区。前端因 GitHub Pages「从仓库根部署」（`deploy-pages.yml` 上传 `path: .`）+ 文档相对路径而**钉死在根**；后端已收敛为分层 Python package。详见 [`docs/TECH_CHARTER.md`](docs/TECH_CHARTER.md)。

```
DailyWorkbench/
│  ── 前端 PWA（钉死在根：Pages 根部署 + 相对路径）──
├── index.html                     # 唯一 HTML 入口
├── app.js                         # ES Module 主入口（装配 + boot + window 桥接）
├── js/                            # 前端模块：core/(util·state·net) views/(各视图) features/(notes·todos·favs)
├── styles.css                     # 深色/浅色主题 + 响应式
├── schedule.js kb.js model-manager.js  # 经典脚本（课程表 / 知识库 / 模型管理，window.WB 桥接）
├── vendor/marked.min.js  xlsx.full.min.js   # 第三方（Markdown / 课程表导入·懒加载）
├── sw.js  manifest.json  icon*.{svg,png}    # Service Worker / PWA 配置 / 图标
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
├── twa/                           # Android TWA 构建（bubblewrap + gradle）
├── lite/  mobile/                 # 轻量版 PWA（独立分叉）/ Flutter 移动端
├── refresh.cmd start_workbench.cmd run_refresh.vbs setup_runner.ps1  # 本机启动 / 同步（含机器路径）
└── .github/workflows/             # ci · deploy-pages · sync · daily-ai · build-apk
```

> 后端脚本作为 package 运行：`python -m backend.server 8899`、`python -m backend.pipeline.export_data` 等（详见各 workflow 与 `refresh.cmd`）。

> 为什么 `daily_ai.py` 是 Python 而不是 `.cmd`：cmd.exe 走 GBK 代码页，含中文的 UTF-8 批处理会直接崩溃（实测退出码 `-1073741510`，脚本第一行都跑不到）。Python 无此问题。

## 更新记录

### 2026-08-17 · 网页端 PWA 健壮性 & 交互打磨
- **防白屏（健壮性）**：新增 `normalizeData()` 兜底 `data.json` 缺字段（`kpi` / `status` / `skills` / `sessions` / `aiDaily` / `dailyNews` / `weekly` / `guide` / `knowledge` 等）；`render()` 包裹 `try/catch`，数据异常时显示友好错误卡而非整页空白。
- **弹窗统一（一致性）**：`aiClear` / `aiMemoryClear` 的原生 `confirm` 与 `aiSend` 无 Key 提示统一改为自定义 `WB.dialog`，风格一致且不被浏览器拦截。
- **交互增强（体验）**：新增快捷键 `/` 聚焦搜索框、`Esc` 关闭热力图详情；新增离线提示条（`offline` / `online` 事件 + 初始在线状态检测，复用 Service Worker 离线缓存）。
- **版本 bump（部署纪律）**：`index.html` `?v=62→63`、`sw.js` `CACHE workbench-v76→v77`（静态资源版本号三处一致，避免用户端吃旧缓存）。
