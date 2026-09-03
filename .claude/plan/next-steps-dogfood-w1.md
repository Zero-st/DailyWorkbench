# DailyWorkbench · 现状体检 + 下一步执行计划

> 日期：2026-09-03　基线：v0.9.1（`d24f648`）　获批后复制一份到 `.claude/plan/next-steps-dogfood-w1.md`。

## Context（为什么现在做这份）

用户要求「分析当前项目 → 给出接下来要执行的步骤 → 持续探讨」。项目 6 天内（08-27 → 09-02）连发 25 个 commit 走到 v0.9.1，
知识飞轮最窄闭环（捕获→蒸馏→入库→复用）已用真实内容跑通 **1 次**（蒸馏库仅 1 张真卡）。
最近 5 个 commit 全是 docs / 表现层 / 工程收敛。用户自己的《开发心法》§5 给了自检信号：
「连续几周动作全在表现层/工程层 → 警惕是否在回避方向决策」。

**用户已拍板（2026-09-03）**：① 下周主戴**产品帽·dogfood 冲刺**；② **删 `lite/` + `vendor/xlsx`**；③ `anti-rot-governance.md` **精简后提交**；④ 止血批次带上 **kb.save 测试 / T2 轮询守卫 / app.js 僵尸 / scripts 硬编码路径** 四项。

---

## 一、体检结论（只读探查，代码 + 文档双侧）

### 1. 底子好，不是垃圾堆
- 前端 `js/` 3162 行 / 17 文件，最大 `app.js` 752 行；后端 2094 行、stdlib 零依赖、路由表分派。
- TODO/FIXME = 0，console.log = 0，注释写「为什么」。原子写、路径单一源、CI 真门禁都在。
- 治理文档体系完备（宪章 / 5 ADR / 路线图 / 总览 / 复盘 / 走查评审 / 设计准则 / 心法 / 文档地图）。

### 2. 真正的问题：产品验证不足，工程投入相对过重
| 信号 | 证据 |
|---|---|
| 飞轮只转过 1 圈 | `/api/kb/deposits` = 1 张卡；温故卡从未在「有多张卡」的真实状态下运行过 |
| 文档 : 代码 比例极高 | docs 20 篇 vs 代码 5.2k 行；近 5 commit 无一条产品功能 |
| 核心写路径零测试 | `/api/kb/save` + `_index.jsonl`（飞轮唯一持久化路径）没有任何 pytest；现有 8 个测试只覆盖工具函数 |
| 权威副本无备份 | Obsidian vault 是「权威副本」，git 备份排在 Phase 2，当前为零 |

### 3. 潜伏 bug（真会咬人，修起来便宜）
- **`bump_version.py` ASSETS 已漂移**（`bump_version.py:21-43`）：4 个幽灵条目（`schedule.js`/`ov.js`/`sess.js`/`cap.js`）+ **漏 `js/features/inbox.js`、`js/core/platforms.js`**。单独改这两个文件不会换 SW CACHE → 客户端吃旧缓存。CI `--check` 检不出（清单本身错）。另：`sw.js` 的 `FILES` 也是手写清单，若含不存在的文件，`addAll` 404 会让**新 SW 永远装不上**。
- **经验卡标题被改写**（新发现）：`kb.py:229→250→260` 把清洗后的文件名当 `title` 写进 frontmatter 和 `_index.jsonl`，前端 `distill.js:72-75` 直接显示它。现有真卡显示为 `Codex-Claude-进阶必装的-10-个-AI-Skills-用途与何时该用`。dogfood 第一天就会看到。
- `js/kb.js:202` 轮询守卫读未定义的 `__view`（走查评审 T2）→ 知识库视图 30s 自动刷新从不触发。
- `js/app.js:660` `backupExport/backupImport` 重复挂载（`:649` 已挂）；`app.js:29` `switchTab` 纯转发僵尸（唯一调用者 `views/ai.js:118`）。

### 4. 结构性欠账（本轮只处理已拍板的）
- `lite/` 1785 行、58 个同名函数重复、`schedule.js:146` 引用的 xlsx 路径已断；`vendor/xlsx.full.min.js` 881KB 主应用不用却随 Pages 整仓部署。→ **删**。
- `scripts/` 混 3 台机器硬编码路径；`run_refresh.vbs` 指向已不存在的 `D:\AiProject\personal-workbench`。→ **清**。
- `window.` 桥 140 处、`kb.js`/`model-manager.js` 非 ESM（ADR 0004 已接受）、`config.py` 4 层回退、`data.json` 提交产物脏工作区 → **本轮不动**，留 anti-rot 护栏文档里。

---

## 二、执行步骤

### 第 0 步 · 计划归档（5 分钟）
- 把本文复制到 `.claude/plan/next-steps-dogfood-w1.md`（用户全局约定）。

### 第 1 步 · 止血批次（工程帽，预计半天，一次收完就换帽子）

按依赖顺序执行；每小项完成即跑 `python bump_version.py --check && python -m pytest -q`。**提交前逐次征询**（宪章维度四）。

**1a. 删 `lite/` + `vendor/xlsx.full.min.js`**（先删，否则 1b 的 FILES 校验会报 xlsx 缺失）
- `git rm -r lite/ vendor/xlsx.full.min.js`。
- 文档同步：`README.md`（§二表 F 行 :79、§四 场景 F :142-147、结构树 :243 与 :263）；`docs/TECH_CHARTER.md:33` 多端行去掉「仅留独立 lite/」；`docs/planning/项目总览-需求与进度.md:71`；`docs/adr/0005-pc-first-drop-native-mobile.md` 末尾追加一行修订：「2026-09-03：`lite/` 亦下线——58 处函数与主站重复、xlsx 引用已断、无实际使用；来日轻量版从主站按需裁，不再维护分叉」。
- `CHANGELOG.md` `[Unreleased]` 加 `### Removed`。版本号届时定（参照 v0.9.0 删交付形态记 MINOR）。

**1b. `bump_version.py` 清单自维护 + FILES 校验**（治「手工清单必漂移」的根）
- `bump_version.py`：删 `ASSETS`（:21-43），新增 `ASSET_GLOBS = ("js/**/*.js", "css/*.css", "vendor/*.js", "manifest.json", "icons/*")` + `discover_assets(base)`（`glob` recursive、`relpath` 后 `replace("\\","/")`、`sorted`）。`compute_stamps` 改为遍历 `discover_assets(base)`。白名单目录天然排除 `data.json`/`*.local.json`/`docs/`/`*.d.ts`。
- 新增 `sw_files(base)`（`re.search` 解析 `const FILES = [...]`，注意 sw.js 首字节是 BOM，不能用 `match`）与 `check_sw_files(base)`：返回「扫描到但 FILES 缺少」+「FILES 引用了不存在文件（幽灵）」两类问题。
- `main()`：`--check` 分支同时判 `check()` 与 `check_sw_files()`，任一非空退出码 1；`apply` 分支写完后也跑 `check_sw_files()`，有问题打印「请手动增/删 sw.js FILES：…」并返回 1（apply 不自动改 FILES，本轮只校验，diff 最小）。
- 保持 `check()`/`apply()` 签名与 stamp/CACHE 算法不变 → 现有 2 个 bump 测试零改动。
- 跑一次 `python bump_version.py`：只有 `sw.js:2` CACHE 会变（inbox/platforms 首次参与 hash）。
- `test_workbench.py` 新增 3 测：`test_discover_assets_scans_tree_and_excludes_noise`（放 `js/core/x.js`、`js/types/g.d.ts`、`lite/app.js`、`data.json`、`vendor/m.js`，断言只扫到 css/js/vendor 三类）；`test_check_sw_files_reports_missing_and_ghost`；`test_new_module_rotates_cache`（新增未带 `?v=` 的模块 → `check()==["sw.js"]` 且 CACHE 变化——这就是 inbox.js 事故的回归钉）。`_fake_frontend` 注释里 `ASSETS` 改 `ASSET_GLOBS`。
- 文档同步：`README.md:204-205`、`docs/版本管理规范.md:70-71`、`docs/design/界面设计准则.md:108` 把「手加 ASSETS」改为「新增 js 自动扫描；只需把文件加进 sw.js FILES，漏了 `--check` 会红」。

**1c. `kb.save` / `list_deposits` 回归测试**（保护飞轮唯一写路径）
- ⚠️ `backend/clients/kb.py:18` `VAULT, DEPOSIT = wb_config.kb()` 是**导入时求值**，且本机 `workbench.local.json` 配了真实 vault → 测试必须 `monkeypatch.setattr(kb_service, "VAULT"/"DEPOSIT", ...)`，**不能**改 env 或 patch `wb_config.kb`（晚了）。沙箱布局 `vault=tmp/vault`，`deposit=vault/沉淀`，顺带验证 `vaultPath`。
- 3 个测试，放在 `test_workbench.py` 的 `_clean_title` 段之后：
  - `test_kb_save_writes_note_and_index_then_lists_card`：save 带 `extra{platform,author,url,topic,actionable}` → 文件落 `蒸馏库/YYYY-MM-DD/<name>.md`；frontmatter 各字段齐（`url` 含冒号需正确 partition、`actionable` 列表、`savedAt` 以 `+08:00` 结尾）；`_index.jsonl` 在 **deposit 根**而非模块目录、恰 1 行、键集合固定、`author/url` **不在**索引（现状）；`list_deposits("蒸馏库")` 返回 1 张且 `platform/topic` 匹配、`list_deposits("收件箱")==[]`。
  - `test_kb_save_same_title_same_day_gets_numeric_suffix`：同题两次 → `重复.md` / `重复-2.md`，不覆盖；索引 2 行；列出顺序新→旧。
  - `test_kb_save_rejects_bad_module_and_neutralizes_traversal`：非白名单 module → `ok False` 且零副作用；`"../../etc/passwd"` → 文件名 `etc-passwd.md` 且落在 day_dir 内；非白名单 source 归 `note`。
- 日期从返回值 `res["path"]` 反推，不 mock 时间。

**1d. 经验卡标题不再被改写**（新发现，建议带；不想带就划掉这一条，1c 测试断言相应改回现状）
- `kb.py:216-270` save：frontmatter `title` 与 `_index.jsonl` 的 `title` 写**用户原标题**（`_fm_scalar` 已能处理引号），清洗名只留 `fileName`。`list_deposits` 不变。1c 的 T1 断言改为 `fm["title"]=="我的 笔记"`。
- 已落盘的那张真卡：手动改一下 frontmatter 与索引行即可（一张卡，不写迁移）。

**1e. T2 · `js/kb.js:202` 轮询守卫**
- 改为读路由真实状态：`if (window.__view !== "kb") return;`（`state.js` 的 `setView` 已镜像 `window.__view`，宪章维度二「状态单一真源」）。删掉 `typeof __view` 那半句。

**1f. `js/app.js` 僵尸清理**
- 删 `:29` `switchTab` 与 `:77` 的 `window.switchTab =`；`js/views/ai.js:118` `switchTab("ai")` 改 `switchView("ai")`，`ai.js:4` 注释同步。
- `:660` 去掉重复的 `window.backupExport = backupExport; window.backupImport = backupImport;`。

**1g. `scripts/` 去硬编码**
- `refresh.cmd` / `start_workbench.cmd`：Python 路径改 `if defined WB_PYTHON (set "PY=%WB_PYTHON%") else (set "PY=python")`，用 `"%PY%"` 调用；顶部注释说明「设环境变量 WB_PYTHON 指向托管 Python，不设则用 PATH 里的 python」。
- 删 `run_refresh.vbs`（指向不存在的仓库、属计划任务时代，`delete_workbench_tasks.cmd` 就是用来清那套任务的）。
- `setup_runner.ps1`：`$RunnerDir` 改为 `param` 带默认值 `D:\actions-runner`；清掉注释里 `C:\Users\13115`、`D:\Users\qingdeng-ws\personal-workbench` 等他机路径，用法示例写相对路径 `.\scripts\setup_runner.ps1`。
- `README.md:99`「已配好托管 Python 路径」→「读 `WB_PYTHON` 环境变量」；`:264` 结构树去掉 `run_refresh`。

**1h. 精简并提交 `.claude/plan/anti-rot-governance.md`**
- 删：§0「三端并存/15.2k 行」表述（改 5.2k 行、单端）、信号 1/2（Flutter 三端重复，v0.9.0 已解）、护栏 B（provider 清单现仅一处）、P2/P3 整节、P4 的移动端半句。
- 改：P0 标「✅ 2026-09-03 完成（清单自动扫描 + FILES 校验）」；`lite/` 段落改「已决策删除（2026-09-03）」；P1（`requirements-dev.txt` 锁依赖 + 最小 eslint 非阻塞 job）保留为**下一个工程批次**候选；护栏 A/C/D/E 保留。
- 「一句话心法」保留。

**1i. 收尾**
- `python bump_version.py`（1e/1f 改了 js）→ `--check` 绿 → `pytest -q` 绿（8 + 6 = 14 个）→ `flake8 --select=E9,F63,F7,F82`。
- Chrome 走查（按 [记忆] 走 `evaluate_script` 驱动已开标签，别 `new_page`）：7 视图 console 零 error；知识库视图停 30s 后改 vault 里一个 md，树自动刷新（T2 验证）；DevTools Application 里 CACHE 名已换。
- 分主题提交（建议 4 个：`chore: 删 lite 分叉与 xlsx` / `fix(build): bump 清单自动扫描 + FILES 校验` / `test(kb): save 写路径回归` + `fix: 标题不改写/T2/僵尸/scripts` / `docs: anti-rot 精简`），**每次提交前征询**。

### 第 2 步 · dogfood 冲刺（产品帽，5–7 天，从 09-04 起）

**规则（写死，防工程帽偷跑）**
- 这一周**不加新功能、不重构**。唯一允许的代码改动：阻断闭环的 bug（定义：某一步无法完成，而不是「不顺手」）。
- 每天至少走一次真实闭环：刷到内容 → 收件箱秒存 → 至少隔天蒸馏 → 看今日温故卡是否浮现、是否真点开。
- 每天结束在日志表填一行，**摩擦写具体动作**（「复制指令到 skill 再粘回，来回 3 次窗口」），不写「不顺手」。

**退出指标**
| 指标 | 目标 |
|---|---|
| 蒸馏库真卡 | ≥ 5 张（当前 1） |
| 温故卡触发且被点开 | ≥ 3 次 |
| 收件箱条目「已蒸馏」转化率 | 记录即可，不设目标（它本身就是结论） |
| 摩擦清单 | ≥ 5 条，按出现次数排序 |

**载体**：新建 `docs/planning/复盘-dogfood冲刺-W1.md`（`-复盘` 后缀 → `planning/`，走 `doc-filing`），结构：目标指标 / 每日一行日志表（日期 · 捕获数 · 蒸馏数 · 温故触发 · 摩擦）/ 周末结论。

**周末决策（用心法 §4 三门给摩擦前三名过筛）**，预置映射：
- 「复制指令→人跑→粘回」占主导 → 重新评估 P3「一步化」（较大门，先 ADR，不直接做）。
- 「卡存了没回头看 / 温故卡不相关」→ P2「相关时浮现」（心法已论证过门，第 3 档最小版：tag 精确匹配）。
- 「灵感没地方记」→ Phase 2 灵感留存。
- 「怕丢」→ vault git 备份（见下）。

**同步的第 1 档手动动作（10 分钟，不进产品）**：在 Obsidian vault 目录 `git init && git add -A && git commit -m "backup"`，这周每天手动 commit 一次。权威副本这周开始装真东西，零备份不合适；先手动，被证明烦了再升第 2 档脚本（路线图 Phase 2）。

### 第 3 步 · 冲刺后（待定，由第 2 步结论决定）
- 产品：上面映射选出的**一个**功能，从第 3 档最小版起步。
- 工程（可并行、小）：anti-rot P1（`requirements-dev.txt` + 最小 eslint 非阻塞）。
- 不做：window 桥重构、config 回退链清理、data.json 脏工作区——除非冲刺里真被咬。

---

## 三、验证方式

**止血批次**
```bash
python bump_version.py --check          # 绿；故意新建 js/core/_x.js 再跑应红（缺 FILES）
python -m pytest -q                      # 14 passed
flake8 --select=E9,F63,F7,F82 .
python -m backend.server 8080            # 后端源打开 http://127.0.0.1:8080
```
- Chrome（chrome-devtools MCP，`list_pages` 找已开标签 + `evaluate_script(waitForStableDom:false)`）：`switchView` 逐个切 7 视图，`list_console_messages` 零 error；知识库视图待 30s、改 vault 一个 md，树刷新；Application → Cache Storage 只有新 CACHE 名。
- 蒸馏库那张真卡标题显示原文（若做 1d）。
- GitHub Pages 推后 30–50 秒再验 `/lite/` 返回 404、主站正常。

**dogfood 冲刺**
- 周末 `复盘-dogfood冲刺-W1.md` 指标行全部有数；`/api/kb/deposits?module=蒸馏库` ≥ 5。
- 结论段写明「下一个功能是 X，因为摩擦 Y 出现 N 次并过了三门」——写不出这句就说明还没验证够，再跑一周而不是开工。

## 四、关键文件
- `bump_version.py`、`sw.js`、`test_workbench.py`、`backend/clients/kb.py`
- `js/kb.js`、`js/app.js`、`js/views/ai.js`
- `scripts/{refresh.cmd,start_workbench.cmd,setup_runner.ps1,run_refresh.vbs}`
- `lite/`、`vendor/xlsx.full.min.js`
- `README.md`、`CHANGELOG.md`、`docs/TECH_CHARTER.md`、`docs/adr/0005-*.md`、`docs/版本管理规范.md`、`docs/design/界面设计准则.md`、`docs/planning/项目总览-需求与进度.md`、`.claude/plan/anti-rot-governance.md`
- 新建：`docs/planning/复盘-dogfood冲刺-W1.md`、`.claude/plan/next-steps-dogfood-w1.md`

---

## 执行记录（2026-09-03）

- 第 0 步、第 1 步 1a–1h **全部完成**；门禁：`bump_version.py --check` ✓（24 个资产，CACHE=workbench-d0b6aa0e）· `pytest` 14 passed · `flake8 --select=E9,F63,F7,F82` ✓ · `node --check` 三个改动 JS ✓ · 后端 8899 已重启加载新 `kb.py`，`/api/kb/deposits` 返回可读标题。
- 已存真卡（`devmd/蒸馏库/2026-09-01/…`）frontmatter 与 `_index.jsonl` 的 `title` 已从连字符版改为「Codex/Claude 进阶必装的 10 个 AI Skills：用途与何时该用」（按文件名反推，可在 Obsidian 里改成你想要的）。
- **1i 的 Chrome 走查未完成**：chrome-devtools MCP 调用被本会话的权限分类器拦截；改起独立无头 Chrome 时发现该进程连不到 127.0.0.1（`data:` 页可渲染、8899 请求未到达后端日志），是运行环境限制。**需在交互会话手动走**：打开 `http://127.0.0.1:8899/index.html` 强刷（Application → Service Workers → Update），切 7 视图看 console 零 error，知识库视图停 30s 后改 vault 一个 md 看树是否刷新，Cache Storage 只剩 `workbench-d0b6aa0e`。
- 第 2 步载体已建：`docs/planning/复盘-dogfood冲刺-W1.md`（含规则/指标/日表/映射），并入 `docs/README.md` 索引。
