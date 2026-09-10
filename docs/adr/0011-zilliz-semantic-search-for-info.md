# 0011 引入 Zilliz Cloud 托管向量库做资讯语义检索（扩 data.json 契约）

- 背景：资讯模块随信息源增多（AI 日报 / 每日新闻 / Hacker News / GitHub Trending / Product Hunt / 少数派）数据变多，但每条只有 `{title, summary, url, source}`——无标签、无分类，且 `summary` 质量参差（HN 只是"▲分数·作者·评论数"元信息、每日新闻 summary 恒空），用户必须逐条点原文才知道讲什么；也没有任何搜索/过滤，知识库搜索又是纯子串匹配、无语义。第一性拆解：诉求正交为「信息压缩」（摘要+标签）与「匹配」（词面 + 语义），语义匹配需把文本 embedding 成向量、做最近邻搜索。

- 决策：新增**理解层 `enrich`**（`backend/pipeline/enrich.py`，位于全部 fetch_* 之后、export_data 之前）：对每条**新条目**（按 `id=sha1(url|title+source)` 去重、命中缓存即跳过）调 chat 生成「一句话摘要 + 标签」、调 embedding 生成向量 upsert 进 **Zilliz Cloud（serverless Milvus）**，并回写 `aiSummary`/`aiTags` 到各源 `*.json` 供 export 透传。检索分两条：词面（关键词/标签/来源）纯客户端 over `data.json`、离线即时；语义走后端新端点 `POST /api/info/search`（embed 查询 → Zilliz 近邻）。据此三条子决策：
  - **向量库选型**：用 Zilliz Cloud serverless（用户已有集群），**REST v2 + 标准库 urlopen**，**不引 pymilvus**（守 ADR 0010「依赖极简且可撤回」）。
  - **embedding 自算 BYO**：后端用 OpenAI 兼容 `/embeddings` 端点算向量（key 在 `workbench.local.json`），查询与文档同一模型（对称性）；维度由建库脚本探测。密钥全在后端，绝不下放浏览器（安全边界）。
  - **data.json 契约扩字段**：item 新增 `aiSummary`(string)、`aiTags`(string[])——**这是单向门**（本 ADR 即其记录）；前端做缺字段兜底（回退原始 `summary`）。

- 理由：语义检索本质是最近邻搜索，Zilliz 直接提供持久化+过滤+规模；REST/urlopen 而非 SDK，把新依赖压到"可随时撤回"。摘要+标签+向量同源一次算完，符合"贵活集中发生一次"。按 url 缓存让每轮成本 ∝ 新增数而非总数（幂等），并护住 AI 字段不被 export 覆盖。

- 代价 / 护栏 / 何时重估：
  - **放弃了"资讯全链路离线可跑"**——语义检索依赖联网（Zilliz + embedding）；护栏：未配置 `enrich`/`zilliz` 时整条能力**优雅停用**（enrich 跳过、`/api/info/search` 回 `configured:false`、前端隐藏语义输入只留客户端筛选），App 其余部分与词面筛选照常离线可用（照抄 opencli/mcp 的优雅劣化范式）。
  - **成本护栏**：`enrich.maxItemsPerRun`（默认 200）+ 批量摘要 + 按 url 缓存，超限记日志并停（不无界）；enrich 任何异常都不抛到管线（沿用各 fetch"失败不阻断"）。
  - **密钥红线**：Zilliz token、chat/embedding key 只写 `workbench.local.json`（gitignore），不入库、不进对话、不下放前端；`enrich_cache.json` 亦 gitignore。
  - **回滚**：删 `enrich` STEPS 一行 + 删 `enrich.py`/`llm.py`/`zilliz.py`/`build_zilliz_collection.py`/`/api/info/search` + 前端搜索条 → 回到纯抓取管线；`aiSummary`/`aiTags` 前端有兜底，删了不崩。
  - **何时重估**：条目量级增大到暴力/serverless 限额吃紧，或需离线语义时，再评估本地 embedding / 向量库自托管。
