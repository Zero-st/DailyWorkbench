# DailyWorkbench 防腐化治理方案

> 目标:回答「随着代码增加、模块变复杂,项目会不会变成垃圾堆、怎么预防和解决」。
> 结论先行:**当前底子不错,没变垃圾堆**;真正的腐化发动机不是代码量,而是 **「同一个知识要在多处手工同步」**。本方案 = 长期护栏 + 按 ROI 排序的渐进修复。
> 修订 2026-09-03:初版写于 v0.9.0 之前(Web / `lite/` / Flutter 三端并存)。v0.9.0 删 Flutter/TWA、2026-09-03 删 `lite/` 后,「三端各写一遍」类信号已自然消解;P0 已完成。本版只保留仍成立的部分。

---

## 0. Context

项目约 5.2k 行(前端 `js/` 3.1k + 后端 2.1k),单端 Web(ES Modules 零构建)+ Python 标准库后端。

**已经做对的(继续保持,是防腐正例):**
- 前端 `js/` 已模块化(`core/ features/ views/`),`app.js` 靠 `import` 复用而非复制。
- 后端单一路径源 `backend/core/paths.py`;写入统一走原子写 `backend/utils/common.py`(临时文件 + `os.replace`)。
- 有 CI 真门禁、pytest、ADR、Diátaxis 文档分类。
- 无死代码堆积、无 TODO/FIXME 堆积、无失控的 utils 大杂烩。

**腐化信号(状态截至 2026-09-03):**
1. ✅ ~~缓存戳资产清单手工维护、已漂移~~——`bump_version.py` 手写 `ASSETS` 曾含 4 个已删文件、漏 `inbox.js`/`platforms.js`。**已根治**:改为自动扫描 + `--check` 校验 `sw.js` FILES 无遗漏/无幽灵。
2. ✅ ~~`lite/` 与主站整套重复(58 个同名函数)~~——**已删除**(ADR 0005 修订)。
3. 🟡 依赖无锁 / JS 无 eslint:Python 依赖靠 CI 里手写 `pip install`;`js/` 无静态检查,`checkJs` 仅覆盖 `core/state.js` + `core/net.js`。
4. 🟡 `window.` 全局桥 140 处(90 处赋值):`kb.js`/`model-manager.js` 是非 ESM 经典脚本 + 内联 `onclick`,模块边界靠自律。ADR 0004 已接受此现状,**不重构**,但新代码不再新增。
5. 🟡 `backend/core/config.py` 每键 4 层回退,含 `supabase.local.json`/`kb.local.json` 旧分文件兼容分支——过渡代码,可删。
6. 🟡 `data.json`/`ai_daily.json`/`daily_news.json` 是提交产物,本地一跑 refresh 就上千行 diff 脏工作区(Pages 根部署的固有代价)。

---

## 第一部分:长期护栏(预防腐化)

腐化不是某天突然发生,是每次「差不多就行」累积。防腐的本质是**让"正确的事"变成自动的、让"错误的事"变难**。护栏 > 自律。

### 护栏 A · 让机器守住"手工清单"(已落地,推广判据)
凡是「必须手工保持多处一致」的清单,都是漂移源。`bump_version.py` 的资产清单已改扫描;`sw.js` FILES 仍手写但被 `--check` 校验。
- **判据**:再出现「加一个文件要同时登记到 N 处」的清单,第一反应是让脚本扫描或校验,而不是写进检查清单让人记。
- **出处**:DRY 的真义——消除「知识」的重复(《务实的程序员》/《重构》)。

### 护栏 B · 单一事实源
判据:**同一个知识改一次要改几处?超过 1 就该收敛。** 当前范例:`data.json` 契约只定义在 `js/core/net.js` 的 `WBData`;平台枚举只在 `js/core/platforms.js`;路径只在 `backend/core/paths.py`。新功能照此办。

### 护栏 C · 文件体量预算
上帝文件不是一天长成的。约定「单文件软上限 ~500 行」,超了就问"这个文件能不能一句话说清它干嘛"。当前最大 `js/app.js` 约 750 行(已自标待拆,按注释逐视图剥到 `js/views/*`)、`backend/pipeline/export_data.py` 584 行。
- **代价**:别拆过头——500 行是信号不是硬红线,以"能否一句话说清职责"为准。

### 护栏 D · 锁依赖 + 补 JS 静态检查(治信号 3)
- ① 把 CI 里手写的 `pip install pytest flake8` 固化成 `requirements-dev.txt` 并锁版本。
- ② JS 侧加最小 eslint(先只开 `no-unused-vars`/`no-undef` 等高信号规则,非阻塞起步)。
- **代价**:eslint 全开会淹在告警里——从零规则起步,逐条打开。

### 护栏 E · 抽象靠"三次法则",别提前
GitHub contents 推送逻辑在 `daily_ai.py`/`sync.py` 各一份——两次,还不到三次,**先不抽**。
- **出处**:三次法则 + 「错误的抽象比重复更糟」。

---

## 第二部分:渐进修复路线图

**铁律:不做大爆炸重写。** 小步 + 每步可验证 + 每步能停。按 ROI 排序:

### P0 · 修 `bump_version` 漂移 ✅ 2026-09-03 完成
资产清单改为扫描 `js/**/*.js`/`css/`/`vendor/`/manifest/icons;`--check` 与 `apply` 同时校验 `sw.js` FILES;新增 3 个测试(含「新增模块必换 CACHE」回归钉)。

### P1 · 补 eslint + 锁依赖(0.5 天,治信号 3)——**下一个工程批次候选**
1. `requirements-dev.txt` 固化后端 CI 依赖。
2. `.eslintrc` 最小规则集 + CI 非阻塞 job。
- **验证**:CI 新增 job 能跑出告警但不挂;本地 `eslint js/` 有输出。

### P2 · 清 `config.py` 旧分文件回退(0.5 天,治信号 5)
删 `supabase.local.json`/`kb.local.json` 兼容分支,只留 环境变量 > `workbench.local.json` > 平台默认 三级(README 已只写这三级)。
- **验证**:现有配置不动;`/api/models`、`/api/kb/*` 行为不变。

### P3 · `js/app.js` 逐视图剥离(按需,治护栏 C)
按 `app.js` 自述,把视图逻辑逐个搬进 `js/views/*`。**真被咬到再做**,不为拆而拆。

### 不做(除非被咬)
- `window.` 桥重构(ADR 0004 接受)。
- `data.json` 脏工作区(Pages 根部署固有;若嫌烦,本地 `git update-index --skip-worktree` 三个产物文件,双向门)。

---

## 一句话心法

> 项目不会因为"代码多"变垃圾堆,只会因为**"同一个知识要在多处手工同步"** 变垃圾堆。
> 每加一个功能就问一句:**"这个事实/这段逻辑,以后改它要改几处?"** ——答案 > 1 就是未来的腐化点,当场用护栏 A/B 收敛掉。
