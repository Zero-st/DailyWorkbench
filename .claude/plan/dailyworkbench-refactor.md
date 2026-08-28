# DailyWorkbench 架构分析 & 重构设计方案

## Context（为什么做这件事）

DailyWorkbench 是一个「一套代码、手机+电脑都能用」的个人工作台 PWA，最初定位「零后端、纯静态」，后来陆续长出 **Python 后端（server.py + 一堆抓取/同步脚本）、Supabase 云配置、Obsidian 知识库接入、AI 模型管理、Flutter 移动端、Android TWA 壳、lite 精简副本**。功能演进很快，但结构没跟着长——形成了几处典型技术债：巨石文件、硬编码本机路径、重复代码、三通道并发写同一份数据、前端手写路由 + 双 DOM 体系、缓存版本靠人肉 bump、CI 形同虚设。

**本轮目标（用户已确认）**：① 换机可移植性 ② 降复杂度/可维护 ③ 工程化兜底 ④ 多端收敛（作为方向记录，**本轮不动交付形态**，lite/Flutter/TWA 暂不合并）。所以执行排序为 **P0 可移植 → P1 降复杂度+工程兜底**，多端收敛列为 P2 未来方向。

---

## 一、架构全景（组件与原理）

### 1. 交付形态（一份逻辑，四种壳）
| 形态 | 位置 | 说明 |
|---|---|---|
| 主 PWA | 根目录 `index.html`/`app.js`/`styles.css`/`sw.js` | 真正在维护的主体，GitHub Pages 部署 |
| lite 副本 | `lite/` | 独立分叉的一套 index/app/sw，与根 `app.js` 差异 **2071 行**（严重分叉） |
| Flutter 端 | `mobile/lib/pages/*.dart` + `services/*.dart` | 原生移动 App，另一套实现 |
| Android TWA 壳 | `app/` + `build.gradle` + `twa-manifest.json` | 把 Web 应用包成 APK |

### 2. 前端（原生 PWA，无框架/无构建）
- **单页骨架** `index.html`：侧边栏 12 个视图按钮 `onclick="switchView('X')"`；视图容器是**两套 DOM 体系并存**——`home/dash` 用 `<section class="view" id="view-*">`，其余 10 个用 `<section class="tabpane" id="pane-*">`（历史遗留）。
- **主逻辑** `app.js`（2157 行 / 116KB，单个 IIFE）：约 **89 个 `renderX()` 函数**，全字符串 `innerHTML` 拼接。路由是纯 JS 状态机：`switchView(v)`（`app.js:1548`）设全局 `__view` → 切 `.active` class → `renderActiveTab(__view)`（`app.js:1446`）按字符串 if/else 分派。**无 URL/hash/history**。
- **辅助 IIFE**（共享 `window.WB` 命名空间，全局作用域顺序加载）：`schedule.js`(课程表) → `model-manager.js`(模型) → `marked.min.js` → `kb.js`(知识库) → `app.js`。
- **PWA**：`sw.js`（`CACHE="workbench-v105"`，data.json 网络优先、/api 不缓存）+ `manifest.json`。

### 3. 后端（Python 标准库，零第三方依赖）
- **`server.py`（555 行，职责最杂）**：一个 `Handler(SimpleHTTPRequestHandler)` 同时干 4 件事——静态文件服务 + `POST /api/refresh`(触发重建) + `POST /api/chat`(LLM 代理绕 CORS) + `GET/POST /api/models`(Supabase 中转) + `GET|POST /api/kb/*`(Obsidian 扫描/读/搜/写)。`do_GET/do_POST` 是一长串手写 `if path==` 路由。
- **数据聚合** `export_data.py`（582 行）：13 个 `get_*` 从本机 WorkBuddy 抓 skills / 自动化 / 会话（`sqlite3` 读 `workbuddy.db`）/ 模型 / 记忆 / 磁盘（`ctypes` Win32）/ MCP，聚合成 `data.json`；`quickActions`/`guide` **文案硬编码在 main() 里**。
- **抓取/同步脚本**：`fetch_ai_daily.py`、`fetch_daily_news.py`、`local_refresh.py`(路线A本地编排)、`sync.py`(GitHub Contents API 推 data.json)、`daily_ai.py`(每日日报)、`sync_status.py`、`push_schedule.py`。

### 4. 数据流与存储（三处混合，无自建库）
```
本机 WorkBuddy(db/md/json) ──export_data.py──▶ data.json(240KB 聚合快照)
外部 AI/新闻 API ──fetch_*──▶ ai_daily.json/daily_news.json ──并入──▶ data.json
                                                    │
前端 fetchT("data.json?t=") 轮询 ◀────────────────┘
Supabase(model_configs jsonb) ◀── server.py service_role 中转 ── /api/models
localStorage(待办/速记/收藏/复盘/主题/AI key/课程表) ── 纯前端，不上传
```
- **配置优先级**（`server.py:26-56`）：环境变量 > `*.local.json`（`supabase.local.json`/`kb.local.json`/`schedule.local.json`，均 gitignore）。这一层设计是好的。
- **触发**：Windows 计划任务 / GitHub Actions self-hosted runner 定时调 `local_refresh.py`(每小时) / `daily_ai.py`(每天08:30) / `sync.py`(每小时)。

---

## 二、关键问题清单（对照设计原则：建议 + 代价 + 出处）

> 按 ROI 排序。每条标注命中的设计原则与「过度重构的代价边界」。

### P0 · 换机可移植性（最高 ROI，解锁一切）
1. **硬编码本机 Windows 绝对路径 —— 换机即废**
   - 现状：`export_data.py:25 WS=r"E:\AITools\..."`；`:158 r"C:\Users\lenovo\ollama.exe"`（还夹了另一用户名）；`sync.py:28 DIAG=r"D:\AIWork\..."`；`export_data.py:292` 盘符写死 `("C:\\","D:\\")` + `ctypes.windll` 仅 Windows；三个 workflow 写死 `C:\Users\13115\...python.exe`（runner 用户名 13115 与代码里 lenovo 又不一致）。
   - **建议**：抽一个**配置层**（依赖倒置/防腐层）——所有本机路径、盘符、解释器走「环境变量 > `workbench.local.json` > 平台默认」三级读取，复用现有 `*.local.json` 机制扩展即可，不引新依赖；磁盘/Ollama 探测按平台分支并优雅降级（非 Windows 不抛异常）。
   - **代价/边界**：只抽真正易变的「环境绑定点」，别把纯逻辑也套接口——那是过度设计。**出处**：整洁架构·依赖倒置；DDD·防腐层（design-principles 卡3）。

### P1 · 降复杂度 + 工程化兜底
2. **巨石文件 —— 上帝类/上帝脚本**
   - 现状：`app.js`(2157行)、`server.py`(555行 职责混杂)、`export_data.py`(582行)。
   - **建议**：按「变化的原因」拆（SRP）。
     - `server.py` → `router` + `handlers/{chat, models, kb, refresh}` + `clients/{supabase, kb_vault}`，`do_GET/do_POST` 改成路由表分派而非 if 链。
     - `app.js` → 按视图域拆模块（views/、以及已有的 kb/schedule/model 模式继续下沉），render 层与数据/路由层分离。
     - `export_data.py` → 抓取（get_*）与展示文案（quickActions/guide）解耦，文案抽成数据/配置。
   - **代价/边界**：**别拆过头**——个人工具无需 DDD 分层或微服务；以「一句话能说清这个文件/模块干嘛」为度即可。**出处**：整洁架构·SRP；重构·提炼类（卡9）。
3. **重复代码已过三次法则 —— 该抽了**
   - 现状：GitHub Contents API 推送（`sync.py:86 push_file` vs `push_schedule.py:37`）；HTTP 抓取+SSL 降级（`fetch_ai_daily.py:40` vs `fetch_daily_news.py:28`）；frontmatter 解析（`export_data.py:36 fm()` vs `server.py:175 _kb_parse_fm`）；`write_log`+编码兜底（`sync.py` vs `daily_ai.py`）。
   - **建议**：抽 `wb_common.py`（或 `lib/`）：`github_push()`、`http_get()`、`parse_frontmatter()`、`write_log()`。这些是**稳定的「知识」重复**，不是「长得像」，抽得值。
   - **代价/边界**：只抽已出现 ≥2~3 次且共性稳定的；一次性代码别硬抽。**出处**：DRY 真义 / 三次法则（卡11）。
4. **三通道并发写同一 data.json —— 缺单写入口/幂等**
   - 现状：`server.py`(refresh)、`sync.py`(每小时)、`daily_ai.py`(每天) 都重建/推 `data.json`；注释坦承曾有「git vs API 双通道冲突」。
   - **建议**：收敛成**单一重建入口**（一个 `rebuild_data()` 供三处复用）+ 写时加锁/原子替换（写临时文件再 rename）+ 幂等（同输入同输出，避免半写）。
   - **代价/边界**：个人工具并发低，做到「原子替换 + 单函数」即可，无需引 MQ/DB。**出处**：DDIA·幂等与派生数据（卡10）。
5. **前端缓存版本靠人肉 bump —— 工程化兜底**
   - 现状：README 反复强调改前端要手动同步三处版本号（`index.html ?v=N`、`sw.js CACHE`、`FILES` 列表），漏改即白屏。
   - **建议**：用一个小脚本/pre-commit 钩子按文件内容 hash 自动生成版本号并同步三处；或 SW 改成 hash 化缓存名。
   - **代价/边界**：脚本要维护，但换来「再也不白屏」，划算。**出处**：务实的程序员·自动化（卡4 的反面：该自动化的别靠纪律）。
6. **CI 形同虚设**
   - 现状：`ci.yml` 无依赖、无测试、lint `|| true` 永远绿；真正定时任务全在 self-hosted runner，公共 CI 覆盖不到。
   - **建议**：要么给核心纯函数（frontmatter 解析、data.json normalize、版本 bump）补几条 pytest 让 CI 真正把关；要么诚实删掉假 CI。**别留「看起来在测其实没测」的绿灯**。

### P2 · 多端收敛（方向记录，本轮不执行）
7. **lite 与根 app.js 分叉 2071 行、Flutter 又一套实现** —— data.json 是事实上的前后端**契约**。未来方向：把 data.json schema 显式化为契约文档/校验，lite 与 Flutter 都消费同一契约，减少分叉。**出处**：微服务设计·契约与版本；DDIA·schema 演进（卡12）。**本轮不动交付形态，仅记录。**

### 安全提醒（顺带）
- `server.py` 只监听 `127.0.0.1`（好），但 API 全发 `Access-Control-Allow-Origin: *`，且 `/api/chat` 会转发请求体里任意 `targetUrl`+`key`——本地无碍，**若误暴露端口即开放代理**。建议 chat 代理加目标白名单。KB 读写已有 realpath 越界校验（`server.py:163`），保持。

---

## 三、推荐执行顺序（分阶段，可逐段独立交付）

- **阶段 0（P0，先做）**：抽配置层，清除所有硬编码路径/盘符/解释器 → 换机能跑。这一步不改任何业务逻辑，风险最低、收益最大。
- **阶段 1（P1-a 后端）**：抽 `wb_common.py` 消重 → 拆 `server.py` 路由与 handler → data.json 单写入口 + 原子替换。
- **阶段 2（P1-b 前端）**：统一 `view`/`tabpane` 双 DOM 为一套；`app.js` 按视图域下沉拆分；清理 `switchView` 里对已删 `.tab` 的死代码兼容路径（`app.js:1573,1582`）。
- **阶段 3（P1-c 工程化）**：缓存版本自动 bump 脚本 + 补最小 pytest 让 CI 真跑。
- **阶段 4（P2，择期）**：data.json 契约显式化，评估 lite/Flutter 收敛。

> 每个阶段都能单独上线验证，不必一次性大爆炸重构（可逆、双向门优先）。

---

## 四、配置文件 schema（参数外置清单）

统一成一份 `workbench.local.json`（gitignore，复用现有 `*.local.json` 机制），读取优先级 **环境变量 > 配置文件 > 平台默认**：

```json
{
  "paths": {
    "workspace":  "E:/AITools/workbuddy/workspace",   // export_data.py:25
    "ollama_exe": "auto",                              // auto=shutil.which，找不到再读这里；替 export_data.py:158
    "diag_log":   "D:/AIWork/sync_diag.log",           // sync.py:28
    "python_exe": "..."                                // 三个 workflow 里写死的解释器挪进来
  },
  "disks": ["C:", "D:"],                               // 现写死在 export_data.py:292
  "supabase": { "url": "", "service_key": "" },        // 已有，纳入统一文件
  "kb": { "vault": "", "deposit": "" },                // 已有
  "chat_proxy": { "allow_hosts": ["open.bigmodel.cn"] }// 顺带补 P0 安全白名单
}
```

**外置边界（关键，别把配置写成第二套代码）**：只外置「换台机器/换个人用会变」的参数——路径、盘符、密钥、主机白名单。**逻辑常量留在代码里**（如「AI 日报保留 14 天」这类业务规则，进配置反而更难懂、增加隐性耦合）。判据一句话：**环境绑定 → 进配置；逻辑本身 → 留代码。**

---

## 五、高内聚低耦合的模块边界

**高内聚 = 按「变化的原因」归拢**（一起改的放一起）；**低耦合 = 模块间只通过契约交互，不互相伸手**。

| 现状（低内聚/高耦合） | 目标拆分 | 内聚原因 / 解耦手段 |
|---|---|---|
| `server.py` 一个 Handler 混 4 件事 | `router` + `handlers/{chat,models,kb,refresh}` + `clients/{supabase,kb_vault}` | 每个 handler 只因一个原因改；`do_GET/POST` 改**路由表**分派，替换 if 链 |
| 跨文件重复的 push/http/frontmatter/log | 下沉 `wb_common.py` | 依赖倒置：handler 依赖抽象工具，不依赖彼此 |
| `app.js` 89 个 render 混一个 IIFE | 继续按视图域下沉（kb/schedule/model 已下沉，续拆 news/stats/session…） | render 层只吃 `data.json` 契约，不读 DOM 判路由（`856df28` bug 根因即耦合到已删按钮） |
| `export_data.py` 抓取与文案耦合 | `get_*`（抓取）与 `quickActions/guide`（文案）分离 | 文案抽成数据；抓取逻辑高内聚 |

---

## 六、技术选型：资深视角的取舍（我会怎么选）

**核心判断：个人单人维护的工具，最大的失败模式不是「功能不够」，而是「三年后工具链腐烂跑不起来」。所以这个项目最宝贵的资产是它「零构建、零依赖、离线可跑」的克制——这是特性，不是债。我的选型全部围绕「保住这份克制、同时拿回模块化」。**

1. **前端语言：保留原生 JS，但升级到原生 ES Modules（`<script type="module">` + import/export），不上 React/Vue、不引构建。**
   - *为什么*：2157 行 IIFE 的痛是「没有模块」，不是「没有框架」。ES Modules 是浏览器原生能力，直接拿到高内聚低耦合，**零 webpack/vite、零 node_modules 腐烂风险**。上 React 会引入构建链、依赖升级、SSR/hydration 心智——对单人个人工具是纯负债。
   - *代价*：ES Modules 需要经 http 加载（`file://` 双击打开受限），但项目本来就有 `server.py`/`http.server`，无影响。

2. **后端语言：保留 Python，暂留 `http.server` 标准库 + 路由表，不急上 FastAPI/Flask。**
   - *为什么*：零依赖是本项目的部署优势（`git clone` 就能跑，无 `pip install`）。当前后端痛在「手写 if 路由 + 职责混杂」，用**路由表 + handler 拆分**就能治，不必引框架。
   - *什么时候该上 FastAPI*：当 API 端点持续增长、开始需要请求校验/OpenAPI/异步——那时一个依赖换来的清晰度才划算。**这是双向门，可逆，随时切，别现在纠结。**

3. **数据层：保留 JSON 文件当库，不上 SQLite/Postgres。**
   - *为什么*：240KB、个人、单写、读多写少——文件完全够。上 DB 立刻兑现 schema 迁移、连接管理、备份成本，收益却是想象的（YAGNI）。Supabase 已负责需要云端共享的模型配置，边界清晰，保持。

4. **多端交付（P2 方向，本轮不动）：如果让我拍板长期形态——砍掉 `lite/`（它只是一份过期分叉，靠 ES Modules 化后主 PWA 自然能按需精简），并在 PWA-only 与 Flutter 之间二选一，不要两套全量实现长期并行漂移。** 一个人维护两套 UI 是最贵的耦合。

> 一句话总结我的立场：**用平台原生能力（ES Modules、stdlib 路由、config 外置）拿回工程质量，而不是用框架和中间件——因为对单人工具，每引入一个需要升级维护的东西，都是未来某天跑不起来的定时炸弹。**

---

## 七、验证方式（端到端）

- **阶段0**：在**非原机器/或改一份假的 `workbench.local.json`** 上跑 `python export_data.py`，确认生成 data.json 不再依赖 `E:\`/`C:\Users\lenovo`；非 Windows 下磁盘探测优雅降级不抛异常。用户环境 Python 用 `/home/dev_st/iriswork/tools/anaconda/bin/python`。
- **阶段1**：`python server.py 8080` 起服务，逐一 curl `/api/models`、`/api/kb/tree`、`/api/refresh`、`/api/chat`，对比重构前后响应一致；连续触发多次 refresh 确认 data.json 不出现半写/损坏。
- **阶段2**：`python -m http.server` 打开面板，逐个点侧边栏 12 个视图确认无空白（回归 `856df28` 修的资讯页 bug）、无重复渲染（回归 `a34f68b` 的双渲染）；DevTools 看 Console 无报错。
- **阶段3**：改任一前端文件后跑 bump 脚本，确认三处版本号自动一致；`git` CI 触发确认 pytest 真的跑并能因失败变红。
- 全程小步提交，每阶段独立 PR，便于回退。

---

## 八、给用户的取舍备注
- 这是**个人工具**，全程遵守 **YAGNI/KISS**：不引入框架、不上 DB/MQ、不做 DDD 分层——只解决「换机能跑 + 文件别太胖 + 别重复 + 别白屏」四件真痛点。
- 任何一步都可单独停下，不存在「不做完就更糟」的单向门（除 data.json schema 变更外）。
- 本方案仅为设计建议；是否执行、执行到哪个阶段，由你拍板。
