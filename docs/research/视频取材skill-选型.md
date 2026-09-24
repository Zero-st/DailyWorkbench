# 选型评估 · 视频取材 skill 二选一（chubbyskills vs video-downloader）

> 日期：2026-09-24　性质：选型/候选对比（**仅评估存档，两者均未安装、未在本机真跑**）
> 上位：`docs/research/蒸馏方法论-开源参考地图.md` §6（skill 生态盘点，本文是其中取材候选的展开）
> 关联：`docs/research/cangjie-skill-深层分析与接入选型.md`（下游蒸馏端，已装）、`docs/research/工具链-MCP与Skill地图.md` §2.6（断链记录）、`docs/TECH_CHARTER.md`（离线优先 / 依赖极简且可撤回）、`docs/adr/0014-vendor-agent-skills-into-repo.md`（vendor 先例与代价）
> 一句话：**推荐 chubbyskills**——许可证干净、零 key 离线可跑、体量约 1/10、字幕优先不下整片；`video-downloader` 功能更全（唯一覆盖小红书与视频号）但**仓里没有任何许可证文件**，不具备被 vendor 进公开仓的条件。

---

## 0 · 结论先行

| 候选 | 判断 | 一句话理由 |
|---|---|---|
| `chubbyguan/chubbyskills@bilibili-transcribe` | **推荐，待拍板** | MIT + LICENSE 在位；零 API key、本地 CPU 转录，合「离线优先」；vendor 只需 ≈57K；字幕优先，多数视频秒级出稿不碰模型 |
| `kangarooking/kangarooking-skills@video-downloader` | **不采纳** | 仓内无 LICENSE、API `license` 字段为 `null`；云 ASR 需 key 且出网，与「离线优先」正面冲突；先下整段 1080p 视频才取字幕，重 |
| 小红书 / 视频号取材 | **仍无解** | 唯一覆盖者是 `video-downloader`，被许可证卡住；本文不提供替代方案 |

**这份对比只做判断，不做安装。** 是否装、何时装由用户拍板。

---

## 1 · 为什么现在要选

取材是本机蒸馏链路上唯一还断着的一环，且已经断了 20 天：

- 2026-09-04 全盘核实，`creator-video-decoder` 与 `video-cangjie-distill` 在本机**零命中**（`工具链-MCP与Skill地图.md:109`）。
- 断链后做过一次收口：`js/core/platforms.js:4` 把 B 站条目的 `skill` 字段拆绑留空，`js/core/distill-template.js:65-71` 的视频分支改成「先用你可用的工具拿到字幕/文字稿」，**不再点名任何 skill**。这是把坑填平，不是把路修通——「你可用的工具」目前是空集。
- 2026-09-24 装了 `cangjie-skill`，但它**输入必须是纯文本**（`SKILL.md:49`：「不要在没有文本的情况下『凭记忆』蒸馏 — 宁可停下来问用户要」），取材能力为零。下游修好了，上游仍缺。

所以要选的不是「蒸馏工具」，而是**把视频变成文字稿的那一段**。

---

## 2 · 逐维对照

所有数据来自 GitHub API 与 `curl` 拉取的 raw 原文，核对日期 2026-09-24。

| 维度 | chubbyskills@bilibili-transcribe | video-downloader | 出处 |
|---|---|---|---|
| **许可证** | **MIT**，`LICENSE` 文件存在（HTTP 200） | **无**：仓根 `LICENSE` HTTP 404，API `license: null` | `api.github.com/repos/<owner>/<repo>` 的 `license` 字段 |
| star / fork | 835 / 115 | 639 / 107 | 同上 |
| 最近 push | 2026-09-17 | 2026-09-07 | 同上 |
| open issues | 1 | —（同仓多 skill 混计） | 同上 |
| 仓库形态 | 多 skill 单仓，各 skill 一个顶层目录 + 共享 `chubby_common/` | 多 skill 单仓，`video-downloader/` 是其中一个目录 | 仓库 tree API |
| **取材策略** | **字幕优先**：yt-dlp 抓官方/自动字幕，秒级、免 GPU；抓不到才下**音频**（mp3 128K）转录 | **先下整段视频**：B站/YouTube/小红书默认 exact 1080p，不可用则取更高（「this is not a resolution ceiling」），再取字幕 | `bilibili-transcribe/SKILL.md:13,41`；`video-downloader/SKILL.md:41` |
| **ASR 后端** | SenseVoice-Small，`device="cpu"`，**本地跑** | 平台字幕 → SiliconFlow 云（`SILICONFLOW_API_KEY`）→ 本地 whisper（**须显式授权**，`--allow-local-asr-fallback`）；无字幕无 key 时非交互返回 `pending` + exit 3，不静默选 | `chubby_common/funasr.py:24-30`；`video-downloader/SKILL.md:329-333` |
| **API key** | **零** | 云 ASR 需 `SILICONFLOW_API_KEY`；视觉理解需 `ARK_API_KEY`（豆包）；视频号首次授权需 Playwright 交互 | `video-downloader/SKILL.md:34-37` |
| **出网** | 仅 yt-dlp 抓取本身 + 首次下模型（893MB） | 抓取 + 云 ASR 上传音频 + 云视觉上传视频/关键帧 | `bilibili-transcribe/SKILL.md:95`；`video-downloader/SKILL.md:143,454` |
| **依赖加载** | funasr/torch **函数内懒加载**，只装 yt-dlp 也能跑字幕路径；`deps.py` 缺依赖给可执行的安装提示、不裸 traceback | ffmpeg + ffprobe + yt-dlp **必需**，Python 3.10+ | `chubby_common/funasr.py:2-3,20-22`、`deps.py:11-30`；`video-downloader/SKILL.md:27-30` |
| **平台覆盖** | B站 / 抖音 / TikTok / 微博 / 播客 / 公众号 / X —— 同仓一整套独立 skill。**无小红书、无视频号** | 抖音 / B站 / YouTube / **小红书** / **视频号（实验）** / 本地文件 | 两仓 tree：`chubbyskills` 各 `*-transcribe/`；`video-downloader/scripts/providers/` |
| **产物** | 带 frontmatter 的 Markdown | `multimodal_transcript.md`（带时间戳）+ `platform_subtitles.json`（标人工/自动来源） | `bilibili-transcribe/SKILL.md:66`；`video-downloader/SKILL.md:20` |
| **作者自陈限制** | 合集只下第一个分 P；不支持说话人分离；4K/1080P60 需大会员；模型首次下载 893MB | SiliconFlow 只保证文本、**不保证词级时间戳**，标 `timestamp_precision: chunk`（60 秒窗不等于句级对齐） | `bilibili-transcribe/SKILL.md:92-96`；`video-downloader/SKILL.md:360` |
| **vendor 体量** | `bilibili-transcribe/` + `chubby_common/` + `platforms/` + `LICENSE` ≈ **57K**（实测各 blob size 求和） | 30 个 py 文件（`providers/` 6 + `vision/` 9 + 顶层），SKILL.md 456 行 | 仓库 tree API 的 `size` 字段 |
| **批量** | 有：`batch_transcribe.py urls.txt`，默认单条失败继续，`--stop-on-error` 转严格 | 未提供批量入口 | `bilibili-transcribe/SKILL.md:38,72` |

### 一个必须知道的结构事实

`bilibili-transcribe/scripts/transcribe.py:19-21` 会向上查找 `chubby_common/`：

```python
SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = SKILL_ROOT if os.path.isdir(os.path.join(SKILL_ROOT, "chubby_common")) else os.path.dirname(SKILL_ROOT)
```

**只装 `bilibili-transcribe/` 这一个目录会缺包直接崩。** 必须连 `chubby_common/` 一起带——这也是为什么 §4 的最小清单不是一个目录。

### video-downloader 的定位（它自己说的）

它的 `SKILL.md:22` 明写自己是 cangjie 的上游：「Its final handoff is `multimodal_transcript.md`, a normal text file. Cangjie Skill stays unchanged and only consumes text to produce Skills.」——设计上和本机已装的 `cangjie-skill` 是**同作者配套的两件套**。这是它唯一的结构性优势：接口天生对齐。但对齐不敌许可证缺失。

---

## 3 · 与本仓宪章的相容性

### 3.1 离线优先（`TECH_CHARTER.md:12`）

宪章原文是「零构建 · 依赖极简且可撤回 · 本地起服务即可跑（离线优先）」。

- **chubbyskills 合**：字幕路径只需 yt-dlp 出网抓一次；转录路径 `device="cpu"` 本地跑，模型下载一次后永久离线可用。全程不需要任何账号或 key。
- **video-downloader 不合**：默认 ASR 路径要把音频上传到 SiliconFlow，视觉理解要把视频/关键帧上传到火山。它做了很好的告知设计（无 key 时停下问用户、不静默降级、key 不写日志），但**「默认要出网 + 要两个第三方 key」本身就与离线优先冲突**。真要纯本地就得 `--asr whisper` + `--vision none`，那等于关掉它一半能力，此时它相对 chubbyskills 已无优势，只剩「先下整段视频」的额外代价。

### 3.2 许可证 —— 这条是硬门槛，不是偏好

DailyWorkbench 的 `origin` 是**公开仓** `github.com/Zero-st/DailyWorkbench`（ADR 0014 推送前已核实并记录）。ADR 0014 确立的做法是把第三方 skill 连同其 LICENSE 一起入库，本月装 `cangjie-skill` 时也照此办理（MIT，`LICENSE` 原样保留）。

`kangarooking/kangarooking-skills` **仓根没有 LICENSE 文件，GitHub API 的 `license` 字段是 `null`**。没有声明许可证的代码按默认版权处理——作者保留一切权利，未授予再分发许可。把它复制进一个公开仓并推送，是在没有授权的情况下再分发他人代码，且按 ADR 0014 记录的性质，**推上去就收不回来**（对象永久留在 packfile，镜像与归档会抓走）。

所以这不是「风格上不推荐」，而是**不具备条件**。若确实需要它的小红书/视频号能力，正确做法是：不 vendor，只在本机用户级 `~/.claude/skills/` 装一份自用，或先向作者询问许可。

### 3.3 依赖极简且可撤回

两者都是「删目录即回滚」的双向门，不触碰单向门清单（不引构建步骤、不改 `data.json` 契约）。体量上 chubbyskills 的 57K 远低于 ADR 0014「何时重估」条款关心的量级（该条款针对的是 `baoyu-url-to-markdown` 那种 37M 级资产）；`cangjie-skill` 是 756K，chubbyskills 再加 57K 不构成新的体积问题。

---

## 4 · 若要装 chubbyskills：最小清单

**不要整仓 clone 入库**——该仓有 10 个 skill，其中 `knowledge-base-management` 与本机已有的 `llm-wiki` skill、`mcp__dailyworkbench__kb_*` 工具职责重叠，装进来是制造第二个真源。

最小可跑集合（≈57K）：

| 路径 | 为什么要 |
|---|---|
| `bilibili-transcribe/` | 本体（`SKILL.md` + `scripts/transcribe.py` + `scripts/batch_transcribe.py` + `requirements.txt`） |
| `chubby_common/` | 8 个模块，`transcribe.py:19-21` 硬依赖，缺了直接崩 |
| `platforms/bilibili.yaml` | `transcribe.py` 用 `PlatformConfig` 读平台参数（referer / UA / 语言） |
| `LICENSE` | MIT 要求保留，且是 ADR 0014 确立的做法 |

其余 9 个 skill、`templates/`、`tests/`、`setup.sh` 不入库。装完照纪律跑一次真机验证（见 §5）。

---

## 5 · 未验证项（诚实标注）

以下全部**未做**，不要把本文当作「已验证可用」的结论：

1. **两者都没在本机真跑过。** 所有判断来自 raw 原文与 API 元数据。
2. **893MB 的 SenseVoice-Small 模型未下载**，本地 CPU 转录的真实耗时未验（作者自陈 10 分钟视频约 20 秒，未复现）。
3. **B 站反爬现状未验。** `SKILL.md` 里的 UA + Referer 写法是 2026 年中的方案，平台策略会变。
4. **字幕命中率未验。** 「字幕优先」的价值完全取决于目标 up 主开没开字幕；没开就每次都走 893MB 模型那条路，轻量优势消失。
5. **`transcribe.py` 用 `tempfile`**（第 17 行 import），产物会落系统临时目录，与本机「临时文件统一放 `/home/dev_st/桌面/comtools/tmp/`、禁用 `/tmp`」的约定冲突。真装的话需要用 `TMPDIR` 环境变量规避，这一步也未验。
6. **`chubby_common/llm.py` 未逐行审。** 本次核了 `funasr.py`（确认懒加载）与 `deps.py`（确认友好报错），`llm.py` 只看了文件存在——装前应按纪律补核，确认它不会静默出网或要 key。

---

## 6 · 采纳表

| 事项 | 结论 | 备注 |
|---|---|---|
| 装 `chubbyskills@bilibili-transcribe`（含 `chubby_common/`） | **待拍板** | 推荐项。装前补核 `llm.py`，装后按 §5 做一次真机验证 |
| 装 `video-downloader` 进本仓 | **不采纳** | 许可证缺失，公开仓不具备再分发条件 |
| 用 `video-downloader` 的小红书/视频号能力 | **不采纳（本仓口径）** | 如自用，走用户级 `~/.claude/skills/`，不入本仓；或先问作者要许可 |
| 小红书 / 视频号取材缺口 | **仍无解** | 本文不提供替代方案，缺口继续挂账 |
| 抄 `video-downloader` 的告知式降级设计 | **可借（待做）** | 「无 key 时停下问用户、非交互返回 exit 3、绝不静默选后端」这套写法值得抄进本仓将来的取材胶水层 |

---

## 7 · 变更记录

- 2026-09-24：首版。两个候选均 curl raw 原文核对；结论推荐 chubbyskills，未安装。
