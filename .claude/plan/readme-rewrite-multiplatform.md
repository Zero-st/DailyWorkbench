# README.md 全面重写：详细 · 分平台部署 · 大白话比喻

## Context

用户要把 `README.md` 重写得**更详细、逻辑更清晰、条理更分明**，重点补齐**"不同平台部署"**，并**多用大白话比喻**让非专业读者也看得懂。现有 README 内容基本准确但有三处**结构/事实缺陷**：

1. **部署讲得零碎**——只讲了「本地预览」和「GitHub Pages」，但项目其实有 **6 种落地形态**（浏览器只读 / 本地全功能后端 / GitHub Pages 在线 / 手机 PWA / 安卓 APK(两种) / lite 纯静态版），读者不知道"我这种情况该用哪套"。
2. **有陈旧内容**：`cd personal-workbench`（旧目录名）、`python export_data.py`/`python daily_ai.py`（已改 package 运行 `python -m backend.pipeline.X`）、"两个本机计划任务 WorkbenchAutoSync/WorkbenchAiDaily 跑 sync.cmd"（现已改为 **GitHub Actions 自助(self-hosted)runner + cron**）。
3. **不够白话**：核心概念（零构建、SW 缓存、PWA、TWA vs Flutter、data.json 当库、bump 版本号）对小白不友好，缺比喻。

产出：一份重写后的 `README.md`，事实全部对齐当前代码，分场景讲清每种部署，语言口语化+比喻，但**不牺牲准确性**（技术宪章的北极星"零构建·零依赖·离线可跑"仍是主线）。

## 事实基准（已核查，写作依据）

- **本地全功能后端**：`python -m backend.server [port]`，默认端口 **8080**，只绑 `127.0.0.1`。比 `python -m http.server` 多出 `/api/refresh`（一键刷新）、`/api/chat`（AI 代理）、`/api/models`（Supabase 模型配置）、`/api/kb/*`（Obsidian 知识库）。
- **配置** `workbench.local.json`（从 `.example` 拷贝，gitignore）：`workspace / ollamaExe / disks / supabase{url,serviceKey} / kb{vault,depositRoot} / chatProxy{allowHosts}`。**全部可选**，每个键可被同名环境变量覆盖；不填就降级（Supabase→localStorage、无 vault→KB 返回 `configured:false`）。
- **GitHub Pages**：`deploy-pages.yml` 上传整仓 `path: .` → 固定地址 https://Zero-st.github.io/DailyWorkbench/ 。
- **自动更新（现状，非旧计划任务）**：**自助 runner**（`scripts/setup_runner.ps1` 注册本机为 `Zero-st/DailyWorkbench` 的 self-hosted runner）+ 两个 cron 工作流：`sync.yml`（每小时 `13 * * * *`，跑 `fetch_ai_daily`→`fetch_daily_news`→`sync` 重建 `data.json` 并 push）、`daily-ai.yml`（每天 UTC 00:30≈北京 08:30 跑 `daily_ai`）。`delete_workbench_tasks.cmd` 是清理**旧**计划任务的遗留脚本。
- **两个不同的 APK**（务必讲清区别，别混）：
  - **TWA 壳**（`twa/`，bubblewrap+gradle）：给线上网页套安卓壳，`build-apk.yml` 在 **GitHub 托管 runner(ubuntu)** `./gradlew assembleRelease`+`apksigner`→产物 `twa/workbench-signed.apk`，并发 Release `apk-<run#>`。
  - **Flutter 原生**（`mobile/`，`lite_workbench` 1.3.2+11）：**照着工作台重新写的原生安卓 App**，非网页壳。本机 `scripts/build-apk.bat` 跑 `flutter build apk --release --target-platform android-arm64`→`APK/app-release.apk`。
- **lite/**：**独立、纯静态**轻量版（自带 index/app/sw/manifest/icons），不依赖任何本机服务，直接从公开 API 取数据；单独静态托管即可。
- **改前端必做**：`python bump_version.py`（内容 hash 自动同步 `index.html`/`sw.js` 的 `?v=` 与 CACHE），`--check` 是 CI 硬门禁。
- **文档索引**：`docs/TECH_CHARTER.md`、`docs/adr/0001-0004`、`docs/guides/模型管理模块操作指南.md`、`docs/design/知识库沉淀存储方案.md`、`docs/guides/Supabase上线操作指南.md`、`docs/reference/supabase_schema.sql`。

## 目标 README 结构（章节大纲）

1. **标题 + 一句话定位**（比喻：一套代码就是你随身的"数字工作台",手机电脑同一副面孔）。
2. **这是什么 / 核心价值**——把"零构建·零依赖·离线可跑"用比喻讲透（像一本纸笔记本:不用装软件、不用连服务器、双击就翻;三年后工具链不腐烂）。保留技术宪章指针。
3. **功能一览**（在现有列表基础上润色，不删功能）。
4. **五分钟先跑起来**（最快路径:双击 `index.html` 看示例数据 / `python -m http.server 8080`;局域网手机预览）。
5. **★ 不同平台部署（核心新章）**——开头放一张"**你是哪种情况 → 用哪套**"对照表，然后 6 个场景各一小节，每节含【适合谁】【怎么做(命令)】【一句比喻】：
   - A 只想电脑浏览器看 → 双击 / `http.server`
   - B 想要完整功能(一键刷新/AI/知识库) → `python -m backend.server 8080`（列 `/api/*` 能力 + 配置指引）
   - C 想随时在线 + 自动更新 → GitHub Pages + 自助 runner + 两个 cron（讲清"装了新 skill 最多 1 小时后线上更新"的原理:data.json 走网络不缓存）
   - D 手机当 App 用 → PWA「添加到主屏幕」（比喻:给网页穿了件 App 马甲）
   - E 想要安卓 APK → **TWA 壳 vs Flutter 原生**两条路对比（比喻:套壳 vs 重盖房子），各自产物与构建入口
   - F 只要纯静态轻量版 → `lite/` 单独托管
6. **数据从哪来（data.json 契约）**——`data.json` 当"库"（比喻:拿一个记事本当账本)、`export_data` 产出、三处数据(文件/Supabase/localStorage)分工;更正为 `python -m backend.pipeline.export_data` 或双击 `scripts/refresh.cmd`。
7. **可选配置**（`workbench.local.json` 各键说明 + 三级覆盖 + 不填就降级）。
8. **改前端必做:bump 版本号**（比喻:改了货得贴新快递单号,否则快递员按老地址派旧货=用户吃旧缓存白屏;CI 硬门禁）。
9. **幕后自动化（GitHub Actions）**——列 5 个 workflow 各一行(ci/deploy-pages/sync/daily-ai/build-apk)+触发+跑在哪种 runner;讲一句"为什么用自助 runner"(要读本机 WorkBuddy 真实数据)。
10. **项目结构**（沿用现 README 里那棵已校准的分类树,基本不动)。
11. **文档索引**（docs/ 指针清单)。
12. **更新记录**（保留现有条目，顶部加一条本次"README 重写"）。

## 写作准则

- **准确优先于俏皮**:比喻是"帮理解"的调味,命令/路径/端口/产物名必须与事实基准一字不差。
- **每个部署场景都给可复制命令**,并显式标注"这步在你 Windows 机器/在 GitHub 跑"。
- **改掉 3 处陈旧内容**（旧目录名、旧脚本调用、旧计划任务叙述）。
- 中文为主,与现有 README 风格一致;markdown 表格用于"平台对照"和"配置键"两处。

## 验证

- README 是纯文档,无需跑测试;但要**回读全文**确认:① 所有命令与 `backend/`、`scripts/`、`.github/workflows/` 现状一致;② 无残留 `personal-workbench`/`export_data.py`(裸调)/计划任务旧说法;③ 6 种部署场景齐全、比喻不喧宾夺主;④ 内部链接(docs/ 各文件)路径正确。
- 交付后**不自动 push**——按项目惯例,提交/推送等用户明确要求。
