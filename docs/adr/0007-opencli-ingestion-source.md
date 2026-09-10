# 0007 · 采纳 OpenCLI 作「取数层」优质信息源（而非只手写 Python 抓取器）

- 状态：**已接受（MVP 试点）**
- 日期：2026-09-07
- 关联：[0001 零构建北极星](0001-zero-build-north-star.md)、[0006 捕获层自研浏览器扩展](0006-self-built-browser-extension-for-capture.md)、[TECH_CHARTER](../TECH_CHARTER.md)（单向门清单含「`data.json` 契约 · 交付形态」）

## 背景

资讯管道当前只对接 2 个公开 REST API（AI HOT、每日60秒）。想「更好地获取优质信息」，需要扩源（Hacker News / arXiv / GitHub Trending / 学术…）。本机已克隆 `../../../OpenCLI`（`@jackwener/opencli`）——把 100+ 网站封装成确定性 CLI，其中约 324 条 `browser:false` 命令纯 HTTP、免登录/免 key，可被 subprocess 直接调用拿 JSON。两条路：

- **A · 每个源手写 Python `fetch_*.py`**（用现有 `http_get_json`）：零新运行时、最贴北极星，但每源都要自己解析 HTML/分页、且站点改版由自己维护。
- **B · 经 OpenCLI 取数**（`opencli <site> <cmd> -f json`）：一处调用拿多源、schema 统一、站点改版由 OpenCLI（autofix 机制）承担；代价是取数那台需 Node>=20。

## 决策

**先做 MVP：用 B 接入 1 个公开源（`opencli hackernews top`）跑通端到端**，`data.json` 新增顶层字段 `hackerNews`（镜像 `dailyNews`）。**OpenCLI 只落在「取数层」——和 `fetch_*.py` 同层的数据生产者，绝不进 App 运行时**；App 本体（前端 + `server.py`）保持 node-free、离线可跑不变。调用命令经 `wb_config.opencli_cmd()` 取（env > local.json > PATH），**未配置/node 缺失即该源静默跳过、保留旧数据**。

## 理由

- **大幅扩优质源，而 App 仍守北极星**：Node 只在抓数据时被调用（像 CI 里的 `tsc` 那样的取数期外部工具），`git clone` + 双击 `index.html` / `python -m backend.server` 的离线可跑形态不变。
- **优雅劣化 = 不给核心链路上硬依赖**：缺 OpenCLI 时 `fetch_hacker_news` 保留旧 `hacker_news.json`、`export_data` 照常成功、其余源不受影响。取数层「必须联网」本就是既有资讯抓取的性质，不是 App 的性质。
- **先 MVP 再扩**：单源验证质量/稳定性后再决定是否泛化成「源注册表」广接多源，避免一次性过度投入（YAGNI）。

## 代价（明确承担）

- **取数那台（本机 = self-hosted runner）需装 Node>=20 + OpenCLI**；这是宪章列为「最大失败模式」的工具链腐烂风险的一次让步——**用优雅劣化把它关在取数层内**：坏了顶多少一个源，不会让工作台打不开。
- **触及 `data.json` 契约（加 `hackerNews`）= 单向门**：故有此 ADR，并同步 `js/core/net.js` 的 `WBData` typedef + `app.js` 的 `normalizeData` 兜底。
- 放弃了「纯 Python stdlib 零运行时」的洁癖；若只想要 1–3 个源，手写 `fetch_*.py`（路 A）其实更省。本决策押注在**后续要广接、且想把站点维护外包给 OpenCLI**。

## 何时重估

- **推广到 10+ 源**：把 `fetch_hacker_news` 泛化成参数化的「源注册表」（读 `cli-manifest.json` 过滤 `browser==false && access=="read"` 自动生成源清单/字段映射），届时改本 ADR。
- **要登录墙内源**（Twitter/知乎/小红书）：需 Chrome Bridge + daemon + 登录态，是有人值守/交互式的独立形态，另写 ADR。
- **跑通后觉得不划算**：删 `fetch_hacker_news.py` + `hackerNews` 字段，本 ADR 追一条「已回退」修订即可（前端 `normalizeData` 兜底，可逆）。

## 修订记录

- **2026-09-07 · 扩第二源 GitHub Trending**：新增 `fetch_github_trending.py`（`opencli github-trending repos --since daily`），`data.json` 加顶层字段 `githubTrending`，完全镜像 `hackerNews` 那套（同「取数层 + 优雅劣化」范式）。这是本 ADR 决策的**直接延续**，非新决策——契约变更（加 `githubTrending`）在此留证。**仍 <10 源，未抽「源注册表」**（按上「何时重估」，到 10+ 源才泛化）。复盘见 [`../planning/复盘-OpenCLI取数层接入.md`](../planning/复盘-OpenCLI取数层接入.md)。
- **2026-09-10 · 扩两源 Product Hunt + 少数派（走「路 A」而非 OpenCLI）**：新增 `fetch_producthunt.py`（PH 官方 Atom feed）、`fetch_sspai.py`（少数派 RSS 2.0），`data.json` 加顶层字段 `productHunt` / `sspai`，聚合/前端/兜底完全镜像 `githubTrending` 那套。**与前两次的差别**：这两源是**纯 Python stdlib 直连 RSS/Atom（`urllib` + `xml.etree`）**，即本 ADR「背景」里的**路 A**，**不经 OpenCLI、不上 Node**——解析用共用的 `wb_common.parse_feed`（命名空间无关，RSS/Atom 通吃），抓取失败保留旧数据。为何选路 A：RSS/Atom 是稳定结构化契约、免维护 HTML 解析，PH/少数派都原生提供，无需把它们塞进 OpenCLI 取数层。本条仅为**契约变更（加 `productHunt`/`sspai`）留证**——决策仍在本 ADR「扩优质资讯源」主题内。**仍 <10 源**（现 6 源），未抽「源注册表」。缘起：把「练产品感」落到工作台，让好产品每天流到眼前，见 [`../../.claude/plan/product-sense-practice.md`](../../.claude/plan/product-sense-practice.md)。
