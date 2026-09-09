# 全局 AI 副驾 dock · Phase 2.1 已落地（右侧浮遊·可调宽高·记忆；取代「AI 助手」整页视图）

> 日期：2026-09-09　性质：实施计划 + 落地记录
> 承 [page-driven-agent.md](page-driven-agent.md)（Phase 2 流式脊柱）；决策记忆 = `memory/ai-copilot-dock.md`
> 效果图（§6.0 已过目）：`docs/reference/devhtml/ai副驾-右侧dock-效果图.html`

## 缘起
资讯/日报的「让 AI 讲讲 / 提炼要点 / 存进知识库」原是老桩：都走 `aiAsk()` 把**一条平文串**塞进 AI 助手整页视图 → 跳转、丢上下文、只带标题。用户改判为**右侧全局浮遊、可自由调大小的对话副驾**（几轮迭代：内联 → 浮遊 dock 定稿）。AI 助手由「一个导航视图」升为「随叫随到的右侧对话 dock」。

## 三问定稿
- 定位 = **全局 AI 副驾 dock**（跨视图常驻；讲讲/提炼/存库都喂它；也能空手聊）
- 调整 = **右边停靠 · 拖左缘调宽 · 拖下/角调高 · localStorage 记忆尺寸/开合**
- 深度/范围/写闸 = 深挖先抓原文 / 全扫三钮 / 只读起草 + 人工写闸（沿用 Phase 2）

## 改了哪些文件
- **新 `js/features/convo-dock.js`**：浮遊可缩放外壳（`pointer` 手写 resize：左缘宽 / 下缘·左下角高）+ 收起 launcher；`.open` 类显隐（避开 `[hidden]` 被 `display:flex` 盖过的坑）；持久化 `wb_dock_open`/`wb_dock_rect`；桥 `window.dockOpen/dockClose/dockToggle`。dock body 即 `#col-ai`（唯一 AI 挂载点），`renderAI()` 渲入。
- **`js/views/ai.js`**：`aiAsk` 由 `switchView("ai")` 改为 `window.dockOpen()`；新增 `dockAsk(prompt,{agent,autoSend})`（开 dock→带工具→填框→自动发），桥 `window.dockAsk`。聊天引擎（`aiMsgs`/`wb_ai_history`/`_aiAgentSend`+`agentStream`）零改动。
- **`js/views/info.js`**：每卡「讲讲」→ `newsExplain(this)`：`data-*` 带全 {标题+摘要+链接+来源}，有链接则让 agent 先 `WebFetch` 原文再讲（深挖）→ `dockAsk(agent,autoSend)`。顶部四钮（提炼/存库 × AI日报/每日新闻）→ `feedAsk(kind)`：内嵌当日 digest（修「数据带不过去」= Loss B）。
- **`js/app.js` + `index.html`**：删侧栏「AI 助手」nav item + `#view-ai` 容器；清 `renderActiveTab` 的 `ai` 分支 / `titles` 的 `ai` / `wb_tab==='ai'` 开机回退 `home`；引导块 `initConvoDock()`。
- **`css/styles.css`**：`.convo-dock` / `.dock-head` / resize 手柄 / `.dock-launcher` + dock 内卡片铺满、隐藏卡片 h2（仅 token，令牌门禁绿）。**`sw.js`**：FILES 加 `convo-dock.js`；`bump_version.py` 已跑（CACHE=workbench-fea6e8e1）。

## 边界（守住北极星）
零后端改动、不碰 `data.json`/`/api` 现有契约、零新依赖（复用 Phase 2 subprocess 脊柱）、写库仍走人工闸。**双向门 → 不写 ADR。**

## 验证（chrome-devtools 真机，2026-09-09）
- DOM：launcher/dock/`#col-ai`-in-dock 存在；`.side-item[data-view=ai]` 与 `#view-ai` 已消失。
- 讲讲：`newsExplain` 构 prompt = `agent:true/autoSend:true` + WebFetch 指示 + 标题/摘要/原文/来源全字段。
- dock：`dockOpen()` → `#aiBox`/`#aiChat` 挂载、卡片 h2 隐藏、三手柄在、默认 400×640、launcher 隐。
- resize：拖左缘 400→520px，`wb_dock_rect={w:520,h:640}` 落盘。
- dockAsk：`#aiBox` 被填、`wb_ai_agent_mode=1`、「带工具」chip 点亮。
- 门禁：`check_design_tokens.py` 绿（化石 18=基线 / 孤儿 0）、`bump_version.py` 绿、4 个 JS `node --input-type=module --check` 绿、控制台 0 error/warn。
- 已知：dev 浏览器**模块 bytecode 缓存**对 `info.js` 异常粘（`import()` 强刷即新、后端配新），真用户经 SW 更新（CACHE 换名）取新；本机测试建议硬刷新（Ctrl+Shift+R）一次。

## 回退 ≈ 0
删 `convo-dock.js` + 还原 `ai.js` 一行（`dockOpen`→`switchView("ai")`）+ `info.js` 触发 + 恢复侧栏「AI 助手」nav/`#view-ai` 与 `app.js` 接线。
