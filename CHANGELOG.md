# 更新日志 Changelog

本项目所有值得记录的改动都写在这里。

- 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
- 版本号遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/)；
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)。
- **本文件只记「做了什么」（简）**；「为什么这么做、代价与取舍」（详）见对应 `docs/` 设计文档与 `docs/adr/`；方向见 `docs/知识飞轮-路线图.md`。规则见 [`docs/版本管理规范.md`](docs/版本管理规范.md)。

版本语义（本项目，无对外 API）：**MAJOR**=北极星/架构级变化或破坏用户数据·URL｜**MINOR**=新模块/新能力｜**PATCH**=修 bug/小优化。`0.x` 表示仍在演进、未冻结。

---

## [Unreleased] · 下个版本目标

> 详见 [`docs/知识飞轮-路线图.md`](docs/知识飞轮-路线图.md)。当前方向：**先把"蒸馏闭环"彻底跑顺**，再拓宽飞轮。

- **补完蒸馏闭环剩余摩擦**（候选）：捕获侧"从链接到卡尽量一步"（后端直跑蒸馏）；复用端"相关时浮现"（按 topic/tag 匹配，非仅时间驱动）。
- **Phase 2 · 灵感留存 + 备份**（候选）：随手记灵感 → Obsidian `灵感/日期/`；Obsidian 库纳入 git 自动备份（复用 self-hosted runner）。
- 温故卡复用状态从 localStorage 迁到卡片 frontmatter（跨端持久，需后端"更新已存笔记 frontmatter"能力）。

---

## [0.6.0] · 2026-08-31 — 产品/IA 评审 + 知识飞轮复用端

**思路**：界面视觉已修（见 v0.5.0），但用户仍觉"产品/模块设计不合理"。经 `/brainstorming` 确认主心骨=**个人知识飞轮**，并诊断"整条飞轮从没跑通"→ 采用**"先跑通一条最窄闭环"**策略（walking skeleton），选中**蒸馏闭环**、先攻**复用端**（存了不用是知识库头号死法）。详见 [`docs/产品-IA评审.md`](docs/产品-IA评审.md)、[`docs/温故复用-设计.md`](docs/温故复用-设计.md)。

### Added
- **今日「温故」卡**（`js/features/recall.js`）：旧蒸馏经验卡按简化间隔重复(Leitner-lite)每天在「今日」浮现，👍有用/✓已内化/打开三态反馈；复用 `/api/kb/deposits` 与 `distillOpen`，纯前端 + localStorage，零后端零依赖。
- `docs/产品-IA评审.md`：13 模块过度碎片化诊断（仅 5 个日用）+ 收敛到 ~7 的重构提案（Nielsen/Krug/design-principles）。
- `docs/需求澄清工具选型.md`：需求澄清工具选型对比（spec-kit/BMAD/brainstorming，真实热度 + 安全评级）。
- `CHANGELOG.md` + `docs/版本管理规范.md`：建立版本管理体系。

### Fixed
- `distill.js` 4 处 `onclick` 漏外围引号（`fn(值)` 应为 `fn('值')`）——导致蒸馏库**筛选片/点卡开卡/平台选择**点击此前一直失效；已修并真机走查。

### Changed
- 知识飞轮路线图 / 项目总览回写本次方向共识。
- 工具链：本地引入 GitHub Spec-Kit 做需求澄清（`.specify/`、speckit 技能**不入库**，见 `.gitignore`）。

## [0.5.0] · 2026-08-31 — Phase 1 蒸馏库 + 界面优化

### Added
- **蒸馏库**视图（`js/views/distill.js`）：链接→skill 六维萃取→经验卡→落 Obsidian `蒸馏库/`，可筛选/检索；后端 `kb.save(extra)` + `GET /api/kb/deposits`（第 9 条 API）。(`6fb14d0`)
- `docs/界面设计准则.md`：codify 设计系统 v7 + 图标红线 + 新视图检查清单。(`d9d8380`)

### Changed
- 关键图标 emoji→内联 SVG（新增 `js/core/icons.js`；侧边栏 13 项迁移），修复缺 emoji 字体系统上的豆腐块。(`d9d8380`)

### Fixed
- 蒸馏库排版：补齐 10 个从未写 CSS 的类 + 全局 `.chip.on` 选中态（镜像 v7 现有组件）。(`d9d8380`)

## [0.4.0] · 2026-08-30 — 分层交付 + 文档化

### Changed
- 后端收敛为 `backend/{core,utils,clients,pipeline}` 分层 package；前端资源按类归位（`css/ js/ vendor/ icons/`）；本机脚本归 `scripts/`；Android/TWA 归 `twa/`。(`8f940dd` `360d4ee` `e392acc` `4c59646`)
- README 全面重写为分平台部署手册（大白话比喻）。(`6b180f0`)

### Added
- `docs/知识飞轮-路线图.md` + `docs/项目总览-需求与进度.md` + Phase1 计划。(`af8908b`)

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
