# 把 OpenCLI 接入 DailyWorkbench —— MVP：1 个公开源端到端跑通

## Context（为什么做这件事）

用户想让工作台「更好地获取优质信息」。现状：信息管道只对接 **2 个公开 REST API**（AI HOT、每日60秒），用 Python `urllib` 抓，走 `fetch_*.py → export_data.py → data.json → 前端` 的规约式管道。

`/home/dev_st/mtools/OpenCLI` 把 100+ 网站封装成确定性 CLI（`opencli <site> <cmd> -f json`），其中 **324 条 `browser:false` 命令是纯 HTTP、免登录、免 key、可被 subprocess 直接调用拿 JSON**（HackerNews / arXiv / GitHub Trending / 学术 / StackOverflow / ProductHunt…）——正是「优质信息」的现成来源。

**核心架构判断（不可动摇的一线）**：OpenCLI 需要 Node ≥20.18.1，把它当作**工作台 App 的运行时依赖**会直接违背北极星「零构建·零依赖·离线可跑」（宪章「引入 X 四问」Q2 重依赖）。**因此它只能落在「取数层」——和现有 `fetch_*.py` 抓取器同一层的、可优雅劣化的数据生产者**；App 本体（前端 + `server.py`）保持 node-free、离线可跑不变。

**用户已定方向**：先做 MVP，用 **1 个公开源**把「subprocess→JSON→映射→data.json→前端显示」端到端跑通，跑通再决定要不要扩；**登录墙内源（Twitter/知乎/小红书）后置**，本期不碰 Chrome Bridge。

**预期结果**：资讯视图新增一张「Hacker News 热帖」卡片，数据经 OpenCLI 抓取、随现有每小时管道自动刷新；若 node/opencli 缺失则优雅跳过、不影响其余管道。以此验证 OpenCLI 取数层是否值得推广。

---

## MVP 选型

- **源**：`opencli hackernews top --limit 20 -f json` —— `browser:false`、走 HN 官方 Firebase API、schema 稳定 `[rank,id,title,score,author,comments,url]`、可无人值守。（备选 arXiv，若更想要论文流；接法完全一致，只换命令与字段映射。）
- **落位**：data.json 新增顶层字段 `hackerNews`，**完整镜像现有 `dailyNews` 的实现**（代码已确认几乎是复制粘贴：`get_daily_news`/`renderDailyNews`/typedef 三处对称）。
- **落位触及 `data.json` 契约 = 单向门 → 写 ADR 0007**（宪章明列「`data.json` 契约」为单向门）。同时 ADR 记录「采纳 Node/OpenCLI 作可劣化的取数层工具」这一交付形态决策。3 行即可，可逆（前端 `normalizeData` 兜底，日后要撤就删字段 + ADR 追修订）。

**显式不做**（避免范围蔓延）：不接登录源、不装/不启 Chrome Bridge 扩展与 daemon、不引入 `browser:true` 命令、不一次接 10+ 源、不引入 OpenCLI 的 `autoresearch/`。

---

## 前置：装好 OpenCLI（本机 = 也是 self-hosted runner 那台）

- 本机 Node `v24.14.0`（≥20.18.1 ✓）、npm `11.9.0`。`opencli` 当前**不在 PATH**、本地 checkout 的 `dist/` **未构建**。
- 推荐：`npm install -g @jackwener/opencli`（发布版，稳定）→ `opencli` 进 PATH。
  - 备选（用已克隆的本地 checkout）：`cd /home/dev_st/mtools/OpenCLI && npm install && npm run build`，再以 `node /home/dev_st/mtools/OpenCLI/dist/src/main.js` 调用。
- 冒烟：`opencli hackernews top --limit 3 -f json` 应返回 JSON 数组。

---

## 改动清单（取数层 → 契约 → 前端 → 门禁）

### A. 取数层（Python stdlib + subprocess，不给 Python 侧引第三方依赖）
1. **`backend/core/config.py`** 加访问器 `opencli_cmd()`：按「环境绑定进配置」红线，优先级 `env WB_OPENCLI_CMD > _LOCAL.opencliCmd > shutil.which("opencli") > None`。返回可 spawn 的 argv 列表；为 `None` 时抓取器优雅跳过。机器特定的本地 dist 路径写进 `workbench.local.json`，不进代码默认值。
2. **`backend/core/paths.py`**（L13-15 旁）加 `HACKER_NEWS_JSON = os.path.join(ROOT, "hacker_news.json")`。
3. **`backend/pipeline/fetch_hacker_news.py`**（新建，**镜像 `fetch_daily_news.py` 结构**）：
   - `fetch()`：`cmd = wb_config.opencli_cmd()`；`None` 抛异常（→ main 保留旧文件跳过）。`subprocess.run([*cmd, "hackernews", "top", "--limit", "20", "-f", "json"], capture_output=True, text=True, timeout=60)`。按退出码分支：`0` 解析 `json.loads(stdout)`；`66` 空结果；`69`(bridge 未起)/`77`(需登录)/其它 → 抛异常走跳过。
   - `build()`：把 OpenCLI 行对象映射到本仓统一 item `{title, summary, url, source}`——`title←title`；`url←url`（无则 HN 讨论页 `https://news.ycombinator.com/item?id=<id>`）；`summary←"▲{score} · {author} · 💬{comments}"`；`source="Hacker News"`。产出与 daily_news.json 同构：`date/fetchedAt/source/canonical/count/items/warnings`（`canonical="https://news.ycombinator.com/"`）。
   - `main()`：**失败不覆盖旧 `hacker_news.json`**（照抄 `fetch_daily_news.main`）。
4. **`backend/pipeline/export_data.py`**：
   - 加 `get_hacker_news()`（复制 L440-469 `get_daily_news`，换文件常量与 `hackerNews` 字段、沿用 14 天 history 累积）。
   - `main()` 的 `data = {...}`（L541-566）加 `"hackerNews": get_hacker_news(),`。
5. **`backend/pipeline/local_refresh.py`** `STEPS`（L25-28）在 `export_data` 之前加 `("Hacker News", "fetch_hacker_news")`。
6. **`.github/workflows/sync.yml`**：在 `fetch_daily_news`（L35）后、`sync`（L43）前加一个 `fetch_hacker_news` 步骤，`continue-on-error: true`（照抓取步骤惯例）。runner=本机，Node 已在；opencli 由前置步骤装好即可。

### B. 契约 + 前端（触发 tsc/bump 门禁）
7. **`js/core/net.js`** WBData typedef（L14 旁）加 `hackerNews`（镜像 `dailyNews` 那行的字段集）——**否则 CI `tsc --noEmit` 报错**。
8. **`js/app.js`** `normalizeData()` 加 `hackerNews` 默认 `{}` 兜底（防旧 data.json 白屏）。
9. **`js/views/info.js`**：加 `renderHackerNews(d)` + `renderHNBody(date)`（镜像 L125-176 `renderDailyNews`/`renderDNewsBody`），在 `renderInfo`（L79-84）里调用并把计数并入角标；**复用现成 `.card`/`.nw-grid`/`renderNewsItem`，不新增视觉语言/组件类/布局骨架**。
10. **`index.html`**：镜像 `dnewsBlock` 容器加一个 `hnewsBlock`（+ 可选 `hnewsDot` 角标）。
11. **`workbench.local.json.example`**：加 `opencliCmd` 示例项。

### C. 门禁 / 合规（宪章 + 项目 CLAUDE.md 硬性）
12. **`docs/adr/0007-opencli-ingestion-source.md`**（新建，参照 0006 结构 3 行）：决策=采纳 OpenCLI 作**可劣化的取数层**源、data.json 加 `hackerNews`；理由=大幅扩优质源且 App 仍 node-free 守北极星；代价=取数那台需 Node+opencli，若缺则该源静默跳过；何时重估=若推广到多源需再评估是否上「源注册表」抽象。
13. **设计门禁**：本次纯复用现成类、无新视觉/新组件/新骨架 → 按准则 §6.0 **无需出 HTML 效果图**（明确记录这一判断）。仍跑 `python check_design_tokens.py`。
14. **改了 `js/`+`index.html`** → 跑 `python bump_version.py`（CI `--check` 会红）。
15. **测试**：`test_workbench.py` 加两个用例——`fetch_hacker_news.build()` 的字段映射（喂假 JSON）、`export_data.get_hacker_news()` 的 history 累积；照现有测试风格。
16. **文档防漂移**：`docs/README.md` §4 索引补 ADR 0007；`docs/TECH_CHARTER.md` 维度一后端行补一句「取数层可调用外部 CLI（OpenCLI），但仅限可优雅劣化、不进 App 运行时」。

**关键复用点**（别新造）：`backend/utils/common.py`（原子写/日志）、`fetch_daily_news.py`（抓取器模板）、`export_data.get_daily_news`（history 模板）、`info.js` 的 `renderNewsItem`/`renderDailyNews`（渲染模板）、`config.py` 三级读取模式。

**Python 解释器**：跑脚本用 `/home/dev_st/iriswork/tools/anaconda/bin/python`。

---

## 验证（端到端）

1. **装 + 冒烟**：`opencli hackernews top --limit 3 -f json` 返回 JSON 数组。
2. **抓取**：`python -m backend.pipeline.fetch_hacker_news` → 生成 `hacker_news.json`，items 已映射成 `{title,summary,url,source}`。
3. **聚合**：`python -m backend.pipeline.export_data` → `data.json` 出现 `hackerNews`（含 history）。
4. **优雅劣化（关键）**：临时清掉 `opencliCmd`/改名 dist → `fetch_hacker_news` 打 WARN、保留旧 `hacker_news.json`、**`export_data` 仍成功**、其余源不受影响。
5. **缓存戳**：`python bump_version.py`。
6. **前端**：`python -m backend.server` 开工作台 → 资讯视图出现「Hacker News 热帖」卡片，含 原文↗、收藏★、历史日期切换。（可选：Chrome DevTools MCP 走查该视图——按记忆用 `evaluate_script` 驱动已开标签，不 `new_page`。）
7. **本地 CI 全绿**：`bump_version.py --check` / `check_design_tokens.py` / flake8 / pytest / `tsc --noEmit`，**禁 `|| true` 假绿**。

---

## MVP 之后的决策点（本期不做，供跑通后判断）

跑通并观察一两周质量/稳定性后再决定是否推广。**若决定广接 10+ 源**：把 `fetch_hacker_news` 泛化成「源注册表」——用 `cli-manifest.json` 过滤 `browser==false && access=="read"`，读每条 `columns/args` 自动生成源清单与字段映射，一份 `fetch_opencli.py` 参数化跑多源；届时补/改 ADR 0007。**若决定要登录源**：那是需 Chrome Bridge+daemon+登录态的**交互式/有人值守**独立阶段，另开 plan。**若跑通后觉得不划算**：删 `fetch_hacker_news.py` + `hackerNews` 字段，ADR 0007 追一条「已回退」修订即可（可逆）。

> 本 plan 获批后按用户规范复制一份到项目 `.claude/plan/opencli-mvp-hackernews.md` 长期留存。
