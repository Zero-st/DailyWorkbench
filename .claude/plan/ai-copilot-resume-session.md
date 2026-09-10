# AI 副驾 agent 模式：话题隔离的 `--resume` 续接，修「追问丢原文」又不让不同问题互相串

## Context（为什么做这件事）

**现象**：AI 副驾点「讲讲」首轮能抓原文分析；但接着**追问/咨询**时，AI 拿不到原文全文、也接不上上一轮，无法继续分析总结。

**根因（第一性原理）**：agent 模式每轮都是一个**全新、无状态的 `claude -p` 子进程**（[agent.py](backend/clients/agent.py) 每次 `subprocess.Popen`、`finally` 里 `proc.kill()` 用完即焚，argv 无 `--resume`/`--continue`），前端 agent 模式又**只发当前输入框那一句**（[ai.js:431](js/views/ai.js#L431) `payload:{prompt:q}`，不带历史）。双重失忆 → 追问那轮既没链接、也没上一轮抓到的正文。

**为什么用 `--resume`（而非前端重发历史/常驻进程/Agent SDK）**：`--resume` 官方唯一正解，**不养常驻进程**（仍是一次性子进程，贴合现范式），claude 从 `~/.claude/projects/<cwd>/<id>.jsonl` 读回会话——**上一轮抓的原文全文留在服务端会话里，追问不重抓**。前端重发历史救不回首轮抓的原文（前端只有最终回答）；常驻进程官方不支持；Agent SDK 要 pip → 撞零依赖红线（[TECH_CHARTER](docs/TECH_CHARTER.md) / ADR 0009）。

**但"永久串会话"是错的（本次核心修正）**：若把整个 dock 生命周期串成一个会话，上下文会**无限累积** → 涨 token、变慢、**易幻觉**，而且**问不同的问题会吃到之前无关的问答**。破解 = 给"记忆"划**话题边界**：记忆只在同一话题内有效，跨话题清零。本应用天然的话题边界 = 一次「讲讲/提炼/存库」按钮点击。**已与用户确认采用「话题隔离续接」**。

**预期结果**：同一篇文章能连续深挖追问（原文全文一直在）；换文章/换话题自动开新会话、不串、上下文不膨胀；用户还能随时手动「新话题」清零。

## 方案（改动点）

### 1. 后端 `backend/clients/agent.py`（话题无关：给 id 就续，不给就新开）
- **`stream(task, payload)`**：读 `payload.get("session_id")`；若存在**且通过 UUID 校验**（正则 `^[0-9a-fA-F-]{36}$`，防 `--xxx` 形态参数注入），argv 追加 `--resume <session_id>`；否则照旧全新会话。
  - **安全边界不破的关键**：argv 每轮重建，`--restricted --tools <只读> --allowedTools <只读> --permission-prompts none --strict-mcp-config --mcp-config <只读server>` **每轮照旧重传**。官方说明 `--resume` 不恢复原会话权限模式、以本次 `-p` 传入为准 → 续接旧会话**不会**放宽只读白名单。docstring 写明。
- **`_map_event(ev)`**：`system/init` 与 `result` 事件的输出 dict 都带上 `"session_id": ev.get("session_id")`，供前端捕获。
- **续接失效兜底**：会话过期/文件缺失时 `--resume` 会失败。做**降级重跑一次**：带 `--resume` 的子进程非零退出且未产出任何 text/result → 去掉 `--resume` 重跑（等价开新会话），新 init 的 session_id 自然经事件回给前端刷新。（话题隔离下会话寿命短、几乎碰不到过期，此兜底主要防边缘情况。）

### 2. 后端 `backend/server.py`
- **无需改**：[_post_agent](backend/server.py#L339) 已把 `payload` 原样透传给 `agent.stream`。

### 3. 前端 `js/views/ai.js`（话题边界全在这里）
- 新增模块级 `var _dockSessionId = "";`——**纯内存**，不持久化（页面刷新即自然开新话题，也顺带免掉跨天续接过期问题）。
- **话题边界 = 按钮入口重置**：`dockAsk(prompt, opts)`（[ai.js:146](js/views/ai.js#L146)，讲讲/提炼/存库的唯一收口）在开讲前 `_dockSessionId = ""`（除非 `opts.keepSession`）。于是每次「讲讲」都是新会话、带该文章链接重抓，**绝不带上一篇文章的问答**。可选：往 #aiChat 插一条 `— 新话题 —` 分隔，让用户看见边界。
- **续接 = 输入框追问**：`_aiAgentSend(q)`（[ai.js:431](js/views/ai.js#L431)）`payload` 改 `{ prompt: q, session_id: _dockSessionId || undefined }`；回调补 `onMeta`：`if (ev.session_id) _dockSessionId = ev.session_id;`，`onResult` 兜底同样捕获。用户在输入框里手打的追问 = 续接当前话题（原文/上文都在）。
- **`aiClear`**（[ai.js:196](js/views/ai.js#L196)）：清空对话时 `_dockSessionId = ""`（= 开新会话，语义一致）。
- **新增「新话题」按钮**：放在「清空对话」旁（[ai.js:92](js/views/ai.js#L92)），点击 = `_dockSessionId = ""` + 插入 `— 新话题 —` 分隔，但**保留可见历史**。用途：连续手打不相关问题时，手动断开续接、防串（这正是本模型接受的唯一残留场景的出口）。挂 `window.dockNewTopic`。
- 机制自然覆盖：首轮 session 空→全新 claude 抓原文；同话题追问→`--resume`→原文/上文在；换文章(讲讲)或点新话题→清零→干净重来。

### 4. 前端 `js/core/agent-stream.js`
- **无需改**：`_dispatchFrame` 已把完整 `ev`（含 `session_id`）派发给 `onMeta`/`onResult`。

### 5. 收尾门禁 & 文档
- 动了 `js/` → **必跑 `python bump_version.py`**（CI `--check` 会红，CLAUDE.md 红线 #4）。
- 无 CSS token / `data.json` 契约改动（若给「新话题」按钮加样式，只用现成 token，不硬编码）。
- **ADR 0009 追加一节**：记「agent 跨轮 `--resume`（话题隔离：按钮入口开新会话、输入框追问续接）+ 每轮重传只读白名单守边界」这一决策。
- 计划获批后，把本 plan 复制一份到项目 `.claude/plan/ai-copilot-resume-session.md`（CLAUDE.md 约定）。

## 关键文件
- [backend/clients/agent.py](backend/clients/agent.py) — `stream()` 加 `--resume` + UUID 校验 + 降级；`_map_event()` 透出 `session_id`；只读白名单/安全 argv 不变。
- [js/views/ai.js](js/views/ai.js) — `dockAsk` 重置话题、`_aiAgentSend` 发/收 `session_id`、`aiClear` 复位、新增 `dockNewTopic` 按钮。
- [docs/adr/0009-*.md](docs/adr/) — 追加决策记录。

## 验证（端到端）
1. `python -m backend.server <端口>` 起后端，从后端地址打开工作台（非静态源，否则 Failed to fetch）。
2. 卡片点「让 AI 讲讲」→ 首轮出现 WebFetch chip、基于原文作答；确认 `~/.claude/projects/<ROOT 编码>/` 下新增一个 `<session-id>.jsonl`。
3. **同话题续接**：输入框追问「把第 3 点展开详细讲」→ 基于原文/上一轮继续作答；抓包看第 2 次 `/api/agent` 请求体带了 `session_id`。
4. **换文章不串**：点另一篇卡片「讲讲」→ 抓包确认该请求 `session_id` 为空（新会话）、回答只关于新文章、不提上一篇内容。
5. **新话题按钮**：手打问 A、再问不相关的 B 之前点「新话题」→ B 的请求 `session_id` 为空，回答不含 A 的上下文。
6. **清空复位**：点「清空对话」后再问 → 新会话（无上文）。
7. **注入防护**：伪造非法 `session_id`（如 `--help`、随机串）→ 后端 UUID 校验拦下、按新会话处理，不塞进 argv。
8. 收尾：`python bump_version.py` 后 `git diff` 确认 version 已 bump；`python check_design_tokens.py` 仍绿。
