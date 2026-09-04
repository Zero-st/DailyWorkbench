# 前端「视觉契约先定 + 效果图门禁」：把 X 帖的 design.md 做法落到本仓

## Context

**触发**：用户看到 X 帖「先设计前端界面 → 写 design.md → 生成效果图 → 再写代码」，问这能不能治掉此前反复改前端排版/样式的毛病。

**物证（2026-09-04 只读探查）**：

| 事实 | 数据 | 说明什么 |
|---|---|---|
| `css/styles.css` 改动史 | 1099 行的文件，`--follow` 全史 **21 次提交、累计 +1987 / −888**（≈重写 1.8 遍） | 反复改是真的 |
| 08-26 单日 | 连换四套视觉语言：`3ab0448` 粉 Ins → `6238932` 冷硬科技 v6 → `bccbe09` 钢蓝浅色 → `c6bed47` v7 糖果 | 每次都是「一句话描述风格 → 整份 CSS 重生成」。**从没有一张效果图被否掉，因为从没出过效果图** |
| 仓库已有 design.md 同类物 | `docs/design/界面设计准则.md` v1.1（08-31 建） | 建成后再没换过皮——**「写下来」确实有效** |
| 但 CSS 并不遵守准则 | §5「只用 `--space-*`，别写裸像素」→ 实测 padding/gap/margin/font-size **裸 px 463 处 vs 走令牌 57 处**；§2 列的 9 级间距/7 级字号令牌里 **5 + 5 个全仓无人引用**；77 个令牌 **19 个化石**（含 v4 玻璃拟态残留 `--glass*` `--glow*`）；**22 行硬编码 hex**（§2 明令禁止） | **没有门禁的 design.md 是愿望，不是契约**——这正是 X 帖没说的另一半 |
| 准则自身也漂移 | §0 称「引入官方 `frontend-design` skill 当设计透镜」；`installed_plugins.json` 只有 `eli5`，**从未安装** | 文档写了没人查 |
| 无项目级 `CLAUDE.md` | `find -maxdepth 3` 为空 | agent 开工**不会自动读到**准则/宪章；DESIGN.md 做法的核心机制「每次会话开始就读」在本仓不成立 |
| 账本不对称 | §0.6「前端 × 设计」格只有 Figma MCP；§3 零「做法」行 | §4 后端已有「接口契约先定 / 数据模型比代码活得久」两条做法——**后端有契约先定，前端没有** |

**外部事实**：DESIGN.md 是 Google Labs 在 Stitch 里长出来的格式（规范 2026-04-10 发布、04-21 开源；文件头 YAML 令牌 + 正文 Markdown 意图；6+ agent 支持；`VoltAgent/awesome-design-md`、designmd.app 收 562 份）。Anthropic Labs 的 **Claude Design**（claude.ai/design，research preview，Pro+ 网页版）读代码库建设计系统、可经 Claude Code `/design-sync` 同步——本机 2.1.260 内置 `design` / `design-login` 命令与 `DesignSync` 工具，**未授权、未实测**。

**判断（要写进文档的结论，不是照抄帖子）**：
1. **机制对**：把迭代挪到最便宜的阶段——改一页效果图几分钟，改整份 CSS 再走查几小时。
2. **本仓效果图近乎免费**：产品本身就是 HTML，效果图与成品**同介质**；`docs/reference/devhtml/` 已有 3 份 Artifact 走过这条路。**不需要 Stitch / Figma**（那是给 React/Flutter 这类效果图与成品异介质的项目用的）。
3. **门禁只对三种情形触发**：新视觉语言 / 新组件类 / 新布局骨架。沿用现成类的小改走准则 §6 即可——否则仪式淹死一人项目。
4. **帖子漏的一半**：design.md 得有东西检查它，否则和本仓准则一样漂移。
5. **效果图过目不替代走查**：它只锁「长什么样」，行为/状态 bug 仍靠 chrome-devtools 走查。

---

## 改动

### 一 · 方法论入册 — `docs/research/开发阶段-Skill选型账本.md` → v1.6

1. **§3 表后新增「做法（非工具）」小表**，两行，镜像 §4 做法行的格式：
   - **视觉契约先定（DESIGN.md）** — 阶段：设计；证据：Google Labs DESIGN.md 规范 + `VoltAgent/awesome-design-md`；可信度：开放格式 · Google 背书；何时用：新项目开工 / 现有项目补契约；**本仓对应物 = `docs/design/界面设计准则.md`**（按 doc-filing 不在根放 DESIGN.md）。
   - **效果图门禁（HTML 先行）** — 阶段：设计 → 开发之间；工具：内置 `artifact-design`（第一方）出 HTML + chrome-devtools 截图；触发条件三条；**不替代走查**。
2. **§3 表加两行工具**：**Claude Design + `/design-sync`**（第一方 Anthropic Labs · research preview · Pro+ · 需 claude.ai 授权 · **未实测**，显式标注）；`frontend-design` 现有行补注「官方 marketplace 收录、**本机未装**」。
3. **§0.6 前端 × 设计格**改为：「DESIGN.md 视觉契约 + 效果图门禁（做法，§3）· Figma 官方 MCP / Claude Design（§3）」。
4. **§12 决策表**「个人小项目 / 想快」行前端列：`chrome-devtools-mcp` → `界面准则(=design.md) + HTML 效果图先过目 + chrome-devtools-mcp`。
5. **§14** 追加 v1.6 记录（含缘起 + 本仓四个数字）。

### 二 · 落到本仓 — `docs/design/界面设计准则.md` → v1.2

1. 头部「定位」加一句：「**本文即本仓的 DESIGN.md**（agent 动前端前先读）」；关联加账本 §3。
2. **§0 修漂移**：`frontend-design`「引入…当审查清单」→ 如实写：官方 marketplace 收录、**本机未装**（`installed_plugins.json` 仅 eli5）；本仓效果图/讲义实际由内置 `artifact-design` 产出（devhtml 3 份）。装不装另议，不在本次。
3. **新增 §2.1 令牌健康度（2026-09-04 快照）**：77 定义 / 58 引用 / 19 化石（列名）/ 裸 px 463 vs 令牌 57 / 硬编码 hex 22 行。**作为基线与清理 backlog，本次不动 CSS**。
4. **新增 §6.0 效果图门禁**（放现有 §6 清单之前）：
   - 触发：新视觉语言 / 新组件类（§3 表里没有的）/ 新布局骨架（非 `.wrap` `.col` `.kb-layout`）。
   - 流程：用 `artifact-design` 出一页 HTML 效果图（**只用本准则令牌与现成类**，明暗各一态）→ 存 `docs/reference/devhtml/效果图-<视图>-vX.html`（沿 devhtml 惯例，HTML 自渲染、不存二进制截图）→ 人过目定稿 → 才进实现 → 实现完仍走 §6 第 6 步走查。
   - 不触发：沿用 `.card/.chip/.sf/.button` 的增删改、文案、数据接线。
5. **§8** 变更记录 v1.2。

### 三 · 让 agent 自动读到 — 新建项目级 `CLAUDE.md`（根目录，≤ 20 行）

- 只做指针，不复制规则：开工先读 `docs/README.md`（归位）→ `docs/TECH_CHARTER.md`（工程红线）→ `docs/design/界面设计准则.md`（= DESIGN.md，动前端必读，§6.0 门禁）；改前端跑 `python bump_version.py`。
- 依据：DESIGN.md 做法的机制就是「会话开始自动读」；`CLAUDE.md` 是 Claude Code 原生入口；与 README/CHANGELOG 同属跨社区标准名，doc-filing 允许英文名留根。

### 四 · 心法总纲 §2 排队戴帽 — `docs/principles/开发心法-多维思维总纲.md`

- 第 44 行「设计 →【设计帽】能复用现成组件就别新造类（界面准则 §6 检查清单）」追加「；新视觉/新组件**先出 HTML 效果图过目**（准则 §6.0），再进实现」。版本按该文头部惯例 +0.1，变更记录一行。

### 五 · 门禁脚本 — 新建 `check_design_tokens.py`（根目录，与 `bump_version.py` 同位同形）+ CI 一步

- 逻辑：解析 `css/styles.css` 全部 `--name:` 定义（**同行多令牌也要抓**——探查时第一版正则就漏了这个）；扫 `css/ js/ index.html` 的 `var(--name`；报告化石 / 孤儿；统计裸 px 与硬编码 hex（信息，不阻塞）。只用标准库。
- 门禁：**孤儿 > 0 直接红**（引用未定义变量 = 属性失效，真 bug，现为 0 须保持）；**化石数 > 基线 19 红**（棘轮：只许降不许升，基线写脚本常量，清一批就下调）。
- 接入：`.github/workflows/ci.yml` Python job 在 `bump_version.py --check` 之后加 `python check_design_tokens.py --check`，**不加 `|| true`**（宪章反假绿）。
- 连带：准则 §2.1 数字标「由 `check_design_tokens.py` 产出」；`docs/README.md` §4 索引、`TECH_CHARTER.md` 维度三护栏各加一行；姊妹篇 §7 横切面实物「设计规范」行的「由谁强制」从「人工 + 走查」改为「`check_design_tokens.py`（CI）+ 走查」——**这是本轮唯一动姊妹篇的理由：它记的是实际在用的东西，脚本一落地就算**。

---

## 不做（明确排除）

- **不清理** 19 化石 / 463 裸 px / 22 hex：改 CSS 必须走查，另开任务；本次只立基线让它可被看见、只许变好。
- **不装** frontend-design / Claude Design / Figma MCP：用户拍板；Claude Design 需 OAuth + Pro 套餐。
- **不在根放 `DESIGN.md`**：违 doc-filing；准则就是它，CLAUDE.md 负责指过去。
- **不写 ADR**：门禁是双向门，去掉 CI 一行即可回退。
- **不 commit**。

---

## 验证

1. **章节自洽**：账本 / 准则 / 总纲各 `grep -n '^## \|^### '` 编号连续；新增交叉引用（准则 §6.0、账本 §3 做法表）`grep` 真实存在；新增表格行列数与既有行一致（`awk -F'|' '{print NF}'`）。
2. **外链回源**：DESIGN.md 规范、`awesome-design-md`、Claude Design 帮助页各 `curl -sI` 200。
3. **未核实项显式标注**：Claude Design 行必带「未实测」；准则 §2.1 五个数字与本文 Context 表逐项对照。
4. **CLAUDE.md**：≤ 20 行；下一个新会话的 system-reminder 应出现其内容（人工看一眼即可）。
5. **脚本**：`/home/dev_st/iriswork/tools/anaconda/bin/python check_design_tokens.py --check` 输出「19 化石 / 0 孤儿」并 exit 0；临时在 CSS 加一行 `color:var(--nope)` 再跑应 exit 1（随即改回）；`python -m pytest -q` 仍绿；`bump_version.py --check` 不受影响（新脚本不在 `sw.js` FILES 内，也不该在）。
6. **边界**：姊妹篇只动 §7 那一行（`git diff --stat` 应只有该文件 ±2 行）；`git diff -- css/` 为空。
