# Phase 1 实施计划 · up 主经验蒸馏库

> 关联：`docs/知识飞轮-路线图.md`（Phase 1）、`docs/知识库沉淀存储方案.md`（沉淀写入规范）。
> 范围：**纯本地 · 零云**。复用现有 `kbSave` 沉淀底座，新增「蒸馏库」模块与视图。
> 不碰：Supabase / 云 / 手机端（留 Phase 3-4）。

## Context

飞轮里"信息密度最高、最花时间"的环节是**消化 up 主经验**（小红书 / B站 / 图文帖）。现状只到"一次性 prompt 交接"（`js/views/ov.js:94` 的「蒸馏视频」按钮 → `video-cangjie-distill`；`export_data.py` 快捷指令 → `creator-video-decoder`），**产出没有沉淀成可检索、可复用的库**。本 Phase 把它系统化：up 主内容 → skill 蒸馏 → 结构化"经验卡" → 落 Obsidian `蒸馏库/` → 可浏览可筛选可复用。

## 数据层

### 1. 登记新沉淀模块（改规范文档）
- `docs/知识库沉淀存储方案.md` §3.1 模块表新增一行：`蒸馏库 | 蒸馏库 | up主经验卡（视频/图文蒸馏）`；§5 `source` 枚举加 `distill`。

### 2. 后端放开白名单（`backend/clients/kb.py`）
- `MODULES` 白名单加 `"蒸馏库"`（第 ~20 行）。
- `SOURCES` 枚举加 `"distill"`（第 21 行 `SOURCES = [...]`）。
- **经验卡额外 frontmatter 字段**：现 `save()`（第 191 行）写的是**固定** frontmatter（module/date/source/savedAt/title/tags，模板在第 223 行）。为承载 `platform/author/url/topic/actionable`，给 `save()` **加一个可选参数** `extra: dict=None`，非空时把这些键**合并进 frontmatter**（放在 tags 之后）。保持向后兼容——其它模块不传 `extra`，行为不变。
- `POST /api/kb/save` 路由（`backend/server.py:229` `_post_kb_save`）透传可选 `extra` 字段给 `kb.save()`。

### 3. 经验卡结构（frontmatter 契约）
```markdown
---
module: 蒸馏库
date: 2026-08-28
source: distill
savedAt: 2026-08-28T..+08:00
title: <主题>
tags: [AI工作台, 蒸馏库]
platform: bilibili        # xhs | bilibili | article
author: <up主/作者>
url: <原链接>
topic: <主题分类>
actionable: [<可复用动作1>, <动作2>]
---

# <主题>
（skill 产出的六维拆解 / 要点正文）
```

## 前端层（原生 ES Modules，遵宪章）

### 4. 新增视图 `js/views/distill.js`（侧边栏「蒸馏库」）
- **列表/浏览**：拉 `/api/kb/tree`（或 `_index.jsonl`）筛 `module=蒸馏库` 的卡，渲染成卡片网格；显示 title/platform/author/topic + 「可复用动作」摘要。
- **筛选**：按 `platform`（小红书/B站/图文）、`topic` 过滤；复用 `/api/kb/search?q=` 做全文检索。
- **点开**：调 `/api/kb/note?path=` 读全文（Markdown 渲染复用 `vendor/marked.min.js`）。

### 5. 「+ 新蒸馏」流程（复用 skill 交接雏形）
- 弹出：选平台 → 填链接（+可选作者/主题）。
- 按平台 `cmdtext()`（`js/core/util.js:191`）拼指令并复制：
  - B站/小红书视频 → `用 creator-video-decoder 拆解以下视频…` 或 `用 video-cangjie-distill…`
  - 图文帖/文章 → `用 baoyu-url-to-markdown 抓取并转 markdown…`
- 用户在 AI 侧跑完 → 把产出**粘回**文本框 → 点保存 → `kbSave({ module:"蒸馏库", source:"distill", title, body, extra:{platform,author,url,topic,actionable} })`。

### 6. 接线与缓存戳
- `js/app.js`：侧边栏加「蒸馏库」入口（`data-view="distill"`），`switchView` 分支渲染 `distill` 视图（参照现有视图注册方式，如 `js/views/ov.js` 的挂载）。
- `bump_version.py` 的 `ASSETS` 列表加 `"js/views/distill.js"`；改完跑 `python bump_version.py` 同步 `index.html`/`sw.js` 的 `?v=` 与 CACHE。
- `sw.js` FILES 若需显式列出新模块，一并加（bump 脚本会处理 `?v=` 戳）。

## 复用清单（不重写）
- `kbSave`（`js/kb.js:167`）、`window.kbSave`
- `cmdtext`（`js/core/util.js:191`）
- `/api/kb/save`（`backend/server.py:229` → `backend/clients/kb.py:191`）
- `/api/kb/tree` `/api/kb/search` `/api/kb/note`
- `js/views/ov.js:94` 的 skill 交接按钮雏形
- `vendor/marked.min.js`（Markdown 渲染）

## 验证

**后端**
- 起服务：`python -m backend.server 8080`（`/home/dev_st/iriswork/tools/anaconda/bin/python`）。
- 模拟保存：`POST /api/kb/save` body `{module:"蒸馏库", source:"distill", title:"测试卡", body:"# 测试", extra:{platform:"bilibili",author:"x",url:"...",topic:"RAG",actionable:["试A"]}}` →
  - Obsidian `蒸馏库/<今日>/测试卡.md` 落盘；
  - frontmatter 含 platform/author/url/topic/actionable；
  - `_index.jsonl` 追加一条；
  - `depositRoot` 之外路径穿越被拒（§6.3 realpath 校验仍生效）。

**前端**（Chrome DevTools MCP）
- 走查「蒸馏库」视图：卡片渲染、平台/主题筛选、搜索命中。
- 「+新蒸馏」：选平台→指令正确复制→粘回→保存成功提示含相对路径。
- `list_console_messages` 无新增报错（仅既有 schedule.json 404 属预期）。

**工程门禁**
- `python bump_version.py --check` 绿。
- `tsc --noEmit -p jsconfig.json` 0 报错（distill.js 若无 `// @ts-check` 不纳入强校验，符合宪章"类型化只覆盖干净边界"）。
- `python -m pytest -q` 全过（如为 `kb.save()` 的 `extra` 合并加一条单测更佳）。

## 代价与边界（诚实）
- 纯本地、双向门，坏了随时改回。
- **依赖 Obsidian 库存在**（`kb.local.json`/`workbench.local.json` 的 `depositRoot` 已配）——未配则蒸馏库只读不了/存不进，需先按 `docs/知识库沉淀存储方案.md` §2 配好落点。
- skill 蒸馏仍是"人在环中"（复制指令→跑→粘回），非全自动——符合当前"零依赖、不接外部自动化"的取舍；未来若要一键直出，再单独评估。
- 完成后回来更新 `docs/知识飞轮-路线图.md` §6 变更记录（Phase 1 done）。
