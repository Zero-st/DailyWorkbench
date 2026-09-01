# 工具链地图：MCP + Skill × 开发阶段

> 版本：v1.0　制定：2026-08-31
> 定位：**本项目开发过程中「用了哪些 MCP / Claude Code Skill、各对应软件工程哪个阶段」的复盘账本 + 换机复用手册。**
> 性质：**reference**。
> 关联：[`需求澄清工具选型.md`](需求澄清工具选型.md)、[`开发阶段-Skill选型账本.md`](开发阶段-Skill选型账本.md)（通用·GitHub 优质 skill/MCP 选型）、[`知识飞轮-路线图.md`](../planning/知识飞轮-路线图.md)、[`项目总览-需求与进度.md`](../planning/项目总览-需求与进度.md)、[`界面设计准则.md`](../design/界面设计准则.md)、[`版本管理规范.md`](../版本管理规范.md)。

---

## 0 · 一句话 + 怎么用这份文档

**换机复用的关键不是「搬配置文件」，而是「重开一轮对话 + 把 spec-kit 装回来 + 记住这几个触发词」。**

⚠️ 先记一条最重要的事实：**本仓库里没有 `.mcp.json`、没有 `.claude/settings.json`、没有项目级 `CLAUDE.md`。**
MCP 与 Skill 的使用**从来不是靠项目配置文件声明的**——它们散落在 `docs/`、`.claude/plan/`、commit message、
以及 spec-kit 自己生成的 `.specify/` 元数据里。这份文档就是把这些「隐性使用」显式化、集中化，
本身就是换机时缺的那块拼图。

怎么用：
- **想复盘**：看 §1 总览表，一眼扫清「哪个能力对应哪个阶段、有什么证据」。
- **想换机**：看 §2 逐项工具卡里的「换机怎么装 + 怎么触发」，以及 §3 换机速查清单。
- **想追证据**：每一行都标了出处（commit / plan / doc / `.specify`），可回仓库核对。

---

## 1 · 总览表：MCP / Skill × 开发阶段

阶段轴：**需求澄清 → 设计/架构 → 实现 → 内容/数据管道(业务运行时) → 验证/走查 → 发布/运维**。

| 能力 | 类型 | 对应阶段 | 本项目怎么用 | 换机是否要装 |
|---|---|---|---|---|
| **`/brainstorming`** | 内置 Skill（Anthropic 第一方） | 需求澄清 | 定方向：确认主心骨=个人知识飞轮、"先跑通最窄闭环" | 否（换到任意 Claude Code 即有） |
| **GitHub Spec-Kit（`speckit-*` ×10）** | 官方 Skill（github/spec-kit） | 需求澄清 / 设计 / 实现 / 发布 | 需求澄清（`/clarify`）为主；全套 `specify→plan→tasks→implement` 可选 | **要**（`uvx specify init`，装完 gitignore） |
| **`design-principles`** | 社区/内置 Skill（设计行动卡） | 设计/架构 · 代码评审 | 设计与 IA 评审时对经典原则（YAGNI 等）；产品-IA 评审引用 | 视来源（第一方免装 / 社区需装） |
| **`database-designer`** | 社区 Skill | 设计/架构（数据建模） | Supabase 表设计 / schema（**推断，弱证据**） | 需装（若确用） |
| **`chrome-devtools`** | **MCP server（本项目唯一确凿使用的 MCP）** | 验证/走查 | 每次前端改动后真机走查：明暗双主题×多视图，`list_console_messages` 查报错 | **要**（在目标环境启用该 MCP server） |
| **`creator-video-decoder` / `video-cangjie-distill`** | 社区 Skill | 内容/数据管道（**业务运行时，非建设阶段**） | 蒸馏库让用户复制指令去拆解 B站/小红书视频 | 需装（用到蒸馏功能时） |
| **`baoyu-url-to-markdown`** | 社区 Skill | 内容/数据管道（**业务运行时**） | 蒸馏库：抓取图文/文章转 markdown | 需装（用到蒸馏功能时） |
| **mermaid 图 / `diagram-render`** | MCP 或 Skill（**可选**） | 设计/架构（画图） | `产品-IA评审.md` 里有 mermaid 图（是否经 MCP 生成证据不足） | 可选 |

> 说明：表里前 5 行是**用来「建设」本项目**的能力（对应 SDLC 阶段）；`creator-video-decoder` 等三件套是
> **本项目「功能运行时」才去调**的 skill——严格说不属于开发阶段，但你确实用到了，故单列并标清楚（见 §2.6）。

---

## 2 · 逐项工具卡

每张卡：**是什么 / 属哪阶段 / 本项目怎么用（带证据）/ 换机怎么装+怎么触发 / 代价与红线**。

### 2.1 内置 `/brainstorming`（需求澄清·起点）
- **是什么**：Anthropic 第一方内置 skill，对话式逐点追问、帮你把模糊想法收敛成结构化结论。
- **属阶段**：需求澄清 / 构思。
- **本项目怎么用**：定方向的主力。CHANGELOG v0.6.0 与 `知识飞轮-路线图.md` 记载：经 `/brainstorming` 确认
  主心骨=个人知识飞轮，采用"先跑通一条最窄闭环"策略。
- **换机怎么装+怎么触发**：**无需安装**，换到任意 Claude Code 即有；触发 `/brainstorming <你的模糊想法>`。
- **代价与红线**：不产出正式 `spec.md/tasks.md`，不强制「约束→验证」闭环；需要长期结构化归档时偏轻——那时上 Spec-Kit。

### 2.2 GitHub Spec-Kit（`speckit-*` 10 个 skill）（需求澄清·结构化正式流）
- **是什么**：GitHub 官方开源「规格驱动开发」工具包；本项目装入 10 个技能：
  `analyze / checklist / clarify / constitution / converge / implement / plan / specify / tasks / taskstoissues`。
- **属阶段**：需求澄清（`/clarify`）为主，可延伸到设计（`/plan` `/constitution`）、实现（`/tasks` `/implement`）、发布（`/taskstoissues`）。
- **本项目怎么用**：v0.6.0 引入，用于「需求摇摆时边对话边把需求钉死」。选型账本见 `需求澄清工具选型.md`
  （对比 spec-kit ★132k / BMAD ★52k / 内置 brainstorming，含 Snyk 安全红线）。
  安装元数据留在 `.specify/`（`init-options.json`：speckit_version 1.0.1，ai=claude）。
  **`.specify/` 与 `.claude/skills/speckit-*/` 均被 `.gitignore` 排除、不入库**（视为本地第三方工具）。
- **换机怎么装+怎么触发**：`uvx specify init`（初始化时选 Claude Code），或用其 Claude Code 插件；
  **精确命令以官方 README 为准**（会更新）。触发：`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks`。
  装完记得把 `.specify/`、`.claude/skills/speckit-*/` 加进 `.gitignore`。
- **代价与红线**：引入一套外部工具链 + 流程要学，对「就想快速捋一下」偏重；Claude 对 spec「尽量遵守但不保证严格」。
- **链接**：https://github.com/github/spec-kit

### 2.3 `design-principles`（设计/架构·评审行动卡）
- **是什么**：把当前设计现场对到 DDD / 整洁架构 / PoEAA / DDIA / 重构等书里的具体原则，给「该考虑什么 + 代价 + 出处」的行动卡。
- **属阶段**：设计/架构、技术选型、代码评审、重构。
- **本项目怎么用**：`知识飞轮-路线图.md` 引「卡 4 一上来就想引入中间件＝YAGNI」「卡 12」等；
  `产品-IA评审.md` 结合 Nielsen/Krug + design-principles 诊断 13 模块过度碎片化、收敛到 ~7。
- **换机怎么装+怎么触发**：若为内置/第一方则免装；社区版按 §3 红线装前读源码。触发：做设计判断/评审时调用。
- **代价与红线**：只给启发式提示、点代价与出处，**由人拍板**，不替代需求分析、不写业务代码。

### 2.4 `database-designer`（设计/架构·数据建模）※ 推断
- **是什么**：设计数据库 schema、数据迁移、SQL vs NoSQL 选型、建模关系的 skill。
- **属阶段**：设计/架构（数据层）。
- **本项目怎么用**：**推断（弱证据）**——项目有 Supabase 云端配置与 `docs/reference/supabase_schema.sql`、
  `docs/design/知识库沉淀存储方案.md`，建模阶段可能用到；但无 commit/plan 直接点名，故标「推断」，换机时按需再定。
- **换机怎么装+怎么触发**：确认要用再装；触发：要设计表/迁移/选型/建模时。
- **代价与红线**：同社区 skill 红线（§3）。

### 2.5 `chrome-devtools`（验证/走查·本项目唯一确凿的 MCP）
- **是什么**：Chrome DevTools MCP server，驱动真实浏览器做导航、截图、快照、控制台/网络检查等。
- **属阶段**：验证 / 走查 / 联调（每次前端改动后的回归验证）。
- **本项目怎么用**：几乎每个前端 commit 的验证环节。佐证：
  - `d9d8380`：「Chrome DevTools MCP 走查：明暗两主题、卡片/筛选/开卡/新蒸馏表单均正常」；
  - `2988dd0 / 53e601a / 4ac2ff9 / 23e0591`：「Chrome MCP 走查：12 视图内容长度与基线一致…零新增控制台报错」；
  - `.claude/plan/温故复用.md`、`.claude/plan/phase1-蒸馏库.md`：用 `list_console_messages` 查报错、走查种卡到 localStorage 的浮现/推远/归档/跳转。
- **换机怎么装+怎么触发**：**MCP 属机器级/账号级配置，不随仓库走**——需在目标环境启用 `chrome-devtools` MCP server
  （`claude mcp` 或交互式 `/mcp`）。启用后即可用 `navigate_page / take_snapshot / take_screenshot / list_console_messages` 等。
- **代价与红线**：需本地 Chrome；截图/预览图勿入库（本项目 `.gitignore` 已排除 `debug-*.png`、`*-preview.png`）。

### 2.6 蒸馏三件套（内容/数据管道 · 业务运行时，非建设阶段）
- **是什么**：本项目「蒸馏库」功能**运行时**编排的社区 skill：
  - `creator-video-decoder` / `video-cangjie-distill`：拆解 B站/小红书视频；
  - `baoyu-url-to-markdown`：抓取图文/文章转 markdown。
- **属阶段**：不属开发阶段，属**产品运行时的内容/数据管道**。用户在蒸馏库里复制指令去调这些 skill。
- **本项目怎么用**：`.claude/plan/phase1-蒸馏库.md` 明确点名「B站/小红书视频→creator-video-decoder / video-cangjie-distill；
  图文帖/文章→baoyu-url-to-markdown」；入口在 `js/views/ov.js`「蒸馏视频」按钮与 `export_data.py` 快捷指令。
- **换机怎么装+怎么触发**：用到蒸馏功能时按需装（社区来源，见 §3）；触发词见各 skill 描述。
- **代价与红线**：社区 skill，装前读源码（§3）。

### 2.7 图表：mermaid / `diagram-render`（设计/架构 · 可选）
- **是什么**：mermaid 代码块可原生渲染；`diagram-render` skill 或 mermaid MCP 可导出 PNG/SVG/HTML。
- **属阶段**：设计/架构（画流程/结构图）。
- **本项目怎么用**：`产品-IA评审.md` 里有 mermaid 图；**是否经 mermaid MCP 生成证据不足**，故标「可选」。
- **换机怎么装+怎么触发**：需要导出图片再启用对应 MCP/skill；纯 markdown 里的 mermaid 代码块很多环境可直接渲染。

---

## 3 · 换机复用速查

**装什么 / 免装什么 / 红线**：

1. **免装（内置，换到任意 Claude Code 即有）**：`/brainstorming`。这类第一方能力零供应链风险，优先用。
2. **Spec-Kit（要装）**：`uvx specify init`（选 Claude Code；**精确命令以官方 README 为准**）。
   装完把 `.specify/` 和 `.claude/skills/speckit-*/` 加进 `.gitignore`（本项目做法）。
   触发链：`/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks`。
3. **MCP（要在目标环境各自启用，不随仓库走）**：`chrome-devtools`。用 `claude mcp` 或交互式 `/mcp` 启用。
4. **社区 skill（装前必看红线）**：`design-principles`（若社区版）、蒸馏三件套、`database-designer`。
   - Snyk「ToxicSkills」审计：36% 社区 skill 至少一个安全缺陷、13.4% 严重、76 个已确认恶意载荷。
   - 原则：**第一方 > 官方 > 社区**；任何社区 skill/plugin **安装前先读源码**，别凭 star 数就信。
   - 出处：`需求澄清工具选型.md` §4。

**换机最小动作清单**：
- [ ] 目标环境有 Claude Code（`/brainstorming` 等内置能力自动可用）。
- [ ] `uvx specify init` 装回 Spec-Kit，并 gitignore。
- [ ] `/mcp` 启用 `chrome-devtools`（要做前端走查时）。
- [ ] 用到蒸馏功能：按需装蒸馏三件套（读源码后）。
- [ ] 记住触发词：`/brainstorming`、`/speckit.*`、走查=Chrome DevTools MCP。

---

## 4 · 重要提醒

- **本仓库不含任何 MCP / skill 配置文件**（无 `.mcp.json` / `settings.json` / 项目级 `CLAUDE.md`）。
  MCP、社区 skill 的启用属**机器级 / 账号级**，换机需在新环境各自启用——这就是本文件存在的理由。
- **spec-kit 相关文件不入库**：`.specify/`、`.claude/skills/speckit-*/` 被 `.gitignore` 排除（见 `版本管理规范.md`）。
- 表格里点名的每个能力都能在下面「证据出处」里回溯，未见证据的只标「推断/可选」，不臆造。

### 证据出处清单
- MCP `chrome-devtools`：commit `d9d8380 / 2988dd0 / 53e601a / 4ac2ff9 / 23e0591`；`.claude/plan/温故复用.md`、`.claude/plan/phase1-蒸馏库.md`。
- `/brainstorming`：`docs/planning/知识飞轮-路线图.md`、`CHANGELOG.md`（v0.6.0）。
- Spec-Kit：`docs/research/需求澄清工具选型.md`、`.specify/init-options.json`（speckit_version 1.0.1）、`.gitignore`。
- `design-principles`：`docs/planning/知识飞轮-路线图.md`、`docs/design/产品-IA评审.md`。
- `database-designer`（推断）：`docs/reference/supabase_schema.sql`、`docs/design/知识库沉淀存储方案.md`。
- 蒸馏三件套：`.claude/plan/phase1-蒸馏库.md`、`js/views/ov.js`。
- 图表（可选）：`docs/design/产品-IA评审.md`（mermaid 代码块）。

---

## 5 · 变更记录

- 2026-08-31 · v1.0 · 初版：MCP/Skill × SDLC 阶段总览表 + 逐项工具卡 + 换机速查 + 证据出处。
  缘起：需要把本项目隐性使用的工具链显式化，供其他设备 / 其他 AI agent 照着复用。
