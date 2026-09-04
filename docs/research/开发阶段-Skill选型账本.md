# 开发全流程 Skill / MCP 选型账本（通用）

> 版本：v1.6　制定：2026-08-31　最近更新：2026-09-04
> 定位：**「软件开发各阶段，GitHub / 其他平台有哪些好用的 Claude Code Skill / MCP / SDD 框架，怎么选」的通用选型账本。**
> 面向：任意项目 / 任意设备 / 任意 AI agent（不绑本项目）。
> 性质：**reference / 调研**。★star 为 `gh api` 实测快照 **2026-08-31**，会变，落地前请复核。
> 关联：[`需求澄清工具选型.md`](需求澄清工具选型.md)（需求澄清专项）、[`工具链-MCP与Skill地图.md`](工具链-MCP与Skill地图.md)（本项目实际用过什么）。

---

## 0 · 一句话 + 怎么用这份文档

**先分清你要的是哪一类工具，再按「可信度」而非「star 数」挑。** star 高只代表多人用/维护活，**不代表适合你、更不代表安全**（见 §11）。

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
- 想按阶段挑 → 看 §2~§9 各阶段候选卡表（**七阶段对照见 §0.4**）。
- 想自己继续找 → 看 §10 聚合入口。
- **动手装社区工具前 → 必看 §11 安全红线。**
- 拿不定 → 看 §12 决策指引表。

### 0.4 八阶段 × 本账本哪一节

阶段轴：**需求分析 → 设计 → 开发 → 测试 → 上线 → 运维 → 迭代 → 退役**。

**关于「要不要拆得更细」——判据只有一条：拆开之后，选的工具变不变。** 变则拆，不变则不拆。拆到工具答案相同的地方，只是造一套没人会用的分类法。所以下表第二列**只在收益高的两站填满**，其余明写「拆了工具不变」——**为什么不拆，本身也是信息**。

| 阶段 | 二级子阶段（仅工具答案不同才拆） | 本账本哪一节 |
|---|---|---|
| **需求分析** | 发现 / 澄清 / 排序 | §2（SDD 全流程）；澄清专项另见 [`需求澄清工具选型.md`](需求澄清工具选型.md) |
| **设计** | **产品交互 · 界面视觉 · 技术架构 · 数据建模 · 接口契约**（五套工具各不同，**本轴上最该拆的一站**） | 逐个给门牌号：产品交互→§2+§1；界面视觉→§3；技术架构→§1+§6；**数据建模→§4**；**接口契约→§4** |
| **开发** | —（前端 / 后端是**层**，不是阶段，见下方读法） | §3 前端 + §4 后端 |
| **测试** | **单元 · 集成 · 端到端 · 性能 · 安全**（工具各不同） | §5 |
| **上线 / 发布** | —（构建 / 部署 / 发布策略 / 发布后验证**共用同一套流水线**，拆了工具不变） | §7 |
| **运维 / 监控** | —（可拆成监控 / 日志 / 备份 / 容量，但一人项目大半是空格） | §8 |
| **迭代 / 维护** | 反馈 / 修缺陷 / 重构 / 留证 | §9 |
| **退役 / 删除** | — | §9 末尾小节 |
| （业务运行时工具） | **本账本不管** | 产品功能自己调的 skill 属运行时，不是建设阶段——那类清单见姊妹篇 [`工具链-MCP与Skill地图.md`](工具链-MCP与Skill地图.md) |

**读法（三条）**：
1. **哪一格填不出内容，就是账本缺了一节**，别默认它不重要。
2. **前端 / 后端是「层」，不是「阶段」。** §3 §4 按**层**分，其余按**站**分——这是两根轴，别混着读。同理，单元 / 端到端是**测试类型**，不是阶段。
3. **别为了原子化而原子化。** 想升级粒度时，第二列那些「拆了工具不变」就是升级入口：**等到那一格的工具答案真的分叉了，再拆它。**

### 0.5 横切关注点（**不是阶段**，但每一站都要回头看一眼）

有五件事贯穿全程，线性阶段轴根本装不下它们——这也是为什么 §6「文档 & 可视化」在阶段列表里显得别扭：**它本来就不是一站**。

| 横切面 | 贯穿哪几站 | 本账本哪一节 | 最常见的错误认知 |
|---|---|---|---|
| **安全** | 设计 → 开发 → 测试 → 上线 → 运维 | §11 安全红线 + §7 `security-review` | 以为是上线前一道关，**其实设计期就开始**（存什么、谁能看、密钥放哪） |
| **留证与文档** | 全程 | §6（图解）+ §9（ADR / CHANGELOG） | 以为是收尾工作，**其实不写下来，三个月后连自己都复述不出当初为什么这么做** |
| **可观测性** | **设计** → 上线 → 运维 | §8 | **以为是运维期才补，其实设计期就要定「出事了怎么查」**——事后加日志的成本是事前的几倍 |
| **版本与配置** | 开发 → 上线 → 运维 | §7 + §9 | 以为是发版那一下的动作，**其实是一套贯穿的约定**（版本号语义、配置从哪读、缓存戳怎么同步） |
| **编码规范与一致性** | **立宪** → 开发 → 上线（CI 门禁） | §9（`code-review` / `simplify`）+ §7（CI 真门禁） | 以为「团队人多才需要」，**其实一个人 + AI 更需要——规范不写下来，AI 每次都按它自己的习惯写**。载体是宪章 / lint 规则 / 类型边界 / commit 约定；**必须有门禁守着，否则三个月后自然腐烂** |

**读法**：这五条不进 §0.4 那张表，也不该各自开一节——**它们是每站都要回头看一眼的东西，不是要走过去的一站。**

### 0.6 层 × 阶段（**第二根轴**，也是 §0.4 容易指错门的原因）

§0.4 是**阶段轴**。但 §3 §4 是按**层**分的，不是按阶段分的——**「后端」不是一站，是一条纵列：它自己也要走一遍全阶段。** 两根轴叠在一起才看得清工具住在哪：

| 层 | 设计 | 开发 | 测试 | 上线 | 运维 |
|---|---|---|---|---|---|
| **前端** | **DESIGN.md 视觉契约 + 效果图门禁**（做法，§3）· Figma 官方 MCP / Claude Design（§3） | shadcn MCP / `frontend-design`（§3） | chrome-devtools（§5，主用途在测试站） | —（与交付层共用同一套流水线） | —（与交付层共用） |
| **后端与数据** | **API-design skill · 数据库 MCP（§4）** | `mcp-builder` / `claude-api`（§4） | 契约与集成测试（§5） | 迁移与回滚（§7） | 连接 / 慢查询 / 备份（§8） |
| **交付（CI/CD）** | —（本层无设计期工具） | —（本层无开发期工具） | —（跑的是上面两层的测试） | §7 全节 | §8 全节 |

**读法（两条）**：
1. **空格不等于不重要。** 每个「—」都要能说清是哪一种：**「与相邻格共用同一套工具」**（前端的上线/运维），还是**「本层压根没有这个阶段的工具」**（交付层的设计/开发）。说不清的空格，就是真缺口。
2. **这张表是 §0.4 的转置视角。** §0.4 问「这一站有没有工具」，本表问「**这一层的这一站**有没有工具」。**缺了这张表，就会出现「设计站的数据建模指向 §1，可 §1 里根本没有它」这类指错门**——那正是本表补上之前真实发生过的错误。

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
| **Superpowers** | 框架（14 个自动触发 skill + 多宿主插件） | [obra/superpowers](https://github.com/obra/superpowers) | **281.5k**（fork 25.2k） | 2026-09-03 推送 | 社区头部；**已进 Anthropic 官方 marketplace**（`claude-plugins-official`）→ 按 §11 信任顺序**高于普通社区、低于第一方**（作者 Jesse Vincent / Prime Radiant 公司，设有企业支持销售入口） | 中重 | 想让 agent **连续自主干一两小时不跑偏**，且愿接受**强制 TDD**（红绿重构 +「测试之前写的代码会被删掉」）。**别用**：只改一行 / 项目无测试基础设施 / **已有自己的强制流程（如已装 speckit）——两套强制流程会打架** |
| **GitHub Spec-Kit** | 框架（CLI + slash） | [github/spec-kit](https://github.com/github/spec-kit) | **132.4k** | 2026-08 活跃 | **第一方 GitHub** | 中 | 想要**结构化正式 spec、长期复用**；`/clarify` 专治需求歧义 |
| **BMAD-METHOD** | 框架（多 agent 敏捷团队） | [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | **52.5k** | 2026-08 活跃 | 社区头部 | 重 | 想要**像产品团队反复逼问你**（分析师/PM/架构/QA agent），愿吃学习成本 |
| **ruflo**（原 claude-flow，**已改名**） | 框架（多 agent meta-harness） | [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | **69.9k** | 2026-08 活跃 | 社区头部 | 重 | 想要**大规模多 agent 编排 / 蜂群**；概念多、偏重 |
| **Agent OS** | 框架（标准注入 + 写 spec） | [buildermethods/agent-os](https://github.com/buildermethods/agent-os) | **5.4k** | 2026-08 活跃 | 社区（Builder Methods） | 中 | 想给 agent 注入**团队编码标准 + 结构化 spec**，比 BMAD 轻 |

**范围校准（别被名字骗了）**：Superpowers 自称「complete software development methodology」，但对照 §0.4 八阶段，**它实际只覆盖设计 / 开发 / 测试 / 评审四站**——需求发现的前半段、上线、运维、退役都不含。它的 `finishing-a-development-branch` 停在「合并 / PR / 丢弃」，**不含部署**，所以 §7 没有它。**「complete」一词大于实际范围。**

**三选一的判据**：要**正式化的结构化 spec 文档** → Spec-Kit；要**像产品团队那样反复逼问你** → BMAD；要 **agent 自主执行 + 强制 TDD** → Superpowers。三者都是**强制流程**，**同时开会互相覆盖，只挑一个**。

**一个容易忽略的装法**：Spec-Kit 既可装成 CLI + slash 命令，也可在 init 时选择装成**一组随项目走的 `speckit-*` skill**（`analyze / checklist / clarify / constitution / converge / implement / plan / specify / tasks / taskstoissues` 共 10 个，落在项目 `.claude/skills/` 下）。**两种形态能力相同、触发方式不同**，装之前先想清楚要哪种——装成 skill 后它就是项目资产，换机要跟着项目走。

**首选路径**：正式化项目用 **Spec-Kit**（第一方最稳，命令链 `specify → clarify → plan → tasks → implement`）；只想快速捋一下用内置 `/brainstorming` 即可（见 `需求澄清工具选型.md`）。

---

## 3 · 前端（层，非阶段）

> **本节按「层」组织，不是一个阶段。** 前端这一层自己也要走一遍：设计（视觉稿转码）→ 开发（组件）→ 测试（真机走查）。下表「阶段」列标出每个工具落在哪一站，对照 §0.6 矩阵读。

| 名称 | 类型 | **阶段** | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|---|
| **chrome-devtools-mcp** | MCP | **测试 / 验证** | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) **50.2k★**，今日仍活跃 | **第一方 Chrome** | 真机走查/调试：DOM·网络·console·性能·截图。前端改动后回归首选。**它虽列在前端层，主战场是测试站**（§5 已列，不重复） |
| **Figma 官方 Dev Mode MCP** | MCP | **设计** | [figma.com/blog 介绍](https://www.figma.com/blog/introducing-figma-mcp-server/)；本地 `127.0.0.1:3845/sse` | **第一方 Figma** | 设计稿转代码，把选中图层结构/组件/样式喂给 Claude。**需在 Figma/claude.ai 连接器授权** |
| GLips/Figma-Context-MCP | MCP | 设计 | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) **15.7k★** | 社区（知名） | 非官方 Figma 上下文 MCP；无官方授权条件时的替代，装前审源码 |
| **Claude Design + `/design-sync`** | 网页工具 + Claude Code 内置命令/工具 | 设计 | [claude.com/product/design](https://claude.com/product/design)、[帮助中心](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)；Claude Code 2.1.260 内置 `design` / `design-login` 命令与 `DesignSync` 工具 | **第一方 Anthropic Labs**（research preview） | 读代码库建设计系统 → 出稿 / 原型 → `/design-sync` 按组件增量同步回本地。**需 claude.ai 授权 + Pro 及以上套餐，仅网页版**；**未实测**。零构建 HTML 项目先用 `artifact-design` 出 HTML 效果图就够，不必上 |
| **shadcn 官方 MCP** | MCP | 开发 | [ui.shadcn.com/docs/mcp](https://ui.shadcn.com/docs/mcp) | **第一方 shadcn** | 自然语言浏览/搜索/安装 shadcn 组件与 blocks |
| **`frontend-design` / `web-artifacts-builder`** | Skill | 设计 + 开发 | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | **第一方 Anthropic** | frontend-design 做 UI；web-artifacts-builder 用 React18+TS+Vite+Tailwind+shadcn 搭复杂前端。**装法**：`/plugin install frontend-design@claude-plugins-official`（官方 marketplace 收录）；**是否已装以 `~/.claude/plugins/installed_plugins.json` 为准，别以设计文档为准——「写进准则」不等于「装了」** |

**两条做法（非工具，镜像 §4）**：后端有「接口契约先定 / 数据模型比代码活得久」，前端对应的是**视觉契约先定**——没有它，每次改样式都是「一句话描述风格 → 整份 CSS 重生成」，效果图从没被否过，因为从没出过。

| 做法 | 阶段 | 出处 / 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **视觉契约先定（DESIGN.md）** | 设计 | Google Labs 在 Stitch 里长出来的格式：规范 2026-04-10 发布、04-21 开源；文件头 YAML 令牌（色 / 字 / 间距 / 组件）+ 正文 Markdown 意图；聚合：[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)、[designmd.app](https://designmd.app/)（562 份现成文件） | 开放格式 · Google 背书 · 6+ agent 已支持 | 新项目开工先写；现有项目把「实际长什么样」反向 codify 成一份。**光写没用**：要配一个查它的脚本（令牌化石 / 孤儿 / 裸像素），否则和任何文档一样漂移。放哪按各仓文档规范定，不必真叫 `DESIGN.md`（本仓对应物：`docs/design/界面设计准则.md`） |
| **效果图门禁（HTML 先行）** | 设计 → 开发之间 | 内置 `artifact-design`（第一方）出一页 HTML 效果图，chrome-devtools 明暗两态截图；社区流传的「先 design.md → 出效果图 → 再写码」即此 | 做法，无需装任何东西 | **只对三种情形触发**：新视觉语言 / 新组件类 / 新布局骨架——沿用现成类的小改不触发，否则仪式淹死一人项目。零构建 HTML 项目效果图与成品**同介质**，几乎免费；React / Flutter 等异介质项目才需要 Stitch / Figma。**不替代走查**：它只锁「长什么样」，行为 bug 仍靠走查 |

---

## 4 · 后端与数据（层，非阶段）

> **本节按「层」组织，不是一个阶段。** 「后端」不是一站，是一条纵列——
> **设计**（接口契约 / 数据建模 / 分层）→ **开发**（编码 / 脚手架）→ **测试**（契约与集成，在 §5）→ **上线**（迁移与回滚，在 §7）→ **运维**（连接 / 慢查询 / 备份，在 §8）。
> 所以 §0.4 里「设计站的**数据建模**与**接口契约**」的门牌号在**本节**，不在 §1——§1 只讲选型方法论。下表「阶段」列标出每个工具落在哪一站。

| 名称 | 类型 | **阶段** | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|---|
| **modelcontextprotocol/servers** | MCP 集合 | 跨阶段（选型入口） | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) **90.0k★** | **第一方 MCP 官方** | 官方参考 MCP servers 大合集——**后端接外部系统的选型入口**，先来这找 |
| **Supabase 官方 MCP** | MCP | **设计（数据建模）+ 运维** | [supabase/mcp](https://github.com/supabase/mcp) **2.9k★**（原 supabase-community 已重定向） | **第一方 Supabase** | 把 Supabase（Postgres+Auth+Storage）接进 AI 助手 |
| **crystaldba/postgres-mcp**（Postgres MCP Pro） | MCP | **设计（数据建模）+ 运维（性能）** | [crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp) **3.2k★** | 社区（知名） | 可配置读写 + 性能分析的 Postgres MCP |
| **`database-designer`** | Skill | **设计（数据建模）** | 见 §1（schema 设计 / 迁移规划 / SQL vs NoSQL / 关系建模） | 社区（本机已装） | **数据建模的主力**。§1 从「选型方法论」角度列过它，**建模动作本身归本层** |
| **`mcp-builder` / `claude-api`** | Skill | 开发 | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | **第一方 Anthropic** | mcp-builder 指导写高质量 MCP server；claude-api 是 Claude API 接入参考 |
| 社区 API-design / Senior-Backend skill | Skill | **设计（接口契约）** | 见 mcpmarket / claudedirectory 等目录（OpenAPI3.1 / RFC7807 / OWASP API Top10） | 社区，**star/维护未核实** | 生成分层 REST 脚手架、ORM schema、OAuth 接线。**未核实，用前审源码** |

**做法 > 工具（接口与数据这两件事尤其）**：
- **接口契约先定，再两头开工。** 契约一旦被两边都依赖，改它就是**单向门**——该写 ADR。
- **数据模型比代码活得久。** 代码可以重写，线上数据改不动；建模阶段多花的时间，是整条纵列里回报最高的。
- **编码规范属横切面**（§0.5 第五行），不在本层单列——它由宪章 / lint / 类型边界 / commit 约定共同承载，靠 CI 门禁执行。

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

## 6 · 文档 & 可视化（架构图 / 图解）

把「系统 / 流程」变成图，用于**理解、评审、沉淀、分享**。**先分清三类别混**：渲染器（把图源出成像素）× 语义图引擎（带校验 + 交互）× 原生渲染（免装）。

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **Claude Artifacts 原生 mermaid** | 内置 | Artifacts 直接渲染 ```mermaid``` 围栏 | **第一方 Anthropic** | 只要在对话/Artifact 里预览图 → **免装、首选**；GitHub 也原生渲染 mermaid |
| **diagram-render**（mermaid/d2 → png/svg/HTML） | Skill（本机/社区，已审） | `mmdc` + 系统 Chrome + `d2`；离线、中文（CJK 字体）安全 | 社区（本机已装、已审源码） | 把 md 里的图导出成图片 / 自包含 HTML；架构图用 **d2+elk** 更专业。**零坐标、一次成图**，日常首选 |
| **claude-mermaid / mermaid MCP** | MCP | 交互式 mermaid 预览/保存 | 社区 | 只要交互式单图预览时 |
| **archify**（tt-a1i/archify） | Skill（Node，已审） | [tt-a1i/archify](https://github.com/tt-a1i/archify)，MIT，Node、无 LLM key；Socket 0 alerts / Snyk 低危（2026-09 实测） | 社区（已审、低危） | 要**交互式追溯 + 证据链（节点锚定 git 源文件、校不过报错）+ 架构演进 delta + 精致分享/演示**。代价：手写类型化 IR + 迭代调几何 |

**bake-off 实测（2026-09-02 · 对同一张 10 节点架构图）**：

| | diagram-render（d2/elk） | archify |
|---|---|---|
| 编写成本 | ~25 行 d2、**零坐标**、一次成图 | 手写 IR + **4 轮校验调几何**（边穿节点/标签压组件），showcase 门槛太高需降 standard |
| 观感 | 朴素专业 | **更精致**（类型配色+图例+boundary+强调/安全边） |
| 交互 / 证据链 | 无 | **有**（引导视图逐链路追溯、节点锚 git 源文件、delta、导出） |
| 中文 | 完美 | 完美（`locale:zh-CN` 连 Viewer UI 都中文） |

**结论**：**日常图解 / 理解项目 → Artifacts 原生 mermaid 或 diagram-render 就够**（零几何、省事）；**archify 是低频高价值专用武器**——深读复杂项目、要可追溯/可演示时才升档。对齐 §12 决策指引末尾的 YAGNI：先用现有的，遇到独有能力（追溯/证据链/delta）再升级。产出实例见本仓 `docs/design/运行时架构-数据流.md`。

---

## 7 · 上线 / 发布（CI/CD · 发版 · 回滚）

**这一节的第一原则：真门禁写在 CI 里，不写在人的记性里。** 工具只是载体，流程才是本体。

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **`security-review`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | 发版前对当前分支改动做安全审查。**零安装、零供应链风险**，合入前跑一次的性价比最高 |
| **`run`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | 真机把应用跑起来确认改动生效——发版前的 smoke check。测试绿 ≠ 应用能开 |
| **GitHub 官方 MCP server** | MCP | [github/github-mcp-server](https://github.com/github/github-mcp-server) **32.7k★**、fork 4.9k、MIT，2026-09-03 仍活跃（`gh api` 实测 2026-09-04） | **第一方 GitHub** | 让 agent 直接读写 Actions run / PR / release / issue。**排查「CI 为什么红」时省下大量复制粘贴** |
| **nektos/act** | CLI 工具（非 skill） | [nektos/act](https://github.com/nektos/act) **71.8k★**、MIT，2026-08-09 推送（`gh api` 实测 2026-09-04） | 社区头部 | 本地跑 GitHub Actions。**改 workflow 时省一轮 push-等-看红**；别用它替代真实 CI（运行环境有差异） |

**做法 > 工具（三条，都不是工具能替你做的）**：
1. **门禁必须真会变红**——禁 `|| true` 之类的假绿。测试「看着在测」其实没测，比没有测试更危险。
2. **灰度与回滚是流程**：先放小比例用户、出事立刻回退到上一版。工具只是执行手段。
3. **发布清单要成文**：改了什么、版本号怎么动、缓存戳同步没有——写下来，别靠记。

---

## 8 · 运维 / 监控（定时 · 日志 · 告警 · 备份）

**先分清执行器与方法论**：`loop` / `schedule` 是**执行器**（负责「反复跑」），`loop-engineering` 是**方法论**（负责「跑得有边界、有门禁、可审计」）。混用会得到一个跑不停也说不清的循环。

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **`loop`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | 按固定间隔或自定步反复跑一个 prompt / slash 命令（盯部署、轮询状态）。**别用它做一次性任务** |
| **`schedule`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | cron 式定时 routine（每天 / 每周自动跑）。也支持一次性定时 |
| **`loop-engineering`** | Skill（本机已审） | 跨项目方法论骨架；项目参数走 `profiles/<项目>.md` | 社区（本机已审源码） | 把「改到成功为止」这类**无界重试**改造成**有界计数 + 超限 fail-to-ask + 落盘可审**。没有对应 profile 时它会停下要你补，**不拿别项目参数硬套** |
| **可观测类 MCP（Sentry 等）** | MCP | [getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp) 839★、2026-09-04 推送（`gh api` 实测 2026-09-04）；许可证 NOASSERTION，**用前确认授权条款** | 官方组织（体量小） | 要把线上错误 / 告警接进对话时。**更完整的清单先去 §4 已列的 `modelcontextprotocol/servers` 入口找**，此处不复制 |

**做法 > 工具（三条）**：
1. **没有日志的故障只能靠猜。** 先有流水账，再谈告警。
2. **备份不是「以后再说」。** 手动备份等于没有备份——它一定会在你最忙的那周断掉。
3. **定时任务要有健康度回报。** 「上次几点跑的、成功没有、超过多久算过期」应当是**产品里看得见的字段**，不是只有你知道。

---

## 9 · 迭代 / 维护（评审 · 重构 · 留证）

软件七成以上的总成本花在上线之后，但这一站的工具最容易被忽略。**这里的第一方 skill 密度最高，几乎没有理由不用。**

| 名称 | 类型 | 证据 | 可信度 | 何时用 / 别用 |
|---|---|---|---|---|
| **`code-review`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | 审当前 diff / PR / 分支的**正确性缺陷**，分 low→max 档（低档少而准，高档广而含存疑项）。支持把结论直接落成 PR 行内评论或改到工作区 |
| **`simplify`** | **内置 Skill** | Claude Code 自带，免装 | **第一方 Anthropic** | **只做质量清理**：复用、简化、效率、抽象层级，并直接应用修改。**它不找 bug**——找 bug 走 `code-review`，别指望一个干两件事 |
| **`design-principles`** | Skill（见 §1） | 同 §1 | 社区/本机已审 | 重构或评审**动手前** consult：这次改动踩到哪条经典原则、代价是什么、出处在哪。此处只指路，不重复 §1 |
| **`harvest-prompts` / `skill-creator` / `devmd-migrate`** | Skill（本机） | 三者分别做：提炼可复用提问 / 造与优化 skill / 把本机能力泛化发布 | 社区（本机已审） | 把**一次性对话沉淀成可复用资产**。AI 时代真正在累积的是这类杠杆，不是代码行数 |

> **和 §2 Superpowers 的重叠提醒**：Superpowers 自带 `requesting-code-review` / `receiving-code-review` / `systematic-debugging` / `verification-before-completion`。**若装了它，本节的第一方 `code-review` / `simplify` 与之功能重叠——二选一，别叠着跑**，两套都会主动触发，结果是互相打断。

**做法 > 工具（约定，不是工具）**：
- **Keep a Changelog + SemVer + Conventional Commits**：「做了什么」进 CHANGELOG，「为什么」进设计文档与 ADR，两者别混写。
- **ADR 只在单向门写**：可逆的事直接试，不可逆的事留 4 行证据（背景 / 决策 / 理由 / 代价）。
- **评审的产出要能追溯**：一次走查评审如果只留在对话里，三个月后等于没做过。

### 9.1 退役 / 删除（被漏掉最多的一站）

**为什么要单独列出来**：常见的阶段模型讲到「迭代」就画个圈回到开头，**没有终点**。于是「删掉它」这件事永远排在「以后再说」，功能只增不减，直到没人敢动。**删除不是失败，是维护的一部分。**

**判据 · 删除测试**：想象它已经存在，现在要删掉它——**你会不会心疼？** 不心疼，说明它本来就不该造。这一问同时在做两件事：决定现在删不删，以及**校准你当初的判断力**。

| 手段 | 类型 | 作用 |
|---|---|---|
| `code-review` | 内置 Skill · 第一方 | 找出死代码、无引用分支、已经没人走的路径 |
| `simplify` | 内置 Skill · 第一方 | 删完之后顺手把留下的疤清理掉 |
| 删除测试 | **做法** | 决定「删不删」。**工具只负责找，删不删是产品判断** |

**一条经验**：删除最好**周期性触发**（比如每次复盘固定问一遍），而不是**事件驱动**——憋到受不了才来一次大扫除，那时要删的东西已经和别处缠在一起了。

---

## 10 · 聚合入口（读者自己继续找 skill / MCP 的地方）

| 入口 | 是什么 | 证据 | 可信度 |
|---|---|---|---|
| **anthropics/skills** | Anthropic 官方 Agent Skills 参考仓库 | [anthropics/skills](https://github.com/anthropics/skills) **172.7k★**。开发相关：mcp-builder / webapp-testing / web-artifacts-builder / frontend-design / claude-api / skill-creator | **第一方，最高可信**，先来这 |
| **VoltAgent/awesome-agent-skills** | 1000+ skill 精选（含各官方 skill 链接） | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) **33.4k★** | 社区头部聚合，质量较高 |
| **BehiSecc/awesome-claude-skills** | 社区 curated 清单 | [BehiSecc/awesome-claude-skills](https://github.com/BehiSecc/awesome-claude-skills) **10.1k★** | 社区（知名），仍需自审源码 |
| **smithery.ai** | MCP server 注册 + 托管平台 | [smithery.ai](https://smithery.ai)（号称 6000+ server，**未核实**） | 第三方主流 MCP 目录，中上；装前审 |
| **claudeskills.club** | skill 目录（号称 9 万+，**数量存疑**） | [claudeskills.club](https://claudeskills.club) | 第三方，海量=良莠不齐，**谨慎** |
| **skillsdirectory.com** | 带安全评分的 skill 目录 | [skillsdirectory.com](https://www.skillsdirectory.com/claude-skills)（评分方法论**未核实**） | 第三方，可作**交叉参考**，非担保 |

> 目录站的「9 万 + / 2 万 +」库容数字均系站方自述、**未核实**；规模越大越可能混入低质/恶意 skill（见 §11）。

---

## 11 · 安全红线（装任何社区 skill / MCP 前必看）

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

## 12 · 决策指引（给纠结的人）

| 你的处境 | 全流程 | 前端 | 后端 | 测试 | 上线·运维 | 迭代·评审 | 选型/架构 |
|---|---|---|---|---|---|---|---|
| **个人小项目 / 想快** | 内置 `/brainstorming` | 界面准则(=design.md) + HTML 效果图先过目 + chrome-devtools-mcp | modelcontextprotocol/servers 里按需取 | chrome-devtools-mcp | `run` + CI 真门禁 | `code-review` + `simplify` | `/brainstorming` + `design-principles` |
| **要正式化 / 长期复用** | **Spec-Kit** | Figma 官方 MCP + shadcn 官方 MCP + frontend-design | Supabase/Postgres MCP + mcp-builder | **playwright-mcp** + webapp-testing | `security-review` + GitHub 官方 MCP + `schedule` | `code-review`（高档）+ CHANGELOG/ADR | 上面 + 技术宪章/ADR |
| **团队 / 想要产品团队式逼问** | **BMAD-METHOD**（重）或 ruflo | 同上 | 同上 | 同上 | 上面 + `loop-engineering`（有界自愈） | 同上 + 走查评审成文 | design-principles + ADR |

> **注意这张表的一个规律**：上线 / 运维 / 迭代三列里，性价比最高的几乎全是**内置第一方 skill**——零安装、零供应链风险、免过 §11 的安全红线。**先把免费的用满，再去社区找。**

> 务实提醒：**动新工具前先问一句——我是真需要新工具，还是重开一轮 `/brainstorming` + 更新现有文档就够了？**（对照 `design-principles` YAGNI）

---

## 13 · 换机 / 换 agent 复用提示

- **第一方 skill**（anthropics/skills 系）：跟着官方仓库走，最省心；MCP（chrome-devtools / playwright / Supabase 等）需在**目标环境各自启用**（`claude mcp` 或交互式 `/mcp`），不随仓库走。
- **claude.ai 连接器**（Figma / Notion / Atlassian / Linear 等官方 MCP）：需先在 **claude.ai 连接器设置** 或交互式 `/mcp` 完成 **OAuth 授权**，非交互会话无法代授。
- 本项目实际用过哪些、怎么触发，见姊妹文档 `工具链-MCP与Skill地图.md`。

---

## 14 · 变更记录

- 2026-09-04 · v1.6 · **前端补上「契约先定」**：§3 表后新增两条做法——**视觉契约先定（DESIGN.md，Google Labs / Stitch 开放格式，2026-04 开源）** 与 **效果图门禁（HTML 先行；只对新视觉语言 / 新组件类 / 新布局骨架触发；不替代走查）**，与 §4 后端的「接口契约先定」对称；§3 补 **Claude Design + `/design-sync`**（第一方 Anthropic Labs，research preview，**未实测**），给 `frontend-design` 补装法与「写进文档 ≠ 装了」提醒；§0.6 前端 × 设计格、§12 个人小项目行前端列同步。**帖子没说的一半也写了**：design.md 没有脚本查就会漂移。缘起：用户看到 X 帖「先 design.md → 出效果图 → 再写代码」，问能否治掉反复改前端；回查本仓 `css/styles.css` 全史 21 次提交 +1987/−888、08-26 单日连换四套视觉语言、准则建成后 CSS 仍近九成裸像素——机制对，但缺门禁。
- 2026-09-04 · v1.5 · **§2 补入 Superpowers**：`obra/superpowers` **281.5k★ / 25.2k fork**（`gh api` 实测 2026-09-04 快照，星数会漂）、MIT、2026-09-03 仍在推送、`skills/` 实测 14 个、已进 Anthropic 官方 marketplace——**按 star 是 §2 表里最大的一条，此前漏收属覆盖度缺口**。同时补两条不能只抄 README 的判断：①**范围校准**——它自称 complete 但只覆盖八阶段里的设计/开发/测试/评审四站，不含上线与运维，故 §7 明确不收它；②**三者都是强制流程，同时开会互相覆盖，只能挑一个**。§9 补一条与它的功能重叠提醒（`code-review` / `simplify` 二选一）。缘起：用户指定该仓库要求详细介绍，调研后发现它是 §2 的直接同类却不在表内。
- 2026-09-04 · v1.4 · **落地「两根轴」+ 修一个指错门的 Bug**：①**修 Bug**——§0.4 设计站原写「数据建模 · 接口契约 → §1+§6」是错的（§1 只讲选型方法论、不含这两样），改为逐个给真实门牌号，**数据建模与接口契约归 §4**；②**§3 §4 层阶段解耦**——改名为「前端（层，非阶段）」「后端与数据（层，非阶段）」，各加「阶段」列与一段「本层横跨哪些阶段」导航，§4 补入 `database-designer` 与「接口契约先定 / 数据模型比代码活得久」两条做法；③**新增 §0.6 层 × 阶段矩阵**，把上一版只写在读法里的「两根轴」真正画出来——**Bug 的根因正是缺这张表**；④§0.5 横切面由四条增至五条，补「**编码规范与一致性**」（AI 时代权重升高：规范不写下来，AI 每次按自己习惯写）。缘起：追问「后端里还有接口设计、数据库设计、开发代码规范」，据此发现上一版的指向错误。
- 2026-09-04 · v1.3 · **阶段模型精化**：①阶段轴七站 → **八站**，补「退役 / 删除」并在 §9.1 展开（判据=删除测试，工具=`code-review`+`simplify`）；②§0.4 加「二级子阶段」列，**只在设计、测试两站拆**，其余明写「拆了工具不变」——确立判据「**拆开之后选的工具变不变**」；③新增 §0.5 横切关注点表（安全 / 留证 / 可观测性 / 版本配置），明确它们**不是阶段**，也解释了 §6 为何在阶段列表里显得别扭；④读法补「前端/后端是**层**不是阶段」，点破原表混了两根轴。缘起：追问「七阶段能否更原子化」——能，但全量拆分在一人项目里大半是空格（YAGNI），故只拆收益高的两站，并把「为什么不拆」也写成信息。
- 2026-09-04 · v1.2 · **补齐缺失的三个阶段**：新增 §7 上线/发布、§8 运维/监控、§9 迭代/维护（原 §7~§11 顺延为 §10~§14），新增 §0.4「七阶段 × 本账本哪一节」自检表，§2 补 Spec-Kit 可装成 `speckit-*` skill 的通用装法，§12 决策指引扩「上线·运维」「迭代·评审」两列，并同步修正 §0.1/§0.3/§6 对聚合入口·安全红线·决策指引的章节号引用。缘起：按七阶段自查发现本账本只覆盖需求/设计/开发/测试四站，且**漏掉的第一方内置 skill（security-review / code-review / simplify / loop / schedule / run）恰好全长在缺失的三站上**——零安装零风险却没入册。新增外部条目的 ★ 均为 `gh api` 2026-09-04 实测。
- 2026-08-31 · v1.0 · 初版：五阶段（选型/全流程/前端/后端/测试）候选卡 + 聚合入口 + Snyk 安全红线 + 决策指引。
  ★star 为 gh api 实测快照；未核实项已显式标注。缘起：需要一份面向任意项目/设备的通用开发工具选型账本。
- 2026-09-02 · v1.1 · 新增 §6「文档 & 可视化（架构图/图解）」类目（Artifacts 原生 mermaid / diagram-render / mermaid MCP / archify）+ archify vs diagram-render bake-off 实测结论；后续章节顺移一位（§7~§11），一并修正原 §0.3/§1 对「聚合入口/安全红线/决策指引」的章节号引用。缘起：评估 archify skill 是否适合"图文并茂理解项目"。
