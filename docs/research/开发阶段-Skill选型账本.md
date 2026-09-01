# 开发全流程 Skill / MCP 选型账本（通用）

> 版本：v1.0　制定：2026-08-31
> 定位：**「软件开发各阶段，GitHub / 其他平台有哪些好用的 Claude Code Skill / MCP / SDD 框架，怎么选」的通用选型账本。**
> 面向：任意项目 / 任意设备 / 任意 AI agent（不绑本项目）。
> 性质：**reference / 调研**。★star 为 `gh api` 实测快照 **2026-08-31**，会变，落地前请复核。
> 关联：[`需求澄清工具选型.md`](需求澄清工具选型.md)（需求澄清专项）、[`工具链-MCP与Skill地图.md`](工具链-MCP与Skill地图.md)（本项目实际用过什么）。

---

## 0 · 一句话 + 怎么用这份文档

**先分清你要的是哪一类工具，再按「可信度」而非「star 数」挑。** star 高只代表多人用/维护活，**不代表适合你、更不代表安全**（见 §8）。

### 0.1 四类工具别混（读者最常混的一件事）

| 类别 | 是什么 | 连不连外部系统 | 例 |
|---|---|---|---|
| **Skill** | 一个 `SKILL.md`（指令）+ 可选脚本/资源，Claude 按需加载。纯"知识 / 流程注入" | 否 | design-principles、webapp-testing |
| **MCP server** | 一个进程，通过 Model Context Protocol 给 Claude 暴露 tools/resources | **是**（浏览器/数据库/Figma…） | chrome-devtools-mcp、playwright-mcp |
| **SDD 框架 / 方法论** | 一整套工作流 + 模板 + 命令（需求→设计→任务→实现→验证） | 视实现 | spec-kit、BMAD |
| **plugin** | Claude Code 的打包分发单位，可捆绑 skills / commands / MCP 配置 | 视内容 | 各家 plugin |

### 0.2 选型三轴（沿用 `需求澄清工具选型.md`）

**轻 / 重**（学习使用成本）× **装不装外部**（供应链风险）× **信任度**（第一方 > 官方组织 > 社区）。

### 0.3 怎么用
- 想按阶段挑 → 看 §2~§6 各阶段候选卡表。
- 想自己继续找 → 看 §7 聚合入口。
- **动手装社区工具前 → 必看 §8 安全红线。**
- 拿不定 → 看 §9 决策指引表。

---

## 1 · 一个重要事实：「框架选型」没有第一方专用 skill

**框架 / 技术选型本质是「设计判断」，主力是方法论，不是某个工具。** 第一方 Anthropic 没有发布"技术选型决策"skill。
市面相关的多为社区 skill（ADR 生成、API-design 类），**star / 维护多未核实**，别指望一个 skill 替你拍板。

**推荐做法（组合，非单一工具）**：

| 手段 | 类型 | 作用 |
|---|---|---|
| `design-principles` | Skill（本机/社区） | 把设计现场对到 DDD / 整洁架构 / PoEAA / 微服务 / DDIA 的经典原则，给「该考虑什么 + 代价 + 出处」，只给启发式、由你拍板 |
| `database-designer` | Skill（本机/社区） | schema 设计、迁移规划、SQL vs NoSQL 选型、关系建模 |
| `/brainstorming` | 内置 Skill（第一方） | 对话式把「摇摆」逼问清楚，收敛结论 |
| 技术宪章 + ADR | 做法（非工具） | 把「北极星 / 红线」和「选 X 不选 Y 的理由」落成文档（参见本仓库 `TECH_CHARTER.md` + `docs/adr/`）。社区有 ADR 生成 skill，但 **star/维护未核实**，用前审源码 |

> 一句话：**选型 = `/brainstorming` 逼问 + `design-principles` 对原则 + ADR 落决策**，工具是辅助，决定权在人。

---

## 2 · 软件开发全流程 / 规格驱动开发（SDD）

把「需求 → 设计 → 任务 → 实现 → 验证」串起来的框架。★为 `gh api` 实测（2026-08-31）。

| 框架 | 类型 | 仓库 | ★ | 活跃 | 可信度 | 轻重 | 何时选 |
|---|---|---|---|---|---|---|---|
| **GitHub Spec-Kit** | 框架（CLI + slash） | [github/spec-kit](https://github.com/github/spec-kit) | **132.4k** | 2026-08 活跃 | **第一方 GitHub** | 中 | 想要**结构化正式 spec、长期复用**；`/clarify` 专治需求歧义 |
| **BMAD-METHOD** | 框架（多 agent 敏捷团队） | [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | **52.5k** | 2026-08 活跃 | 社区头部 | 重 | 想要**像产品团队反复逼问你**（分析师/PM/架构/QA agent），愿吃学习成本 |
| **ruflo**（原 claude-flow，**已改名**） | 框架（多 agent meta-harness） | [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | **69.9k** | 2026-08 活跃 | 社区头部 | 重 | 想要**大规模多 agent 编排 / 蜂群**；概念多、偏重 |
| **Agent OS** | 框架（标准注入 + 写 spec） | [buildermethods/agent-os](https://github.com/buildermethods/agent-os) | **5.4k** | 2026-08 活跃 | 社区（Builder Methods） | 中 | 想给 agent 注入**团队编码标准 + 结构化 spec**，比 BMAD 轻 |

**首选路径**：正式化项目用 **Spec-Kit**（第一方最稳，命令链 `specify → clarify → plan → tasks → implement`）；只想快速捋一下用内置 `/brainstorming` 即可（见 `需求澄清工具选型.md`）。

---

## 3 · 前端开发

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **chrome-devtools-mcp** | MCP | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) **50.2k★**，今日仍活跃 | **第一方 Chrome** | 真机走查/调试：DOM·网络·console·性能·截图。前端改动后回归首选 |
| **Figma 官方 Dev Mode MCP** | MCP | [figma.com/blog 介绍](https://www.figma.com/blog/introducing-figma-mcp-server/)；本地 `127.0.0.1:3845/sse` | **第一方 Figma** | 设计稿转代码，把选中图层结构/组件/样式喂给 Claude。**需在 Figma/claude.ai 连接器授权** |
| GLips/Figma-Context-MCP | MCP | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) **15.7k★** | 社区（知名） | 非官方 Figma 上下文 MCP；无官方授权条件时的替代，装前审源码 |
| **shadcn 官方 MCP** | MCP | [ui.shadcn.com/docs/mcp](https://ui.shadcn.com/docs/mcp) | **第一方 shadcn** | 自然语言浏览/搜索/安装 shadcn 组件与 blocks |
| **`frontend-design` / `web-artifacts-builder`** | Skill | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | **第一方 Anthropic** | frontend-design 做 UI；web-artifacts-builder 用 React18+TS+Vite+Tailwind+shadcn 搭复杂前端 |

---

## 4 · 后端开发

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **modelcontextprotocol/servers** | MCP 集合 | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) **90.0k★** | **第一方 MCP 官方** | 官方参考 MCP servers 大合集——**后端接外部系统的选型入口**，先来这找 |
| **Supabase 官方 MCP** | MCP | [supabase/mcp](https://github.com/supabase/mcp) **2.9k★**（原 supabase-community 已重定向） | **第一方 Supabase** | 把 Supabase（Postgres+Auth+Storage）接进 AI 助手 |
| **crystaldba/postgres-mcp**（Postgres MCP Pro） | MCP | [crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp) **3.2k★** | 社区（知名） | 可配置读写 + 性能分析的 Postgres MCP |
| **`mcp-builder` / `claude-api`** | Skill | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | **第一方 Anthropic** | mcp-builder 指导写高质量 MCP server；claude-api 是 Claude API 接入参考 |
| 社区 API-design / Senior-Backend skill | Skill | 见 mcpmarket / claudedirectory 等目录（OpenAPI3.1 / RFC7807 / OWASP API Top10） | 社区，**star/维护未核实** | 生成分层 REST 脚手架、ORM schema、OAuth 接线。**未核实，用前审源码** |

---

## 5 · 测试

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **microsoft/playwright-mcp** | MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) **36.7k★**，2026-08 活跃 | **第一方 Microsoft** | 官方 Playwright MCP，做 E2E / 浏览器自动化。E2E 首选 |
| **chrome-devtools-mcp** | MCP | 同 §3，**50.2k★** | **第一方 Chrome** | 真实 Chrome 驱动的调试/性能/网络核对，兼作 E2E |
| **`webapp-testing`** | Skill | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | **第一方 Anthropic** | Playwright 驱动的 Web UI 测试指导 |
| executeautomation/mcp-playwright | MCP | [executeautomation/mcp-playwright](https://github.com/executeautomation/mcp-playwright) 5.6k★，**2025-12 起数月未更新** | 社区 | 早期 Playwright MCP；活跃度低，优先用官方版 |
| 社区 `test-driven-development` skill | Skill | 见 lobehub 等目录 | 社区，**star/维护未核实** | 强制 Red-Green-Refactor 的 TDD 工作流。未核实，用前审源码 |

---

## 6 · 聚合入口（读者自己继续找 skill / MCP 的地方）

| 入口 | 是什么 | 证据 | 可信度 |
|---|---|---|---|
| **anthropics/skills** | Anthropic 官方 Agent Skills 参考仓库 | [anthropics/skills](https://github.com/anthropics/skills) **172.7k★**。开发相关：mcp-builder / webapp-testing / web-artifacts-builder / frontend-design / claude-api / skill-creator | **第一方，最高可信**，先来这 |
| **VoltAgent/awesome-agent-skills** | 1000+ skill 精选（含各官方 skill 链接） | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) **33.4k★** | 社区头部聚合，质量较高 |
| **BehiSecc/awesome-claude-skills** | 社区 curated 清单 | [BehiSecc/awesome-claude-skills](https://github.com/BehiSecc/awesome-claude-skills) **10.1k★** | 社区（知名），仍需自审源码 |
| **smithery.ai** | MCP server 注册 + 托管平台 | [smithery.ai](https://smithery.ai)（号称 6000+ server，**未核实**） | 第三方主流 MCP 目录，中上；装前审 |
| **claudeskills.club** | skill 目录（号称 9 万+，**数量存疑**） | [claudeskills.club](https://claudeskills.club) | 第三方，海量=良莠不齐，**谨慎** |
| **skillsdirectory.com** | 带安全评分的 skill 目录 | [skillsdirectory.com](https://www.skillsdirectory.com/claude-skills)（评分方法论**未核实**） | 第三方，可作**交叉参考**，非担保 |

> 目录站的「9 万 + / 2 万 +」库容数字均系站方自述、**未核实**；规模越大越可能混入低质/恶意 skill（见 §8）。

---

## 7 · 安全红线（装任何社区 skill / MCP 前必看）

**来源已直读正文核实**：Snyk「ToxicSkills」审计（[snyk.io/blog/toxicskills-...](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)）。

- 扫描 **3,984 个** skill（来自 ClawHub / skills.sh，截至 2026-02-05）：
  - **36.82%（1,467 个）** 至少含一个安全缺陷；
  - **13.4%（534 个）** 至少含一个 **critical** 级问题；
  - 人工复核 **确认恶意载荷 76 个**（凭据窃取 / 后门 / 数据外泄）——**注意：常被误传的「1467 恶意」是错的，1467 是"有缺陷数"，确认恶意是 76**。
- 攻击特征：恶意指令藏在 `SKILL.md` 的**自然语言正文**里、**运行时才触发**，视觉上看着正常；约九成把 prompt injection 与传统恶意代码结合，绕过 AI/传统安全工具。
- 佐证：Cloud Security Alliance「SKILL.md Agent Context Poisoning」研究（labs.cloudsecurityalliance.org，2026-05）。

**实操红线**：
1. **信任顺序：第一方（Anthropic / GitHub / Figma / Chrome / Microsoft / Supabase 官方）> 知名官方组织 > 社区。**
2. 装社区 skill/MCP 前，**通读 `SKILL.md` 正文 + 所有随附脚本**（恶意常在自然语言里，不只在 shell）。
3. 带安全评分的目录（skillsdirectory.com）**只作交叉参考，不当担保**。
4. **别凭 star 数就信**——star 高 ≠ 适合你 ≠ 安全。

---

## 8 · 决策指引（给纠结的人）

| 你的处境 | 全流程 | 前端 | 后端 | 测试 | 选型/架构 |
|---|---|---|---|---|---|
| **个人小项目 / 想快** | 内置 `/brainstorming` | chrome-devtools-mcp | modelcontextprotocol/servers 里按需取 | chrome-devtools-mcp | `/brainstorming` + `design-principles` |
| **要正式化 / 长期复用** | **Spec-Kit** | Figma 官方 MCP + shadcn 官方 MCP + frontend-design | Supabase/Postgres MCP + mcp-builder | **playwright-mcp** + webapp-testing | 上面 + 技术宪章/ADR |
| **团队 / 想要产品团队式逼问** | **BMAD-METHOD**（重）或 ruflo | 同上 | 同上 | 同上 | design-principles + ADR |

> 务实提醒：**动新工具前先问一句——我是真需要新工具，还是重开一轮 `/brainstorming` + 更新现有文档就够了？**（对照 `design-principles` YAGNI）

---

## 9 · 换机 / 换 agent 复用提示

- **第一方 skill**（anthropics/skills 系）：跟着官方仓库走，最省心；MCP（chrome-devtools / playwright / Supabase 等）需在**目标环境各自启用**（`claude mcp` 或交互式 `/mcp`），不随仓库走。
- **claude.ai 连接器**（Figma / Notion / Atlassian / Linear 等官方 MCP）：需先在 **claude.ai 连接器设置** 或交互式 `/mcp` 完成 **OAuth 授权**，非交互会话无法代授。
- 本项目实际用过哪些、怎么触发，见姊妹文档 `工具链-MCP与Skill地图.md`。

---

## 10 · 变更记录

- 2026-08-31 · v1.0 · 初版：五阶段（选型/全流程/前端/后端/测试）候选卡 + 聚合入口 + Snyk 安全红线 + 决策指引。
  ★star 为 gh api 实测快照；未核实项已显式标注。缘起：需要一份面向任意项目/设备的通用开发工具选型账本。
