# 复盘 · OpenCLI 取数层接入（重运行时外部工具接入而不破北极星）

> 日期：2026-09-07　性质：活文档（里程碑复盘）
> 关联：`docs/adr/0007-opencli-ingestion-source.md`（决策记录）、`docs/TECH_CHARTER.md`（工程红线）、`docs/principles/开发心法-多维思维总纲.md`（心法上位）、`.claude/plan/opencli-mvp-hackernews.md`（实施计划）、同族 `docs/planning/复盘-MVP闭环首跑.md`
> 一句话：把 OpenCLI（需 Node≥20 的外部 CLI）当作**取数层数据生产者**接入，MVP 用 Hacker News 端到端跑通，而 App 本体**仍零依赖·离线可跑**——验证了「重运行时工具接入而不破北极星」的**取数层劣化范式**。

---

## 1 · 结论 + 战果

- **战果**：资讯视图新增「Hacker News 热帖」卡片，20 条真实数据经 `opencli hackernews top` 抓取、映射、聚合、渲染，端到端跑通。App 前端 + `server.py` **保持 node-free、双击/离线可跑不变**。
- **落盘**：`backend/pipeline/fetch_hacker_news.py`（新源）、根级 `hacker_news.json`（中间产物）、`data.json` 顶层新字段 `hackerNews`、`backend/core/config.py` 的 `opencli_cmd()`、`docs/adr/0007-opencli-ingestion-source.md`、`test_workbench.py` +6 用例。
- **质量门**：5 个 CI 门禁全绿（`bump_version --check` / `check_design_tokens` / flake8 E9F7 / pytest 37 / `tsc --noEmit`）；Chrome DevTools MCP 走查确认真实渲染；**优雅劣化实测**（不装 OpenCLI 门禁照样绿）。
- **意义**：这不是"又加一个源"——是**证明了一种范式**：一个违背「零依赖」的重工具，只要关进「取数层 + 优雅劣化」，就能既扩优质信息又不动 App 的北极星。后续接任意外部取数源都可套这套。

---

## 2 · 接入思想（核心心智模型）

**① 运行时结合 vs 取入时结合**——北极星（`git clone` 即跑、双击 `index.html`、三年不腐）管的是**交付物（App）**，不是**取数管道**。取数「必须联网」本就是既有 `fetch_ai_daily`/`fetch_daily_news` 的性质，不是 App 的性质。关键动作：**找既有的「数据契约缝」`data.json` 当隔离层**——前端只吃 `data.json`、离线可跑；OpenCLI 落在缝的后面（生产 `data.json` 的一侧），永远够不到 App 运行时。

**② 优雅劣化 = 上重依赖的安全阀**——`fetch_hacker_news` 在 `opencli` 缺失/失败时**保留旧数据、静默跳过**，`export_data` 照常成功、其余源不受影响。这一步把「重依赖」变成「可缺省的增强」：**重依赖永不成核心链路的硬依赖**，于是「上一个 Node 运行时」这个吓人的单向门，被降级成**可逆**（删文件 + ADR 追修订即回退）。

**③ 摊销才划算**——多数公开源（HN/arXiv/GH Trending）用 Python stdlib `urllib` 也能拿。**单源用 stdlib 更省、更贴北极星、零 ADR**；OpenCLI 只在「广接十几+ 源、低保守、把站点改版维护外包给它」时才摊得回 Node 运行时的成本。所以**先 MVP 试点 1 源，用证据决定扩不扩**（YAGNI），而不是一上来就上工具。

> **规律**：接外部重工具，先问它落在「App 运行时」还是「取数层」；能靠既有契约缝隔离 + 优雅劣化兜底的，就不是单向门，是可逆的双向门。

---

## 3 · 执行步骤（如实记录本次执行）

### A. 探查定盘
- **并行 Explore 两库**（OpenCLI 能力 + 本仓信息管道），一次拿齐证据；先翻 `TECH_CHARTER.md`「引入 X 四问」，Q2「重依赖→否」一条解掉大半纠结。
- 用 `AskUserQuestion` 把**两个真正的分岔**交给用户拍板：接入范围（MVP 试点 / 广接 / 只加 1-3 源）、源类型（公开免登录 / 也要登录墙内）。定为「MVP 1 源 + 公开源优先」。

### B. 取数层（Python stdlib + subprocess，不给 Python 侧引第三方依赖）
- `config.opencli_cmd()`：环境绑定进配置，`env WB_OPENCLI_CMD > workbench.local.json opencliCmd > PATH`，缺失返回 `None`。
- `fetch_hacker_news.py`：镜像 `fetch_daily_news.py`——`subprocess.run([*cmd, "hackernews","top","--limit","20","-f","json"])` → 按退出码分支（0/66/69/77）→ 映射到本仓统一 item `{title,summary,url,source}`（无外链的 Ask HN 回退 HN 讨论页）→ **失败不覆盖旧文件**。
- `export_data.get_hacker_news()`：镜像 `get_daily_news`，14 天 history 累积随 `data.json` 推送持久化。

### C. 契约 + 前端
- `js/core/net.js` 的 `WBData` typedef 加 `hackerNews`（否则 `tsc` 红）；`js/app.js` `normalizeData()` 兜底；`js/views/info.js` 加 `renderHackerNews`（**复用现成 `renderNewsItem`/`.card`/`.nw-grid`**）；`index.html` 加 `hnewsBlock` 容器。

### D. 门禁
- 改前端资产 → `python bump_version.py`；`tsc`/flake8/pytest/令牌全跑。**纯复用现成类、无新视觉/组件/骨架 → 按界面准则 §6.0 免出效果图**。

### E. 验证
- OpenCLI 冒烟 → `fetch_hacker_news`（生成 20 条）→ `export_data`（`data.hackerNews` 就位）→ **优雅劣化实测** → Chrome MCP 走查渲染。

> 逐行改动清单见 `.claude/plan/opencli-mvp-hackernews.md`，此处只留指针。

---

## 4 · 优缺点（OpenCLI 选型账本）

**优**
- **324 条 `browser:false` 免登录源**（HN/arXiv/GH Trending/学术/StackOverflow/ProductHunt…），一处调用拿多源。
- **统一 JSON 输出**（`-f json`）、决定论、可脚本化（`subprocess`→`json.loads`）、退出码规约（0/66/69/77）。
- **站点改版维护外包**给 OpenCLI（autofix 机制），不用自己养一堆爬虫。
- **（未来）登录态复用**：`browser:true` 源复用已登录 Chrome，免 API key——是 Twitter/知乎/小红书这类墙内优质源的解法。

**缺**
- **需 Node≥20 运行时**：多一个可能腐烂的工具链，是本仓「最大失败模式=某天跑不起来」的一次让步（用劣化关住）。
- **schema 每命令自描述、非全局统一**：字段名相近但不保证都有 `time`/`content`，须按每条 `columns` 映射（读 `cli-manifest.json`）。
- **`browser:true` 源需 Chrome Bridge + daemon + 登录态**，退出码 69/77，**不适合无人值守定时任务**。

> 账本一句话：**公开源单接用 stdlib 更省；OpenCLI 的价值在"规模 + 维护外包 + 未来墙内源"，且必须锁在取数层。**

---

## 5 · 优化改进清单

标注【代价 · 门】。门性沿用宪章：双向门＝错了随时改，较大门＝动前先评估。

| 类别 | 现状痛点 | 改进方向 | 代价 · 门 |
|---|---|---|---|
| 版本控制 | `hacker_news.json` 未跟踪，而同类 `daily_news.json` 已入库 | 决定是否纳入版本控制（与 ai_daily/daily_news 一致） | 低 · 双向 |
| 抽象时机 | 单源 `fetch_hacker_news` 硬编码命令/映射 | **广接 10+ 源时**才抽「源注册表」：读 `cli-manifest.json` 过滤 `browser==false && access=="read"` 自动生成源清单/字段映射 | 中 · 较大门（改 ADR 0007） |
| 可移植 | `opencliCmd` 指向本机 clone 的 `dist/src/main.js` | 路径已进 `workbench.local.json`（环境绑定进配置）；生产机需各自装/建 OpenCLI | 低 · 双向 |
| 兼容性 | summary 里 `💬` emoji 在页面字体下渲染成豆腐（▯） | 已改纯文本 `N 评论`（走查抓到当场修） | — · 已修 |
| 上生产 | 生产 WorkBuddy 机尚未装 OpenCLI，`sync.yml` 步骤会 `continue-on-error` 跳过 | 上生产前在那台构建/装 OpenCLI，之后每小时 sync 自动带上 | 低 · 双向 |

---

## 6 · 复盘（做对 / 踩坑 / 下一步）

**做对了什么**
- **红线优先**：先用「引入 X 四问」定性，不空谈，Q2 一条把 80% 纠结解掉。
- **优雅劣化当安全阀**：让重依赖可缺省，把单向门降级为可逆——这是整套接法的地基。
- **分岔交用户**：范围/源类型两个真分岔用 `AskUserQuestion`，不替用户假设。
- **镜像现成模式**：第三个源 = 复制 `dailyNews` 三处对称，**不提前抽象**「源注册表」。
- **非破坏验证**：本机非生产机，`export` 前**备份 `data.json`、验完逐字节还原**；劣化用「不装也绿」自证。
- **走查驱动真实渲染 + 当场抓 bug**：Chrome MCP 看到真 UI，顺手抓出并修掉 `💬` 豆腐。

**踩了什么坑**
- **本机无 `~/.workbuddy`**（非生产 WorkBuddy 机）：素跑 `export_data` 会用空状态覆盖真 `data.json` → 靠备份/还原兜住。
- **`💬` emoji 豆腐**：页面字体缺该字形 → summary 改纯文本。
- **SPA × MCP 脆性**：`reload` 后 `list_pages` 空、`Target closed` 连接掉；按记忆**不 kill/重启折腾**，靠已有截图 + 数据层复检收尾。
- **端口 8899 已被占**：我起的后端因 `Address already in use` 失败——原是**用户自己在跑的进程**（`pgrep` 确认属主，未动）。

**下一步（二选一或并行）**
- **扩第二个源**（arXiv / GitHub Trending）：接法完全一致，只换命令与字段映射。
- **上生产**：生产机装 OpenCLI，让每小时 `sync` 自动带上。
- **收尾 commit** + 决定 `hacker_news.json` 是否入库（**单独征询后做**）。

---

## 7 · 可迁移心智模型（行动卡：接下一个外部取数源）

| 触发场景 | 心法 / 护栏 | 代价 · 边界 | 出处 / 本例 |
|---|---|---|---|
| 想接个**重运行时**外部工具（Node/浏览器/守护进程） | 先问它进不进 **App 运行时**；能只落**取数层**就不碰交付物 | 取数那台需该工具，App 不受影响 | 本例 OpenCLI/Node；`TECH_CHARTER` 四问 Q2 |
| 怕破「零依赖·离线可跑」 | 找**既有数据契约缝**当隔离层 + 缺了**优雅劣化** | 缺工具则该源静默跳过、保留旧数据 | `data.json` 契约 + `fetch_*` 失败不覆盖 |
| 纠结「上运行时/改契约」是不是**单向门** | 用劣化把它降级成**可逆**；真单向门才写 3 行 ADR | 契约字段改动同步 `WBData` typedef | `adr/0007-opencli-ingestion-source.md` |
| **单件 vs 规模** 选型 | 单源用 stdlib（更省）；规模 + 维护外包才上工具 | 摊销点：≈10+ 源 | 324 免登录源 vs 写一个 `urllib` 抓取器 |
| 想提前抽象「通用适配层/注册表」 | **别提前**；镜像现成模式（复制最近的同类实现） | 第 N 个源才抽象（YAGNI） | 复制 `get_daily_news`/`renderDailyNews` |
| 验证会动**生产数据 / 外部副作用** | **非破坏**：备份→验→还原；用「不装也绿」自证劣化 | 非生产机尤其要备份 | `data.json` 备份/还原、门禁自证 |

> **铁律**：外部工具的「重」只要关进**取数层 + 优雅劣化**这两道闸，就永远威胁不到 App 的北极星；关不进去的，才需要认真写单向门 ADR。

---

## 8 · 与 ADR 0007 / 计划 / 宪章的分工（别重复、别打架）

| 文档 | 管什么（层次） | 一句话 |
|---|---|---|
| **本文（复盘）** | 执行层：**这次怎么跑通 + 踩了什么 + 学到什么** | 步骤 / 优雅劣化实测 / 可迁移心智模型 |
| [`../adr/0007-opencli-ingestion-source.md`](../adr/0007-opencli-ingestion-source.md) | 决策层：**决策 / 理由 / 代价 / 何时重估** | 单向门留证 |
| [`../../.claude/plan/opencli-mvp-hackernews.md`](../../.claude/plan/opencli-mvp-hackernews.md) | 计划层：**接下来改哪些文件** | 改动清单（已执行） |
| [`../TECH_CHARTER.md`](../TECH_CHARTER.md) | 工程红线 | 取数层可调外部 CLI，但不进 App 运行时 |

本文**不重复** ADR 0007 已记满的内容：A（手写 stdlib）/B（走 OpenCLI）两路对比、三条决策、三条代价、三个「何时重估」。要看**为什么这么决策**去 ADR 0007；本文只讲**怎么执行、踩了什么、抽出什么心智模型**。

---

## 9 · 变更记录

- 2026-09-07 · v1.0 · 首版·OpenCLI 取数层 MVP 复盘 · 缘起：Hacker News 端到端接入完成，把这次的思想/步骤/优缺点/心智模型沉淀留证。
