# 0014 把四个 agent skill 全量纳入版本库（含 37M node_modules）

- 状态：已接受
- 日期：2026-09-20
- 关联：ADR 0001（零构建北极星）、ADR 0010（放宽零依赖北极星）——本 ADR 是这两条北极星第一次被**开发期资产**而非产品运行时资产触碰；`CLAUDE.md` 第 2 条工程红线（依赖极简且可撤回）。

- 背景：此前 `archify`、`baoyu-url-to-markdown`、`brainstorming`、`chrome-walkthrough-flow` 四个 skill 只存在于用户级 `~/.claude/skills/`，与本仓无关，换机 clone 后不可用。用户要求把它们迁到项目级 `.claude/skills/`（该目录**已入 git**，原有 32 个跟踪文件 / 460K）。四者形态差异很大：

  1. `brainstorming`（96K / 8 文件）与 `chrome-walkthrough-flow`（44K / 4 文件）是纯文本，迁移无成本。
  2. `archify` 在用户级是一条**符号链接**，指向仓外的 `/home/dev_st/.agents/skills/archify`（实体 7.5M / 193 文件）。照搬链接会在仓里留一条指向本机绝对路径的死链，换机即废；故只能解引用复制实体。
  3. `baoyu-url-to-markdown` 是 **37M / 3867 文件**，其中绝大部分是 `scripts/node_modules` 与 `scripts/vendor`（Defuddle、chrome-cdp 等 npm 依赖的完整安装产物）。`.gitignore` 未忽略 `node_modules`。

  迁移前已就「大体积两个是否要迁」向用户提出三个选项（不迁只在 CLAUDE.md 留指针 / 迁但 gitignore 重资产 / 全量迁），并明示第三项的代价。**用户明确选择全量迁**。

- 决策：**四个 skill 全部复制（非移动，用户级原件保留）进 `.claude/skills/`，`node_modules` 与 `vendor` 一并入 git。**
  - `.claude/skills/` 体积 460K → **45M**，跟踪文件数 32 → 约 3900。
  - `archify` 以 `cp -rL` 解引用为实体目录（其内部无软链，不会递归膨胀）；`baoyu-url-to-markdown` 以 `cp -a` 保留内部两条**仓内相对**软链（`node_modules/baoyu-chrome-cdp` → `../vendor/baoyu-chrome-cdp`、`.bin/defuddle` → `../defuddle/dist/cli.js`），二者在 git 中可正常存取，非死链。
  - **同时做的两处安全与正确性收口**（不属于"复制"本身，但属本次变更）：
    - 删除随 `chrome-walkthrough-flow` 带入的 `profiles/iris-ecnu.md`、`profiles/iris-wust.md`。二者含**明文口令**（`jsy/111111`）、内网域名（`dev.ecnu.irissz.com`、`dev.wust.irissz.com`）、CAS 端点、Oracle 库名与可识别的人名/院系。本仓存在 GitHub Pages 部署场景，这些内容入 git 属真实信息泄露。用户级原件保留，需要时可取回。
    - 新增 `profiles/DailyWorkbench.md`（read-only 裁剪版），并改写本仓副本 `SKILL.md` 的 `description`，使其触发语指向本项目而非 iris。

- 理由：用户要的是「能力随仓走、换机 clone 即用、不依赖本机 `~/.claude` 布局」。在这个目标下，把依赖 vendored 进仓是唯一能兑现的形态——`node_modules` 若排除，换机 clone 后 `baoyu` 直接不可用，等于迁了个半残壳子，反而比不迁更坏。

- 代价 / 护栏 / 何时重估：
  - **单向门（本 ADR 的核心）**：`node_modules` 一旦提交，**即便日后 `git rm` 也无法从历史中回收**——对象永久留在 packfile 里，仓库体积不可逆地涨上去。真要瘦身只能 `git filter-repo` 重写历史，那会让所有既有 clone 与任何已发布引用失效。**这是本次变更唯一不可逆的部分**；四个 skill 目录本身的增删是双向门。
    **补充（2026-09-20 推送前核实）**：`origin` 是 **public 仓库** `github.com/Zero-st/DailyWorkbench`（推送前 4.4MB）。因此上述不可逆性是**面向公众的**——依赖树一旦推送即世界可读，且会被各类镜像/归档抓取，即使日后重写历史也无法收回已被抓走的副本。用户在获知该事实后仍确认全量推送。
  - **与北极星的关系（务必别误读）**：ADR 0001/0010 约束的是**产品运行时**——工作台页面仍是零构建、浏览器直开、不引入打包步骤。本次入仓的是**开发期 agent 工具**，不参与页面构建、不被 `index.html` 引用、不进 `bump_version.py` 的 CACHE 戳。**北极星未被推翻，但"依赖极简且可撤回"这条红线的"可撤回"部分，对这批资产实质上失效了**（见上条）。
  - **护栏**：`.claude/skills/` 不在前端资产路径内，`check_design_tokens.py` 与 `bump_version.py` 均不扫描它，不会影响既有门禁；本次未改 `css/ js/ index.html`，故无需 `bump_version.py`。
  - **未做的事**：`archify/examples/` 下两条历史绝对路径（`/home/dev_st/.agents/skills/archify/examples/*.html`，在 `web-app-rendered.visual-check.json` 里）是示例产物的检查记录，不参与运行，保持原样。
  - **何时重估**：若仓库体积开始影响 clone/CI，或再有第五个重资产 skill 要入仓——**不要继续往里加**。届时正确做法是改为「skill 只入仓 SKILL.md + 一个装依赖的引导脚本」，`node_modules` 由脚本按需拉起并 gitignore，用一次性的体积代价换回可撤回性。
  - **同名并存提醒**：这四个 skill 现在用户级与项目级**各一份**。项目级优先，但两边改动不会自动同步；后续若只改一边，另一边会静默漂移。

- 被否方案：
  - **不迁，只在 `CLAUDE.md` 写指针**（"画图走 archify、抓网页走 baoyu"）：零体积、不碰北极星，是提案时的推荐项。被否原因——不兑现"换机可用"，能力仍绑在本机 `~/.claude` 布局上。
  - **迁但 `.gitignore` 排除 `node_modules`/`vendor`/archify 实体**：体积可控。被否原因——clone 后跑不起来，是"半残"，且缺了什么不显式报错，只会在调用时莫名失败。
  - **移动而非复制**（用户级删除）：被否于提案环节，用户选复制。理由是 `archify`/`baoyu` 是跨项目通用工具，移走会让 iris-ecnu、egrant 等项目立即失去这些能力。

- 修订记录：
  - 2026-09-20：补记——推送前核实 `origin` 为 **public** 仓库，不可逆性为面向公众；用户获知后确认照原计划全量推送。
  - 2026-09-20：首版，四个 skill 全量入仓，`.claude/skills/` 460K → 45M；同时清除两个外项目 profile 中的明文凭据与内网信息，补 `DailyWorkbench.md` profile。
