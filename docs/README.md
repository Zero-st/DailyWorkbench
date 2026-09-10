# 文档地图 · docs/ 分类与归位规范

> 性质：**活文档 · 单一真源**。所有「项目文档该放哪、怎么命名」以本文为准。
> 新增/移动文档后，回来更新下方索引与决策表。配套：仓库内 `.claude/skills/doc-filing`（新建文档时自动套用本规范）。

---

## 0 · 方法论依据（非拍脑袋）

- **Diátaxis**（[diataxis.fr](https://diataxis.fr/)，Python/Canonical 采用）——借其 *how-to / reference / explanation* 三态。**改编说明**：本仓文档多为**内部决策/过程产物**（路线图、ADR、复盘、选型），Diátaxis 的 tutorial 象限不适用，不硬套。
- **ADR**（[adr.github.io](https://adr.github.io/) / M. Nygard）——决策记录放 `adr/NNNN-<kebab>.md`。
- **Keep a Changelog**（[keepachangelog.com](https://keepachangelog.com/)）——版本变更集中在**仓库根** `CHANGELOG.md`，倒序。
- **Docs-as-code**——本文即「文档落地页」，让分类可检索、可维护。

---

## 1 · 分类树（哪类文档进哪个文件夹）

```
docs/
├─ README.md            ← 本文·文档地图（单一真源）
├─ TECH_CHARTER.md      治理·留根：技术宪章（北极星/选型原则）
├─ 版本管理规范.md        治理·留根：版本/commit/文档落位约定
├─ 开发测试规范.md        治理·留根：最小测试先行、全绿再跑全量
├─ principles/          心法 & 方法论：跨产品/设计/工程的「何时戴哪顶帽子」总纲（宪章之上）
├─ adr/                 决策记录（Architecture Decision Records，单向门才写）
├─ guides/              操作指南（how-to）：一步步「怎么做」的手册
├─ design/             设计 & 评审（explanation）：为什么这么做、代价取舍、方案/评审
├─ planning/            方向 & 进度 & 复盘：路线图、总览、里程碑复盘
├─ research/            选型 & 调研：工具/skill 对比、账本、工具链地图
└─ reference/           参考 & 产物：schema、生成的 html（devhtml/）等查阅material
```

**治理三篇留 `docs/` 根**（`TECH_CHARTER.md`、`版本管理规范.md`、`开发测试规范.md`）：它们是「宪法」级、被全仓广泛引用，单列一层反而增加跳转成本。

---

## 2 · 命名规范

### 文件夹
全小写英文 kebab：`adr guides design planning research reference`。（历史目录 `reference/devhtml/` 沿用旧名。）

### 文件：中文语义名 + **标准后缀词表**
沿用仓内既有约定（`版本管理规范.md` 早已 glob `docs/design/*-设计.md`）。**后缀决定去哪个文件夹**：

| 后缀 | 含义 | 归属目录 |
|---|---|---|
| `-路线图` `-总览` `-复盘` | 方向 / 进度 / 里程碑复盘 | `planning/` |
| `-设计` `-评审` `-方案` | 设计说明 / 评审 / 存储方案 | `design/` |
| `图解-<模块>` | 单功能图解复盘（架构/实现原理/业务流程三图） | `design/功能图解/` |
| `-选型` `-地图` `-账本` | 调研对比 / 工具链 / 选型账本 | `research/` |
| `-指南` | 操作步骤手册（how-to） | `guides/` |
| `-心法` `-总纲` / 跨维度方法论·原则 | 何时戴哪顶帽子、判据 | `principles/` |
| `-规范` `宪章`/`TECH_CHARTER` | 治理约定 | `docs/`（根） |
| `NNNN-<kebab>` | 决策记录 | `adr/` |
| `*.sql` / 生成 `*.html` | 参考物 / 产物 | `reference/` |

**英文名例外**：跨社区标准名保留英文——`TECH_CHARTER` / `README` / `CHANGELOG` / ADR 编号 / `*.sql`。

---

## 3 · 「新文档去哪」决策表

1. 是**单向门决策**（不可逆、要留证）？→ `adr/NNNN-<kebab>.md`。
2. 是**实施计划 / 待办规划**（"接下来怎么改代码"）？→ **不进 docs/**，放 `.claude/plan/<task>.md`（见用户全局约定）。
3. 是**版本变更记录**？→ 仓库根 `CHANGELOG.md`，不新开文件。
4. 否则按**后缀词表**（§2）落对应子目录：讲「怎么做」→`guides/`；讲「为什么/怎么设计」→`design/`；「选型/调研」→`research/`；「方向/进度/复盘」→`planning/`；「schema/产物」→`reference/`；**跨产品/设计/工程的方法论·心法（何时戴哪顶帽子）**→`principles/`。
5. 拿不准 → 先看现有同类落在哪个目录，就近归位；仍不确定就默认 `design/`（解释类），事后可迁（双向门）。

**分工边界**：`docs/` = 沉淀下来的**项目知识**；`.claude/plan/` = 过程性的**实施计划**；仓根 `README.md`/`CHANGELOG.md` = 社区标准位置。三者不混。

---

## 4 · 现有文档索引

| 文档 | 目录 | 是什么 |
|---|---|---|
| [TECH_CHARTER.md](TECH_CHARTER.md) | 根 | 技术宪章：北极星（零构建·依赖极简可撤回·本地起服务即可跑，ADR 0010 修订）与选型原则 |
| [版本管理规范.md](版本管理规范.md) | 根 | 版本 / commit / 「what 与思路落在哪」约定 |
| [开发测试规范.md](开发测试规范.md) | 根 | 最小测试先行：静态门→纯逻辑→单点接口→小样→全绿再全量；含已知坑点清单 |
| [开发心法-多维思维总纲.md](principles/开发心法-多维思维总纲.md) | principles | 宪章之上的心法：四顶帽子（产品/设计/工程/决策）× 何时戴 + 产品帽判据 |
| [AI时代程序员成长-心法.md](principles/AI时代程序员成长-心法.md) | principles | 姊妹篇：AI 替你写代码之后人该长哪些肌肉——定价表 / 四杠杆 / 五转变 / AI 放大的坑 / 练习节律 |
| [产品思维-心法.md](principles/产品思维-心法.md) | principles | 第三姊妹：产品判断力怎么练——五根判断轴 + 平台采矿手册（GitHub/X/中文博主/小红书）+ 真实案例卡（均可核实） |
| [adr/](adr/) | adr | 0001 零构建北极星 · 0002 ES 模块无框架 · 0003 JSDoc 而非 TS · 0004 经典脚本保留 window 桥 · 0005 PC-first 弃原生移动端 · 0006 捕获层自研浏览器扩展 · 0007 采纳 OpenCLI 作取数层源 · 0008 MCP 集成层工具化（in-repo，不进运行时） · 0009 页面驱动 agent（subprocess `claude -p` + SSE 流式，只读白名单 + 人工写闸） · 0010 松绑「零依赖」为「依赖极简且可撤回」（修订 0001；构建步骤仍是单向门） · 0011 引入 Zilliz Cloud 向量库做资讯语义检索（REST/urlopen·BYO embedding·扩 data.json 契约=单向门） |
| [知识飞轮-路线图.md](planning/知识飞轮-路线图.md) | planning | 三层大脑模型 + 四阶段路线图（方向盘） |
| [项目总览-需求与进度.md](planning/项目总览-需求与进度.md) | planning | 一页总账：需求 / 已完成 / 待优化 / 待完成 |
| [复盘-MVP闭环首跑.md](planning/复盘-MVP闭环首跑.md) | planning | 蒸馏库 0→1 首张真实经验卡的里程碑复盘 |
| [复盘-dogfood冲刺-W1.md](planning/复盘-dogfood冲刺-W1.md) | planning | 产品帽 dogfood 一周：每日日志 + 摩擦清单 + 三门筛选 → 决定下一个功能 |
| [复盘-OpenCLI取数层接入.md](planning/复盘-OpenCLI取数层接入.md) | planning | 把 OpenCLI 作可劣化取数层接入的里程碑复盘：执行步骤 / 优雅劣化实测 / 踩坑 / 可迁移的「外部取数源接入」心智模型 |
| [运行时架构-数据流.md](design/运行时架构-数据流.md) | design | 一页架构总图（mermaid）：前端↔后端↔data.json 契约↔三大脑 + 数据流 |
| [界面设计准则.md](design/界面设计准则.md) | design | **本仓的 DESIGN.md**：设计系统 v7 索引 + 令牌健康度基线（`check_design_tokens.py` 产出）+ 效果图门禁 + 图标红线 + 新视图检查清单 |
| [温故复用-设计.md](design/温故复用-设计.md) | design | 「今日温故卡」复用抓手设计（Leitner-lite） |
| [产品-IA评审.md](design/产品-IA评审.md) | design | 信息架构评审 + 收敛提案 |
| [工作台走查评审-v0.8.0.md](design/工作台走查评审-v0.8.0.md) | design | chrome-devtools 全链路走查 + 分层优化 backlog |
| [捕获收件箱-浏览器扩展-设计.md](design/捕获收件箱-浏览器扩展-设计.md) | design | 捕获环设计：选中摘录+感悟成对、扩展零站点解析、inbox.local.json 真源、API 优先+离线队列 |
| [知识库沉淀存储方案.md](design/知识库沉淀存储方案.md) | design | Obsidian 沉淀写入侧存储规范 |
| [资讯语义检索-设计.md](design/资讯语义检索-设计.md) | design | 资讯 enrich(摘要+标签+向量)→Zilliz 语义检索：第一性原理+流程/时序图+契约+配置+回滚（ADR 0011） |
| [功能图解/图解-页面驱动agent.md](design/功能图解/图解-页面驱动agent.md) | design/功能图解 | 单功能图解复盘**样板**：页面驱动 agent(ADR 0009) 的架构切片 / 时序 / 业务流程三图 |
| [业务功能开工-图先行指南.md](guides/业务功能开工-图先行指南.md) | guides | **开工准则**：动手前按不确定性分档，先思维导图捋业务→再流程图/时序图定实现思路+先定契约，再写码(软自检·图可抛)；与图解复盘闭环 |
| [功能图解复盘-指南.md](guides/功能图解复盘-指南.md) | guides | 每个功能模块「一图三看」怎么写：何时写 + 三图规格(mermaid 起手式) + 模板骨架 + 归位 `design/功能图解/` |
| [模型管理模块操作指南.md](guides/模型管理模块操作指南.md) | guides | 模型管理模块操作手册 |
| [Supabase上线操作指南.md](guides/Supabase上线操作指南.md) | guides | Supabase 接入 / 上线步骤 |
| [需求澄清工具选型.md](research/需求澄清工具选型.md) | research | 需求澄清工具对比账本 |
| [工具链-MCP与Skill地图.md](research/工具链-MCP与Skill地图.md) | research | 本项目用过的 MCP / Skill × 开发阶段 |
| [开发阶段-Skill选型账本.md](research/开发阶段-Skill选型账本.md) | research | 通用 Skill / MCP / SDD 选型账本 |
| [蒸馏方法论-开源参考地图.md](research/蒸馏方法论-开源参考地图.md) | research | 蒸馏「知识工艺层」调研：三空白诊断 + fabric pattern 结构 + 打分 rubric + 提示词骨架 + 方法论框架 + 最小落地路径 |
| [接入deepseekHarness-选型.md](research/接入deepseekHarness-选型.md) | research | 工作台作为工具接入 DeepSeek harness 的可行性评估：谁调谁的心法 + 三条路径对比(bash·tool 插件·MCP server) + 坑位；**路径③已落地为 Claude Code 变体**（ADR 0008，in-repo `backend/mcp/`） |
| [reference/supabase_schema.sql](reference/supabase_schema.sql) | reference | Supabase 表结构 |
| [reference/devhtml/](reference/devhtml/) | reference | 生成的 html 产物（产品评分卡、运行时架构-交互版[archify]、餐厅里的软件工程[零基础讲解] 等） |
