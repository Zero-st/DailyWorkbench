# 工具链地图：MCP + Skill × 开发阶段

> 版本：v1.4　制定：2026-08-31　最近更新：2026-09-04（本机实测校准 + 阶段轴对齐八站 + 编码规范实物入册 + 设计规范有了强制者）
> 定位：**本项目开发过程中「用了哪些 MCP / Claude Code Skill、各对应软件工程哪个阶段」的复盘账本 + 换机复用手册。**
> 性质：**reference**。
> 关联：[`需求澄清工具选型.md`](需求澄清工具选型.md)、[`开发阶段-Skill选型账本.md`](开发阶段-Skill选型账本.md)（通用·GitHub 优质 skill/MCP 选型）、[`知识飞轮-路线图.md`](../planning/知识飞轮-路线图.md)、[`项目总览-需求与进度.md`](../planning/项目总览-需求与进度.md)、[`界面设计准则.md`](../design/界面设计准则.md)、[`版本管理规范.md`](../版本管理规范.md)。

---

## 0 · 一句话 + 怎么用这份文档

**换机复用的关键不是「搬配置文件」，而是「重开一轮对话 + 把 spec-kit 装回来 + 记住这几个触发词」。**

⚠️ 先记一条最重要的事实（**2026-09-04 校准，原表述已不准确**）：本仓库**没有** `.mcp.json`、**没有** `.claude/settings.json`；项目级 `CLAUDE.md` **2026-09-04 起有了，但只做指针**（文档归位 / 宪章 / 界面准则 = DESIGN.md / bump / 令牌门禁），**不声明任何 MCP 或 skill**；
但**有一个入库的项目级 skill**：`.claude/skills/doc-filing/`。而 `.claude/skills/speckit-*/` 与 `.specify/` 被 `.gitignore` 排除、不入库。
所以准确说法是：**除 `doc-filing` 外，MCP 与 Skill 的使用都不是靠项目配置文件声明的**——它们散落在 `docs/`、`.claude/plan/`、commit message、
以及 spec-kit 自己生成的 `.specify/` 元数据里。这份文档就是把这些「隐性使用」显式化、集中化，
本身就是换机时缺的那块拼图。

怎么用：
- **想复盘**：看 §1 总览表，一眼扫清「哪个能力对应哪个阶段、有什么证据」。
- **想换机**：看 §2 逐项工具卡里的「换机怎么装 + 怎么触发」，以及 §3 换机速查清单。
- **想追证据**：每一行都标了出处（commit / plan / doc / `.specify`），可回仓库核对。
- **想知道本机到底装了什么**：看 §5「本机实测清单」——那是 2026-09-04 逐个目录数出来的，不是回忆。
- **想知道市面上还有什么**：本文只管**本项目实际在用**；「有哪些可选、怎么选」在姊妹篇 [`开发阶段-Skill选型账本.md`](开发阶段-Skill选型账本.md)。

---

## 1 · 总览表：MCP / Skill × 开发阶段

阶段轴：**需求分析 → 设计 → 开发 → 测试 → 上线 → 运维 → 迭代 → 退役**（与姊妹篇账本 §0.4 一致）。

两条不在这条轴上的东西，别往里塞：
- 「**内容 / 数据管道**」——本产品功能运行时才调的能力，非建设阶段，单独标注（见 §2.6）。
- 「**横切关注点**」（安全 / 留证与文档 / 可观测性 / 版本与配置）——贯穿全程，不属于任何一站。定义与常见误区见账本 [`开发阶段-Skill选型账本.md`](开发阶段-Skill选型账本.md) §0.5，**此处只指路不复制**。

| 能力 | 类型 | 对应阶段 | 本项目怎么用 | 换机是否要装 |
|---|---|---|---|---|
| **`/brainstorming`** | 内置 Skill（Anthropic 第一方） | 需求澄清 | 定方向：确认主心骨=个人知识飞轮、"先跑通最窄闭环" | 否（换到任意 Claude Code 即有） |
| **GitHub Spec-Kit（`speckit-*` ×10）** | 官方 Skill（github/spec-kit） | 需求澄清 / 设计 / 实现 / 发布 | 需求澄清（`/clarify`）为主；全套 `specify→plan→tasks→implement` 可选 | **要**（`uvx specify init`，装完 gitignore） |
| **`design-principles`** | 社区/内置 Skill（设计行动卡） | 设计/架构 · 代码评审 | 设计与 IA 评审时对经典原则（YAGNI 等）；产品-IA 评审引用 | 视来源（第一方免装 / 社区需装） |
| **`database-designer`** | 社区 Skill | 设计/架构（数据建模） | Supabase 表设计 / schema（**推断，弱证据**） | 需装（若确用） |
| **`chrome-devtools`** | **MCP server（本项目唯一确凿使用的 MCP）** | 验证/走查 | 每次前端改动后真机走查：明暗双主题×多视图，`list_console_messages` 查报错 | **要**（在目标环境启用该 MCP server） |
| **`doc-filing`** | **项目内 Skill（本仓自建，已入库）** | 迭代 / 文档治理 | 新建或移动 `docs/` 下文档时决定放哪、怎么命名；`docs/README.md` 是其单一真源 | **否**（随仓库走，clone 即有） |
| ~~**`creator-video-decoder` / `video-cangjie-distill`**~~ | 社区 Skill | 内容/数据管道（**业务运行时，非建设阶段**） | 蒸馏库让用户复制指令去拆解 B站/小红书视频 | **⚠️ 已移除**：2026-09-04 全盘核实**本机已无这两个 skill**（证据见 §2.6） |
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

### 2.6 蒸馏三件套（内容/数据管道 · 业务运行时，非建设阶段）※ 两个已移除

> **2026-09-04 校准**：`find /home/dev_st -type d -name creator-video-decoder|video-cangjie-distill` **全盘零命中**，
> 两个视频蒸馏 skill 已不在本机。本条**保留不删**（`.claude/plan/phase1-蒸馏库.md` 的历史证据仍然有效），
> 只改状态——本仓习惯是**留证不抹除**。`baoyu-url-to-markdown` 仍在（全局 skill，见 §5）。
> **影响**：蒸馏库里指向这两个 skill 的用户指令目前无对应能力可调，属已知缺口。

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

1. **免装（内置，换到任意 Claude Code 即有）**：`/brainstorming`，以及 §5 列出的**其余 16 个内置第一方 skill**——尤其 `code-review` `simplify` `security-review` `run` `loop` `schedule`。这类能力零供应链风险，**优先用满再去社区找**。
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
- [ ] `/mcp` 启用 `mermaid`（要交互式预览/保存图时）。
- [ ] 记住触发词：`/brainstorming`、`/speckit.*`、走查=Chrome DevTools MCP、评审=`/code-review`、清理=`/simplify`。
- [ ] **`doc-filing` 无需动作**（项目内 skill，clone 仓库即有）。

---

## 4 · 重要提醒

- **本仓库不含 MCP 配置，但含一个入库的项目 skill**（2026-09-04 订正）：无 `.mcp.json` / `settings.json` / 项目级 `CLAUDE.md`；
  `.claude/skills/doc-filing/` **已入库**，`.claude/skills/speckit-*/` 与 `.specify/` 被 gitignore。
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
- **本机实测清单（§5）**：2026-09-04 直接枚举 `~/.claude/skills/`、`.claude/skills/`、`~/.claude/plugins/`、`~/.claude.json` 的 `mcpServers`，以及本会话可用 skill 列表。
- **蒸馏两件套已移除（§2.6）**：2026-09-04 `find /home/dev_st -maxdepth 6 -type d` 全盘搜索 `creator-video-decoder` / `video-cangjie-distill` 均零命中。
- **上线/运维/迭代实况（§6）**：`.github/workflows/ci.yml`、`.github/workflows/deploy-pages.yml`、`backend/pipeline/sync_status.py`（`INTERVAL_HOURS=1` / `STALE_HOURS=2`）、`CHANGELOG.md`（11 个已发布版本）、`docs/adr/`（6 篇）。

---

## 5 · 本机实测清单（2026-09-04）

**这一节回答「我在用的是否都在册」。** 全部逐个目录数出来，不是回忆。合计 **47 个 skill + 2 个本地 MCP server**。

| 来源 | 数量 | 明细 |
|---|---|---|
| **全局** `~/.claude/skills/` | **18** | `archify` `baoyu-url-to-markdown` `brainstorming` `chrome-walkthrough-flow` `database-designer` `design-principles` `devmd-migrate` `diagram-render` `docx` `github-trending` `harvest-prompts` `llm-wiki` `llm-wiki-upgrade` `loop-engineering` `pptx` `prompt-refine` `skill-creator` `youtube-transcript` |
| **项目** `.claude/skills/` | **11** | `doc-filing`（入库）+ `speckit-*` ×10：`analyze` `checklist` `clarify` `constitution` `converge` `implement` `plan` `specify` `tasks` `taskstoissues`（gitignore） |
| **plugin** | **1** | `eli5@claude-community`，调用名 `eli5:eli5` |
| **内置第一方** | **17** | `code-review` `simplify` `security-review` `run` `init` `loop` `schedule` `claude-api` `workflow-authoring` `design` `dataviz` `artifact-design` `artifact-diagramming` `artifact-capabilities` `update-config` `keybindings-help` `fewer-permission-prompts` |
| **本地 MCP server** | **2** | `chrome-devtools`、`mermaid`（均 stdio 包装脚本，配置里**无任何凭据字段**） |
| **claude.ai connector** | 10 | Asana / Atlassian / Box / Canva / Figma / HubSpot / Intercom / Linear / Notion / monday.com——**已知但未授权**，当前会话不可用，需在 claude.ai 连接器设置里 OAuth。**勿与上面 2 个本地 server 混为一栏** |

**排除项**：`~/.claude/skills/prompt-refine-workspace/` **没有 SKILL.md**，Claude Code 不会加载，不计入。

**两条对账结论**：
1. **姊妹篇账本点名到的只有 6 个**（`design-principles` `database-designer` `brainstorming` `archify` `diagram-render` `claude-api`）外加 Spec-Kit 统称——**那是「通用选型」文档的职责边界，不是缺陷**；「我装了什么」由本节负责。
2. **内置第一方那 17 个此前从未入册**，其中 `code-review` `simplify` `security-review` `loop` `schedule` `run` 恰好覆盖本项目最薄的上线 / 运维 / 迭代三站（见 §6），**零安装、零供应链风险**。

---

## 6 · 上线 / 运维 / 迭代 / 退役：本项目实际靠什么（含已知缺口）

这四站此前在本文缺席。**下面全部回源核对过**（`ci.yml` 原文、`sync_status.py` 常量、`CHANGELOG.md` 计数）。

### 6.1 上线 / 发布

**实际在跑**：
- `.github/workflows/ci.yml` **四道硬门禁**（全文无 `|| true`）：
  1. `python bump_version.py --check`（前端资产改了却漏 bump 版本戳 → 用户端白屏）
  2. `flake8 . --select=E9,F63,F7,F82 --show-source`（语法/未定义名，会红；紧随的 `--exit-zero` 风格统计**不阻塞**）
  3. `python -m pytest -q`
  4. `npx -y -p typescript@latest tsc --noEmit -p jsconfig.json`（类型契约破坏即失败）
- `.github/workflows/deploy-pages.yml` → GitHub Pages 部署。
- 发布清单成文在 [`../版本管理规范.md`](../版本管理规范.md) §4，六步：改 CHANGELOG → 跑 `bump_version.py` → 跑门禁 → Conventional Commits 提交 → 可选打 tag → push。

**已知缺口**：
- ⚠️ **deploy 不依赖 CI 结果**：`deploy-pages.yml` 没有 `needs: ci`，其 `workflow_run` 触发也只判 `types: [completed]`、**未判 `conclusion == 'success'`**——CI 红了照样发。这是当前发布链上最实质的一个洞。
- 无灰度、无自动回滚（单人项目，回滚靠 `git revert` + 重新 push）。
- 无 git hooks（`.git/hooks/` 只有 `.sample`），本地门禁靠人手跑。

**可补的工具**（均内置第一方，见账本 §7）：`security-review` 合入前跑、`run` 发版前 smoke。

### 6.2 运维 / 监控

**实际在跑**：
- `backend/pipeline/sync_status.py`：把同步健康度写进 `data.json` 的 `sync` 字段——`INTERVAL_HOURS = 1`、`STALE_HOURS = 2`，前端据此显示数据新鲜度，**超 2 小时未成功同步就标红**。这是产品内的健康度回报，不是外部监控。
- 两个 cron workflow 跑在 **self-hosted runner**（`scripts/setup_runner.ps1` 注册）：`sync.yml`（每小时第 13 分）、`daily-ai.yml`（UTC 00:30）。

**已知缺口**：
- ⚠️ **无外部监控 / 告警**：无 Sentry、无 Prometheus、无 webhook、无邮件告警（全仓 grep 零命中）。
- ⚠️ **无日志框架**：后端错误走 `sys.stderr.write`，无结构化日志、无留存。
- ⚠️ **无自动备份**：Obsidian 库未纳入自动备份，目前是**每天手敲** `git commit`（见 [`../planning/复盘-dogfood冲刺-W1.md`](../planning/复盘-dogfood冲刺-W1.md)），已列为 Phase 2 候选。**手动备份等于没有备份。**

**可补的工具**（见账本 §8）：`schedule` 做定时备份、`loop-engineering` 把 sync 的重试改成有界+可审。

### 6.3 迭代 / 维护

**实际在跑**：
- `CHANGELOG.md`：Keep a Changelog 1.1.0 + SemVer + Conventional Commits，**11 个已发布版本**（0.1.0 → 0.10.0），人工维护，无自动化发版工具。
- `docs/adr/` **6 篇**，只在单向门写（宪章「ADR 轻量机制」，4 行模板）。
- 宪章维度四「人机协作流程」：plan 先行 / 小步提交 / 每步先走查再提交 / 命令前说副作用 / 不擅自 commit。
- 走查评审与复盘产物 4 篇（工作台走查评审、产品-IA评审、两篇复盘）。

**已知缺口**：
- ⚠️ **`code-review` / `simplify` 尚未纳入流程**——两个内置第一方 skill，零成本，目前代码评审全靠人眼加 CI。
- 无 PR 模板、无 CODEOWNERS（单人项目，影响有限）。
- 无成文重构流程，重构过程散落在 `.claude/plan/`。

### 6.4 退役 / 删除（本仓唯一「有实绩却从没被记成阶段」的一站）

**实绩**：`c7b14ad`「PC-first 收敛」——**111 个文件、11,402 行删除**，删掉整个 `twa/`、`.github/workflows/build-apk.yml`、`backend/pipeline/push_schedule.py`，以及四个下架视图（`cap/ov/sess/schedule`）。配套决策留证在 [`../adr/0005-pc-first-drop-native-mobile.md`](../adr/0005-pc-first-drop-native-mobile.md)。

**判据来源**：[`../principles/开发心法-多维思维总纲.md`](../principles/开发心法-多维思维总纲.md) §4 第 4 关「删除测试」——*想象它已存在，现在要删它，你会不会心疼；不心疼 → 本来就不该造*。心法 §1 那行「四个视图整批删、一点不心疼 = 当初就是产品判断失误」**正是这一站的复盘**：删除的价值不只在于删掉，还在于**它反过来校准了产品判断力**。

**已知缺口**：
- ⚠️ **删除目前是事件驱动**——憋到受不了才来一次大扫除（`c7b14ad` 就是一次性删掉 11,402 行）。等到那时，要删的东西往往已经和别处缠在一起。
- **可补**：把「删除测试」挂进 dogfood 复盘的固定一问，让删除变成**周期性触发**。工具侧可用 `code-review` 找死代码、`simplify` 清理残留（见账本 §9.1）。

---

## 7 · 横切面实物：本项目的编码规范靠什么

**单独开一节，不塞进 §6——因为它不是阶段。** 编码规范是横切面：**定义一次、处处执行、随时间腐烂**（定义与常见误区见账本 [`开发阶段-Skill选型账本.md`](开发阶段-Skill选型账本.md) §0.5 第五行，此处只记**本项目的实物**，不复制概念）。

本仓其实全套都有，只是此前从没被归位成一个概念：

| 规范类型 | 实物（文件 / 位置） | 由谁强制 |
|---|---|---|
| **类型契约** | `jsconfig.json`：`checkJs: true`，`include` 仅 `js/core/state.js`、`js/core/net.js`、`js/types/globals.d.ts` | **CI 硬门禁**（`tsc --noEmit -p jsconfig.json`） |
| **单一契约** | `@typedef {Object} WBData` 定义在 `js/core/net.js:7`，`js/core/state.js:10` 以 `import(...)` 引用 | CI 硬门禁（同上）+ 宪章「改契约 = 单向门」 |
| **语法门禁** | `flake8 . --select=E9,F63,F7,F82 --show-source` | **CI 硬门禁**（会红） |
| **代码风格** | `flake8 . --exit-zero --max-line-length=120 --statistics` | ⚠️ **不阻塞**，只出统计 |
| **提交规范** | Conventional Commits **6 种 type**（`feat` `fix` `refactor` `docs` `style` `chore`/`build`/`ci`），见 [`../版本管理规范.md`](../版本管理规范.md) §2 | 人工（无 commit-msg hook） |
| **设计规范** | [`../design/界面设计准则.md`](../design/界面设计准则.md)（= 本仓 DESIGN.md）§2.1 令牌健康度基线 + §4 图标红线 + §6.0 效果图门禁 + §6 加新视图检查清单 | **`check_design_tokens.py`（CI 硬门禁：孤儿令牌红 / 化石令牌棘轮）** + 效果图人过目 + chrome-devtools 走查 |
| **文档规范** | `doc-filing` skill + `docs/README.md`（单一真源） | **skill 强制入口** |
| **工程红线** | [`../TECH_CHARTER.md`](../TECH_CHARTER.md) 四个维度（含「render 不读 DOM 判路由」「禁 `\|\| true` 假绿」） | 部分 CI、部分人工 |

**已知缺口（据实记）**：
- ⚠️ **类型保护只覆盖 2 个文件**：`checkJs` 的 `include` 只有 `state.js` 与 `net.js`，**视图层与 `app.js` 无类型保护**。`jsconfig.json` 的注释已自认此事（原话：*「零噪音、CI 可硬门禁」*，视图内部为字符串拼接渲染暂不纳入）——这是**有意划的边界**，不是疏漏，但缺口本身要记下来。
- ⚠️ **风格检查不阻塞**：只有 `E9,F63,F7,F82` 四类会让 CI 变红，其余风格问题只统计不拦截。
- ⚠️ **无 formatter**：仓内无 black / prettier 配置，格式一致性全靠人。
- ⚠️ **提交规范无 hook**：`.git/hooks/` 只有 `.sample`，Conventional Commits 靠自觉。

**一条 AI 时代的注记**：这些规范的真正读者已经不只是人，**还有 AI**。规范没有写成文件，AI 每次就按它自己的习惯写——`TECH_CHARTER.md` 与 `docs/README.md` 之所以有效，正是因为它们是**喂给 agent 的约束载体**，而不只是给人看的墙上标语。对应 [`../principles/AI时代程序员成长-心法.md`](../principles/AI时代程序员成长-心法.md) §3 的「约束 Constrain」杠杆。

---

## 8 · 变更记录

- 2026-09-04 · v1.4 · **设计规范有了强制者**：§7「设计规范」行的「由谁强制」从「人工 + 走查」改为 **`check_design_tokens.py`（CI 硬门禁）+ 效果图人过目 + 走查**——脚本落地了才记；同时订正 §0「没有项目级 `CLAUDE.md`」——本轮新建了一份，只做指针、不声明任何 MCP / skill，§0 的结论不变。缘起：X 帖「design.md → 效果图 → 代码」；核对发现准则 v1.1 与 CSS 实际脱节（裸 px 四百余处 vs 令牌几十处、19 个化石令牌），文档写了没人查就是愿望。
- 2026-09-04 · v1.3 · **编码规范实物入册**：新增 §7「横切面实物：本项目的编码规范靠什么」（原 §7 变更记录顺延为 §8），把此前散落各处、从没被归位成一个概念的规范实物列全——类型契约（`jsconfig.json` 只覆盖 `state.js`/`net.js`）、单一契约（`WBData` 在 `js/core/net.js:7`）、语法门禁（flake8 四码）、提交规范（Conventional Commits 6 种 type）、设计规范、文档规范、工程红线，每行标明「**由谁强制**」；并据实记下四个缺口（类型只覆盖 2 文件 / 风格检查不阻塞 / 无 formatter / commit 无 hook）。缘起：追问「后端里还有接口设计、数据库设计、开发代码规范」——前两者是**层×阶段**的交叉格（已在账本 §4 归位），而编码规范既不是阶段也不是层，是**第五个横切面**。
- 2026-09-04 · v1.2 · **阶段轴对齐八站**：§1 阶段轴由七站改为八站（补「退役」），并明确「内容/数据管道」与「横切关注点」两类**不在轴上**的东西（横切面定义指向账本 §0.5，不复制）；§6 新增 6.4「退役 / 删除」——记下本仓唯一有实绩却从没被记成阶段的一站（`c7b14ad`：111 文件、11,402 行删除，含整个 `twa/` 与 APK 构建流水线），判据溯源到开发心法的「删除测试」，并标出「删除目前是事件驱动、缺周期性触发」这个缺口。缘起：追问阶段模型能否更原子化时发现，七站模型没有终点，于是删除永远排在「以后再说」。
- 2026-09-04 · v1.1 · **本机实测校准 + 补三阶段**：新增 §5「本机实测清单」（47 skill + 2 本地 MCP + 10 未授权 connector，逐目录枚举）与 §6「上线/运维/迭代本项目实际靠什么 + 已知缺口」（原 §5 变更记录顺延为 §7）；§1 阶段轴改为标准七阶段并补收 `doc-filing`；**修正两处失真**——①`creator-video-decoder` / `video-cangjie-distill` 全盘核实已不在本机，标为「已移除」但保留历史证据；②「本仓库不含任何 skill 配置文件」订正为「除入库的 `doc-filing` 外不含」。缘起：盘点发现本文与姊妹账本一起漏掉上线/运维/迭代三站，且内置第一方 skill 从未入册。
- 2026-08-31 · v1.0 · 初版：MCP/Skill × SDLC 阶段总览表 + 逐项工具卡 + 换机速查 + 证据出处。
  缘起：需要把本项目隐性使用的工具链显式化，供其他设备 / 其他 AI agent 照着复用。
