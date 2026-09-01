# 复盘 · MVP 闭环首跑（蒸馏库落下第一张真实经验卡）

> 日期：2026-09-01　性质：活文档（里程碑复盘）
> 关联：`docs/planning/知识飞轮-路线图.md` v1.5、`CHANGELOG.md` [Unreleased]、`.claude/plan/phase1-蒸馏库.md`
> 一句话：知识飞轮最窄闭环「**捕获 → 蒸馏 → 入库 → 复用**」首次用**真实内容**转通一圈，蒸馏库 **0 → 1**。

---

## 1 · 结论 + 战果

- **战果**：用真实素材（小红书〈最近装了10个Skill，说下真实感受〉@出海指南）走通全链路，在 Obsidian 蒸馏库落下**第一张经验卡**。此前 `/api/kb/deposits` 为空——飞轮从没用真实内容转过。
- **落盘**：`devmd/蒸馏库/2026-09-01/Codex-Claude-进阶必装的-10-个-AI-Skills-用途与何时该用.md`（4064B）+ `devmd/_index.jsonl` 追加 1 条。
- **质量门**：`bump_version.py --check` 绿；Chrome 走查 `list_console_messages` 零 error/warn；frontmatter 契约全字段齐（platform=xhs / author / url / topic / actionable[3]）。
- **意义**：这是 walking skeleton 的"骨架接通"——不是又加一个功能，而是**证明整条链路能端到端跑**，且是用户真会用的方式（人在环中、真实内容 dogfood）。

---

## 2 · 详细步骤（如实记录本次执行）

对应「五步管道」：取材 → 萃取 → 冷凝 → 入库 → 复用。

### A. 修接线（清门禁）
- 新增的 `js/features/inbox.js`（收件箱捕获层）+ `js/core/platforms.js`（平台枚举）加入后，`bump_version.py --check` 报红（index.html / sw.js 版本戳未同步）。
- 跑 `python bump_version.py` → CACHE=workbench-1e4ba293，`--check` 转绿。**不手改版本戳**，交给脚本。

### B. 取材（`baoyu-url-to-markdown`）
1. **自动模式**抓 xhs → 命中登录墙：markdown 仅 6 行 frontmatter、HTML 快照 **55 字节**（空壳）。
2. 按预案切 **`--wait` 模式**：headful Chrome 弹窗 + 用 **FIFO 命名管道**喂 stdin（占位 `sleep` 保持管道打开），用户在弹窗里**登录小红书**后，往管道发回车触发抓取。skill 用持久 profile——登录一次即记住。
3. 抓到正文，但 readability 混入大量「猜你喜欢」侧栏噪声，**真正的 10 个 Skill 清单在图片卡里**，文字层只有引言。
4. 从捕获 HTML 的 `__INITIAL_STATE__` 取出 `desc` + `imageList`（笔记结构化数据），`curl` 下载内容图 → 转 png → `Read`（读图）**OCR 出完整 10 个 Skill**（名称 / 用途 / 定位）。

### C. 萃取 + 冷凝（六维经验卡）
- 按蒸馏库六维模板拆解：**核心观点 / 方法步骤 / 10 清单 / 适用场景 / 边界反例 / 可复用动作 / 出处**。
- 作者的选型洞察（「装 Skill 别只看热度，要看什么时候该用」）提炼进「核心观点/方法步骤」；10 个 Skill 逐条给「名称→用途→何时该用」。

### D. 真·UI 落卡（Chrome DevTools MCP）
- **不用 `new_page`**（SPA 网络永不 idle 会卡）；`list_pages` 找到已开的 `个人工作台` 标签，用 `evaluate_script(waitForStableDom:false)` 驱动**真实处理器**：
  `switchView('inbox')` → 填 `#ibUrl` + `inboxDetect`(自动识别小红书) + `inboxAdd` → `inboxToDistill(id)`(切蒸馏库 + `distillNew` 预填 url/平台) → 填表单 + `distillSave()` → `window.kbSave(module:蒸馏库, source:distill, extra)` → `POST /api/kb/save`。
- 全程走应用自己的代码路径，`inboxOnDistilled` 自然触发、无重复卡。

### E. 验证（端到端）
- `/api/kb/deposits?module=蒸馏库` = **1 张卡**；收件箱那条回标「**已蒸馏**」；蒸馏库「小红书」筛选命中；右侧六维 Markdown 正常渲染（徽标：小红书/出海指南/#topic/原文链接）。
- 磁盘：`蒸馏库/2026-09-01/*.md` frontmatter 全字段；`_index.jsonl`（在 **DEPOSIT 根**，非模块目录下）追加 1 条。
- `list_console_messages` 零 error/warn。

---

## 3 · 优化改进清单

标注【代价 · 门性】。门性沿用宪章：双向门＝错了随时改，较大门＝动前先评估。

| 类别 | 现状痛点 | 改进方向 | 代价 · 门 |
|---|---|---|---|
| 取材·xhs | 图文帖走 readability 混入大量「猜你喜欢」侧栏噪声，正文/清单在图片卡里，纯文字管道会漏 | 对 xhs 专走 `__INITIAL_STATE__`(desc+imageList)，或直接截图 OCR，不做全页 readability | 低 · 双向 |
| 取材·登录墙 | xhs 自动抓 55B 空壳，每次都要手动切 `--wait` | 文档化「xhs 默认 `--wait` + 持久 profile」，登录一次长期免登 | 低 · 双向 |
| 取材·喂信号 | wait 模式手动 FIFO + 占位 sleep 繁琐，且诱发 `pkill` 自杀 | 封装小脚本 / 用文件信号触发 stdin，别手搓管道 | 低 · 双向 |
| 走查 | `new_page`/`reload` 在 SPA 上卡死 | 统一 `evaluate_script(waitForStableDom:false)` 驱动已开标签（已入全局记忆 + 项目记忆） | — · 已落 |
| 闭环自动化 | 当前「复制指令→人跑→粘回」是人在环中；`CHANGELOG [Unreleased]` 已列候选「捕获侧'从链接到卡尽量一步'（后端直跑蒸馏）」 | **列为待评估**：违背「零依赖·人在环中」取舍，别过早自动化（对照 `design-principles`）；真高频了再单独评估 | 中 · 较大门 |
| 复用端 | 卡只按时间浮现 | `CHANGELOG` 候选「相关时浮现」：按 topic/tag 匹配，非仅时间驱动 | 中 · 双向 |
| 工程收尾 | `inbox.js`/`platforms.js` 仍未跟踪；bump 后 index.html/sw.js、路线图 v1.5、本复盘未提交 | 一个收尾 commit（**单独征询后做**，本次不提交） | 低 · 双向 |
| 诚实项 | 图文帖内容在图里，纯文字会漏 | 卡的「边界反例」已标注来源受限——保持这种诚实标注习惯 | — |

---

## 4 · 复盘（做对 / 踩坑 / 下一步）

**做对了什么**
- **先跑最窄闭环**（walking skeleton）：不贪功能，先把一条链路端到端接通。
- **人在环中、不过度自动化**：取材/萃取交给 skill + 人确认，守住「零依赖」北极星。
- **真实素材 dogfood**：用用户真会存的内容，而非 mock，暴露真实摩擦（登录墙、图片内容）。
- **走查驱动真实代码路径**：`evaluate_script` 调应用自己的处理器，而非绕过 UI 直接 POST，保证回标/去重等副作用真实发生。
- **取材受限如实标注**：内容在图里、纯文字会漏，写进卡的边界反例，不假装合格。

**踩了什么坑**
- **chrome-devtools `new_page` 卡死**：SPA 网络永不 idle → 已沉全局 + 项目记忆，改 `evaluate_script`。
- **`pkill -f` 两次自杀（exit 144）**：`-f` 匹配到自己 shell 命令行里的 pattern → 连自己一起杀。改 `pgrep` 拿 PID + 排除 `$$` + `kill`。
- **误判进程堆积**：一度以为 100+ mcp 进程是自己泄漏，实为**多用户共享机上别人的进程**，无权也不该动。
- **xhs 抓取噪声/登录墙**：见上改进清单。
- **`_index.jsonl` 路径记错**：它在 **DEPOSIT 根**（`devmd/_index.jsonl`），不在 `蒸馏库/` 模块目录下。

**下一步（二选一或并行）**
- **收尾 commit**：把 inbox 捕获层 + bump + 路线图 v1.5 + 本复盘一起提交。
- **Phase 2**（路线图）：每日灵感「随手记 + 留存」到 Obsidian `灵感/`，+ Obsidian 库纳入 git 自动备份。
