# 待办 · 把「练产品感」落到 DailyWorkbench 上（工程版）

> 落位：获批后复制到 `.claude/plan/product-sense-practice.md`（英文 kebab，实施计划不进 `docs/`，依 `docs/README.md:63` 决策表）。
> 姊妹文档：`.claude/plan/产品思维-心法.md`（方法论/心法层，讲"怎么想"）。**本文 = 执行层，讲"接哪些源、建哪条线、每周做什么"**，不重复心法。

---

## Context（为什么做这个）

我在做本项目时发现自己**缺产品体验、不知道好产品长什么样**，问怎么提升、有没有发现好产品的排名网站去体验和模仿。

结论（讨论已达成）：**光刷榜单只长见识，不长产品感；产品感靠「拆解 → 复述 → 仿写」练出来**。而 DailyWorkbench 本身就是最好的练习场——它已经在抓 HN / GitHub Trending，已有一套设计走查门禁（`界面设计准则.md §6.0`）和知识库沉淀能力（`kb_*` MCP）。所以不另起炉灶，而是把"练产品感"这件事**落进现有系统**：

1. 让好产品**每天被动流到眼前**（资讯面板加 Product Hunt / 少数派两路源）；
2. 动新页面前**先看头部产品怎么做**（Mobbin 参考接进 §6.0 效果图流程）；
3. 把"拆解"沉淀成**可检索的资产**（KB 新开「产品拆解」线）；
4. 固化成**每周一拆**的习惯 + 一份精选发现清单。

雄心档位（已确认）：**工程版**——真把两路源接进资讯面板（改 backend + 前端 + 追 ADR），KB 用**新建 module**。

预期产出：两路新资讯源上线、一条「产品拆解」沉淀线可写、走查流程加一步参考锚、一份每周习惯 + 发现清单。

---

## 需求（验收口径）

- [ ] 资讯面板 `#col-info` 多出 **Product Hunt** 与 **少数派** 两个可折叠源块，随 `data.json` 轮询刷新，折叠态记忆复用现成机制。
- [ ] `data.json` 新增顶层字段 `productHunt` / `sspai`，各含 `{date,count,items,history[14]}`，前端有 `normalizeData` 兜底（可逆）。
- [ ] `kb_save` 能以 `module="产品拆解"` 写卡不报错；`kb_deposits("产品拆解")` 能列出。
- [ ] 走查流程 §6.0 明确「新页面前先查 Mobbin 等参考」这一步。
- [ ] 一份《产品发现清单》+《每周拆解 SOP》可查（本文附录即成品，落 KB 或 reference 二选一）。
- [ ] 门禁全绿：`bump_version.py --check`、`check_design_tokens.py`、`test_workbench.py`；无 `|| true` 假绿。

---

## 方案（按可独立提交的任务拆，建议顺序 T4 → T1 → T2 → T3 → T5）

> 资讯源机制（探明）：**无统一源注册表，每源一脚本 + 多处并列 append**，ADR 0007 有意为之（<10 源不抽象）。范式二选一：直连 REST 镜像 `fetch_daily_news.py`；经 OpenCLI 镜像 `fetch_github_trending.py`。**PH 与少数派都走 RSS，用 stdlib（`urllib` + `xml.etree.ElementTree`）直连**，免 Node、贴合零依赖红线。

### T4 · 新建「产品拆解」KB 沉淀线（最快见效，先做）
真源 `backend/clients/kb.py`，写盘落 `/home/dev_st/mtools/devmd/`（本机 depositRoot=vault 根）。
1. `backend/clients/kb.py:21` `MODULES` 列表 append `"产品拆解"`（白名单硬校验，不加会报错）。
2. 同处 `source` 枚举加 `"teardown"`（或复用 `review`）。
3. 约定拆解卡 `extra` 字段（写进 `_index.jsonl` 供筛选）：`platform / author / url / topic` + 拆解四问的结论字段（`user_value` 俞军公式结论、`cut` 它砍了什么、`friction` 摩擦点、`for_us` 本仓能否落地）。
4. `docs/design/知识库沉淀存储方案.md §3.1` 模块表登记「产品拆解」一行（保持文档-代码一致）。
5. 冒烟：终端（非 `--read-only` 那路）用 `kb_save(module="产品拆解", source="teardown", title=..., body=..., extra=...)` 写第一张示范卡，`kb_deposits("产品拆解")` 验证出现。
- 关键文件：`backend/clients/kb.py`、`backend/mcp/server.py`（`kb_save` 在 `if not _READONLY` 内，终端路可写）、`docs/design/知识库沉淀存储方案.md`。

### T1 · 接 Product Hunt 资讯源
每处**并列 append**（镜像 `githubTrending` 全链路）：
1. `backend/core/paths.py` — 加 `PRODUCTHUNT_JSON` 常量。
2. **新建** `backend/pipeline/fetch_producthunt.py` — 直连 PH RSS（`https://www.producthunt.com/feed`），stdlib 解析，产出统一 item `{title, summary, url, source:"producthunt"}`；优雅劣化：抓取失败保留旧 json、不炸编排。
3. `backend/pipeline/export_data.py` — 加 `get_producthunt()`（复制 `get_github_trending` 的 14 天 history 机制），`main()` 调用并塞 `data["productHunt"]`。
4. `backend/pipeline/local_refresh.py` — `STEPS` 加一行。
5. `.github/workflows/sync.yml` — 加一个 `python -m backend.pipeline.fetch_producthunt` step。
6. `js/views/info.js` — 加 `renderProductHunt()`（复用 `renderNewsItem`/`sourceHead`/`nsBodyOpen`），`renderInfo()` 里调用 + 红点计数。
7. `index.html:160` `#col-info` — 加 `<div id="phBlock"></div>`。
8. `js/core/net.js`（`WBData` typedef）+ `js/app.js`（`normalizeData` 加 `productHunt` 兜底）。
9. `sw.js` 版本 / `bump_version.py`、`test_workbench.py` 更新。

### T2 · 接 少数派资讯源
同 T1 全套，源改 `https://sspai.com/feed`，字段 `sspai` / 脚本 `fetch_sspai.py` / 块 `#sspaiBlock` / `renderSspai`。**可与 T1 合并为一个「加两路 RSS 源」提交**（同一模式、同处编辑）。

### T3 · Mobbin 等参考接进走查 §6.0（流程/文档，非代码）
在 `docs/design/界面设计准则.md §6.0`（第126-130行五步流程）第 1 步前加一句锚点：**「出效果图前，先去 Mobbin / Land-book 搜 2-3 个同类头部产品的真实截图作参照，贴进 devhtml 效果图当对照」**。效果图仍落 `docs/reference/devhtml/效果图-<视图>-vX.html`。属沿用现成流程的补强，无新组件类、不触发资产门禁。

### T5 · 习惯 + 发现清单（成品见下方附录）
- 把《产品发现清单》与《每周拆解 SOP》二选一落位：① `kb_save(module="产品拆解", source="note", title="产品发现清单与拆解SOP", ...)` 存进 KB；② 或落 `docs/reference/产品发现清单.md`（`reference/` 惯例）。**推荐 ①**，与 T4 沉淀线同源、可检索。
- 习惯：**每周一拆**——挑一个本周流到面板/自己在用的产品，套「拆解四问」写一张卡（T4 字段），周复盘时回看。

---

## 门禁与红线（TECH_CHARTER + CLAUDE.md）

- 改了 `css/ js/ index.html` 任一资产 → **必跑 `python bump_version.py`**（CI `--check` 会红）。
- `python check_design_tokens.py` — 只用 token 变量，PH/少数派块复用现成 `.ns-*` 类，**不硬编码颜色、不写裸像素**。
- 改 `data.json` 契约（加 `productHunt`/`sspai` 顶层字段）= **单向门** → **追 ADR 0007 §修订记录**（属 ingestion 决策延续，不新立 ADR）。同步 `net.js` typedef + `app.js` 兜底保证可逆。
- 无新视觉语言/新组件类/新布局骨架 → 本轮**不需要 §6.0 效果图**（都是复用现成源块类）。
- Python 一律用 `/home/dev_st/iriswork/tools/anaconda/bin/python`。

---

## 验证（端到端）

1. **数据层**：`python -m backend.pipeline.fetch_producthunt` / `fetch_sspai` 各自产出根目录 json；跑 `backend/pipeline/local_refresh.py`，确认 `data.json` 出现 `productHunt`/`sspai` 顶层字段且 `history` 累积。
2. **前端**：从后端源打开页面（**必须走后端源，否则 Failed to fetch**，见本机运行时记忆），资讯列多出两个可折叠块、能折叠/记忆、红点计数正确；明暗两态都看一遍。
3. **KB**：终端 `kb_save` 写一张「产品拆解」示范卡 → `kb_deposits("产品拆解")` 能列出 → `kb_note(path)` 能读回。
4. **门禁**：`python bump_version.py`（改了前端资产后）、`python bump_version.py --check`、`python check_design_tokens.py`、`python test_workbench.py` 全绿。
5. **回归**：删掉 `data.json` 里 `productHunt` 字段模拟旧数据，确认 `normalizeData` 兜底不白屏（验证契约可逆）。

---

## 附录 A · 产品发现清单（按用途分，别一股脑收藏）

**发现新产品/新点子**
- Product Hunt — 每日新品榜；重点看一句话价值主张 + 评论区真实吐槽。（→ T1 接进面板）
- Hacker News「Show HN」— 开发者晒作品，工程审美硬核。（已在抓）
- There's An AI For That / Toolify — AI 工具形态。
- 少数派 sspai.com — 中文最好的效率工具/品味社区，深度体验文。（→ T2 接进面板）

**学界面/交互（提审美最快）**
- **Mobbin** — 海量真实 App/Web **逐屏截图**，按功能分类（登录流/空状态/设置页…）。做某页前先搜同类看 10 个头部怎么做。（→ T3 接进走查）
- Dribbble / Behance — 视觉灵感，偏理想态，别照抄。
- Land-book / Godly / SaaS Landing Page — 落地页参考。
- Awwwards / CSS Design Awards — Web 设计天花板，动效排版极限。

**学流程/端到端体验**
- Page Flows / UserOnboard — 录制真实产品注册/付费/引导全流程。

**中文产品思考**
- 极客公园、爱范儿 — 产品视角科技媒体。

**给框架的书（比零散刷榜有用）**
- 《Don't Make Me Think》《About Face》— 交互可用性经典。
- Refactoring UI（Tailwind 作者）— 工程师专属，直接给"让界面不丑"的具体规则，和本仓 `界面设计准则.md` 同路。

## 附录 B · 每周拆解 SOP（拆解四问 → 一张卡）

挑一个产品（本周流到面板的 / 自己在用的），回答并存成 T4 的卡：
1. **它服务谁的什么需求？** 第一屏 3 秒内让我懂要干嘛了吗？
2. **用户价值为正吗？** 新体验 − 旧体验 − 替换成本（俞军公式）。
3. **它砍掉了什么？** 好产品的克制 > 堆功能——它敢不做什么？边角（空态/加载/报错）怎么处理？
4. **本仓能落地吗？** 哪一步我能搬进 DailyWorkbench，代价是什么？

> 心法：收藏 ≠ 学会；不落字就是自我感动。每周一张，周复盘回看，判断力是手上练出来的。
