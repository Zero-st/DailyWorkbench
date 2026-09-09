# 页面驱动 agent · Phase 2 已落地（`/api/agent` 流式 + 蒸馏楔子 + AI 带工具）

> 日期：2026-09-09　性质：实施计划 + 落地记录
> 决策/理由/踩坑的**单一真源** = [ADR 0009](../../docs/adr/0009-page-driven-agent.md)（本文不重复，只留形状 + 落点 + 验证 + 进度）
> 前身：[agent-mcp-sidecar.md](agent-mcp-sidecar.md)（Phase 1）、[ADR 0008](../../docs/adr/0008-mcp-integration-layer.md)（其「何时重估·Phase 2」的兑现）

## 缘起（一句话）
Phase 1 把知识库工具化了，但入口只在终端；蒸馏还是「复制→贴进 CC→贴回来」人肉接力。Phase 2 在**页面**里点一下就流式驱动无头 agent（编排仍在 harness，SPA 不重造 agent loop）。

## 三层落点（本次落「入口层 + 一条流式脊柱」）
```
入口层  [蒸馏库·▶直接蒸馏]  [AI助手·带工具]     ← 本次
前端脊柱 js/core/agent-stream.js（fetch+getReader 解析 SSE）  ← 本次·本仓首个流式消费者
后端端点 POST /api/agent（流式 handler，自握 wfile）          ← 本次
编排层  subprocess claude -p --output-format stream-json（无头 harness）
工具层  backend/mcp/（Phase 1；本次加 --read-only 模式，不注册 kb_save）
数据层  Obsidian vault（读）｜ 写库走 /api/kb/save 人工点击闸
```

## 本次决策（三问拍板，详见 ADR 0009）
- 范围 = **两者都要**（蒸馏楔子 + 通用 agent 对话），共用一条流式脊柱。
- 传输 = **真流式 SSE**（`Popen→stdout→SSE→fetch/getReader`）。
- 写闸 = **起草 + 人点保存**：页面触发的 agent **一律只读**（白名单不含 `kb_save`）。

## 改了哪些文件
**后端**
- `backend/core/config.py`：+ `claude_cmd()` / `mcp_server_argv()` / `agent_model()`（默认 sonnet）/ `agent_budget_usd()`。
- `backend/clients/agent.py`（新）：`stream()` 生成器 —— 组硬化 argv、`Popen(stdin=DEVNULL)`、逐行解析 stream-json → 精简事件；墙钟看门狗 + 断连杀子进程。
- `backend/server.py`：POST_ROUTES + `_post_agent`（`_guard_origin` → SSE 头 → 逐事件 `wfile.flush()` → 断连 `gen.close()`）。
- `backend/mcp/server.py`：`--read-only`/`WB_MCP_READONLY` 模式 → **不注册 `kb_save`**（协议层断写）。

**前端**（改 js/css → 已跑 `bump_version.py`）
- `js/core/agent-stream.js`（新）：SSE 脊柱，`{onMeta,onText,onTool,onResult,onError}`。
- `js/views/distill.js`：新蒸馏表单 ①「▶ 直接蒸馏」→ `distillRun()` 流式 → 起草卡回填正文区（`_fillDraft`，抽标题/tier）→ 人点现成「保存」。
- `js/views/ai.js`：「普通/带工具」段控 → `_aiAgentSend()` 流式（工具 chip + 正文原位增量）；带工具模式放行原 `_looksLikeDistillCmd` 拦截。
- `js/core/distill-template.js`：+ `buildDistillAgentPrompt()`（复用同一 `_shell` 六维骨架，改 WebFetch 抓）。
- `js/core/icons.js`：+ `play` 图标。`css/styles.css`：+ `.agent-log/.agent-step/.agent-dot` 等（§6.0 效果图已过目）。`sw.js`：预缓存加 `agent-stream.js`。
- `check_design_tokens.py`：化石基线 19→18（本次多引用了 `--candy-green*` 等）。

**文档**：ADR 0009；docs/README §4；本文 + agent-mcp-sidecar.md 路线图。

## 安全边界（纵深，每层真机验证 —— 详见 ADR 0009「代价」）
`--restricted`（除 Bash + 无视 ambient 放行）× `--tools` 收窄可用集 × MCP `--read-only`（`kb_save` 协议层不存在）× `--strict-mcp-config` 隔离 × `--permission-prompts none` × `_guard_origin`。
> **两个真机排出、勿「简化」的坑**：① `dontAsk` = 放行不是拒绝；② `--allowedTools` 管不住 MCP 暴露的工具（故 MCP 只读不注册 kb_save）。

## 验证（已过）
- 后端 E2E：curl `/api/agent` 见 SSE `meta/tool/text/result`；对抗式提示确认 **Bash/kb_save 双双「工具集不存在」**、蒸馏库条数不变（没被写）；`--model sonnet` 成本分钱级。
- 前端：5 模块 `import()` 无 SyntaxError；`agent-stream.js` 跨 chunk 拆帧单测全过。
- 零依赖回归：`import backend.server` 不加载 `mcp`；未装 claude 时优雅劣化。
- 门禁：`check_design_tokens.py` 绿（孤儿 0 / 化石 18）、`bump_version.py --check` 绿（CACHE=workbench-8f4601c0）。
- 待用户在浏览器点一下走查（前后端契约两侧已各自证过）。

## 回退 ≈ 0
删 `/api/agent` + `backend/clients/agent.py` + `js/core/agent-stream.js` + 两处按钮即断；`backend/mcp/server.py` 的 `--read-only` 对 Phase 1（终端 `claude mcp add`，不带此标志）无副作用。
