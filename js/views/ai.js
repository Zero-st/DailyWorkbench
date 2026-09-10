// 视图：AI 助手（Agnes / 智谱 GLM 双可选，浏览器直连，Key 存本机）+ 长期记忆 +
// @知识库提及 + 沉淀到知识库。从 app.js 剥出，行为不变。
// getAiActiveConfig/kbSave/kbMentionList 等经 window 全局取用（sibling 经典脚本）；
// switchView 亦经 window 桥接。aiAsk/renderAI 既 export（app.js router/首页调用）
// 又挂 window（内联 onclick）。
import { esc, ic } from "../core/util.js";
import { getData } from "../core/state.js";
import { fetchT } from "../core/net.js";
// 带工具的 agent 对话：流式驱动后端无头 claude（Phase 2，见 ADR 0009）
import { agentStream } from "../core/agent-stream.js";

var WB = window.WB;

// ---------- AI 助手（Agnes / 智谱 GLM 双可选，浏览器直连，Key 存本机） ----------
var AI_PROVIDERS = {
  agnes: { label: "Agnes 2.5 Flash", url: "https://apihub.agnes-ai.cn/v1/chat/completions", model: "agnes-2.5-flash", keyKey: "wb_ai_key_agnes" },
  glm: { label: "智谱 GLM Flash", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash", keyKey: "wb_ai_key_glm" }
};
var aiProv = localStorage.getItem("wb_ai_prov") === "glm" ? "glm" : "agnes";
var aiMsgs = [];   // 会话内消息历史
var aiBusy = false;
// 话题隔离续接（仅 agent 模式）：本话题上一轮后端 claude 的 session_id，纯内存不持久化。
// 输入框追问带它 → 后端 --resume 续接（原文/上文都在）；讲讲/提炼/清空/新话题 → 清零开新会话。
var _dockSessionId = "";
// 「带工具」agent 模式：走后端 /api/agent（claude 无头·可查库/抓网页·只读）；关则走现成 /api/chat 直连。
function aiAgentMode() { try { return localStorage.getItem("wb_ai_agent_mode") === "1"; } catch (e) { return false; } }
function aiSetMode(on) {
  try { localStorage.setItem("wb_ai_agent_mode", on ? "1" : "0"); } catch (e) {}
  if (getData()) renderAI(getData());
}
function aiKeyLoad() { try { return localStorage.getItem(AI_PROVIDERS[aiProv].keyKey) || ""; } catch (e) { return ""; } }
function aiKeySave(k) { try { localStorage.setItem(AI_PROVIDERS[aiProv].keyKey, k); } catch (e) {} }
// 记忆：会话历史（刷新/重开不丢）长期记忆库（跨会话注入系统提示词）
var AI_HIST_KEY = "wb_ai_history";
var AI_MEM_KEY = "wb_ai_memory";
function aiHistLoad() {
  try { var a = JSON.parse(localStorage.getItem(AI_HIST_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function aiHistSave() {
  try { localStorage.setItem(AI_HIST_KEY, JSON.stringify(aiMsgs.slice(-50))); } catch (e) {}
}
function aiMemLoad() {
  try { var a = JSON.parse(localStorage.getItem(AI_MEM_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function aiMemSave(arr) {
  try { localStorage.setItem(AI_MEM_KEY, JSON.stringify(arr)); } catch (e) {}
}
function aiMemHtml() {
  var mem = aiMemLoad();
  if (!mem.length) return '<li class="empty">还没有记忆。记一笔，AI 以后跨会话都记得。</li>';
  return mem.map(function (m) {
    return '<li><span class="ai-mem-t">' + esc(m.text) + '</span><button class="ai-mem-x" title="删除" onclick="aiMemoryDel(' + m.ts + ')">✕</button></li>';
  }).join("");
}
function aiSysPrompt() {
  var sys = "你是用户个人工作台的 AI 助手，用中文大白话回答，简洁、可操作。";
  var mem = aiMemLoad();
  if (mem.length) {
    sys += "\n\n以下是你记住的关于用户的信息（长期有效、跨会话，回答时自然运用，不要逐条复述）：\n" +
      mem.map(function (m) { return "• " + m.text; }).join("\n");
  }
  return sys;
}
function aiSetProv(p) {
  aiProv = AI_PROVIDERS[p] ? p : "agnes";
  try { localStorage.setItem("wb_ai_prov", aiProv); } catch (e) {}
  if (getData()) renderAI(getData());
}
function renderAI(d) {
  var box = document.getElementById("col-ai");
  if (!box) return;
  aiMsgs = aiHistLoad();   // 恢复上次会话（刷新/重开不丢）
  var cfg = (typeof getAiActiveConfig === "function") ? getAiActiveConfig() : null;
  var legacyProv = AI_PROVIDERS[aiProv];
  if (!cfg && legacyProv) cfg = { label: legacyProv.label, url: legacyProv.url, model: legacyProv.model, key: aiKeyLoad(), maxTokens: aiProv === "agnes" ? 4000 : 800 };
  var hasKey = !!(cfg && cfg.key);
  var agentMode = aiAgentMode();
  var mem = aiMemLoad();
  var memHtml = aiMemHtml();
  var activeHint = cfg
    ? '当前模型：<b>' + esc(cfg.label) + '</b> · ' + esc(cfg.model) + ' · ' + (hasKey ? '已配置' : '未配置 Key')
    : '尚未配置模型，请先前往「模型管理」添加。';
  box.innerHTML = '<div class="card"><h2>AI 助手</h2>' +
    '<div class="ai-set">' +
    '<div class="ai-active-info">' + activeHint + '</div>' +
    '<button class="btn-sm" onclick="switchView(\'models\')">' + ic("cpu") + ' 模型管理</button>' +
    '</div>' +
    '<div class="ai-bar">' +
    '<span style="display:inline-flex;gap:6px;align-items:center">' +
      '<button class="chip' + (agentMode ? "" : " on") + '" onclick="aiSetMode(0)">普通</button>' +
      '<button class="chip' + (agentMode ? " on" : "") + '" onclick="aiSetMode(1)">' + ic("tool") + ' 带工具</button>' +
    '</span>' +
    (agentMode ? '<button class="btn-sm" onclick="dockNewTopic()" title="断开与上文的续接，接下来的提问从零开始（保留上面的记录）">' + ic("zap") + ' 新话题</button>' : "") +
    '<button class="btn-sm" onclick="aiClear()">清空对话</button>' +
    (agentMode
      ? '<span class="ai-guide" style="color:var(--sub);background:var(--panel-2);border-color:var(--line)">' + ic("zap") + ' 带工具：经后端 claude 跑，可查知识库 / 抓网页，只读不写库</span>'
      : (hasKey ? "" : '<span class="ai-guide">' + ic("alertTriangle") + ' 还没设置 API Key，请到「模型管理」添加并激活一个模型。</span>')) +
    '</div>' +
    '<details class="ai-mem"><summary>长期记忆库（' + mem.length + ' 条）· 点开管理</summary>' +
    '<div class="ai-mem-add"><input id="aiMemInput" class="sf" placeholder="记一笔长期记忆，如：我偏好简洁回答 / 我在学 Flutter…">' +
    '<button class="btn-sm" onclick="aiMemoryAdd()">记下</button></div>' +
    '<ul class="ai-mem-list" id="aiMemList">' + memHtml + '</ul>' +
    '<div class="ai-mem-foot"><button class="btn-sm danger" onclick="aiMemoryClear()">清空记忆库</button>' +
    '<span class="empty">仅存本机，AI 跨会话都会看到</span></div></details>' +
    '<div class="ai-chat" id="aiChat">' +
    (aiMsgs.length ? "" : '<div class="empty">输入你的问题，AI 会用大白话回答。可问它：总结今天日报 / 帮我挑值得看的新闻 / 待办怎么安排…</div>') +
    "</div>" +
    '<div class="ai-input">' +
    '<textarea id="aiBox" rows="2" placeholder="问 AI 点什么…（Enter 发送，Shift+Enter 换行；输入 @ 可引用知识库笔记）"></textarea>' +
    '<button class="btn" onclick="aiSend()">发送</button>' +
    '<button class="btn-sm" onclick="kbSaveChat()" title="把当前对话精华存进知识库">' + ic("archive") + ' 存知识库</button></div>' +
    "</div>";
  var ta = document.getElementById("aiBox");
  if (ta) ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !__kbMentionActive()) { e.preventDefault(); aiSend(); }
    if (__kbMentionActive() && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape" || e.key === "Tab")) {
      e.preventDefault(); __kbMentionKey(e.key);
    }
  });
  if (ta) ta.addEventListener("input", __kbMentionScan);
  if (ta) ta.addEventListener("blur", function () { setTimeout(__kbMentionHide, 200); });
  // 恢复历史对话到聊天框
  if (aiMsgs.length) {
    aiMsgs.forEach(function (m) { aiAppend(m.role, m.content); });
  }
}
function aiSaveKey() {
  var k = document.getElementById("aiKey");
  aiKeySave(k ? k.value.trim() : "");
  var h = document.getElementById("aiKeyHint");
  if (h) h.textContent = aiKeyLoad() ? "✓ 已保存（仅本机浏览器）" : "已清除";
}
// 从其他卡片一键唤起 AI 副驾 dock：开 dock → 内容填入输入框（可选自动发送）。
// 原先是 switchView("ai") 跳整页视图，Phase 2.1 改为右侧浮遊 dock（唯一 AI 面）。
function aiAsk(text, autoSend) {
  if (typeof window.dockOpen === "function") window.dockOpen();
  var box = document.getElementById("aiBox");
  if (box) {
    box.value = text || "";
    try { box.focus(); } catch (e) {}
  }
  if (autoSend) {
    setTimeout(function () { aiSend(); }, 80);
  }
}
// 卡片「讲讲」/顶部动作统一入口：开 dock（+可选切「带工具」模式）→ 填输入框 → 自动发。
// agent=true 时走后端 claude（可 WebFetch/查库、无需用户 API Key），讲讲的深挖抓原文靠它。
function dockAsk(prompt, opts) {
  opts = opts || {};
  // 话题边界：按钮入口（讲讲/提炼/存库）默认开新会话，绝不带上一篇文章/上一话题的问答。
  // 首轮带链接重抓原文；后续输入框追问才续接。opts.keepSession 可让某入口改为「接着聊」。
  if (!opts.keepSession) _dockSessionId = "";
  if (typeof window.dockOpen === "function") window.dockOpen();
  if (opts.agent) aiSetMode(1);   // 带工具（会重渲染 #col-ai，chip 同步）
  var box = document.getElementById("aiBox");
  if (box) {
    box.value = prompt || "";
    try { box.focus(); } catch (e) {}
  }
  if (opts.autoSend !== false) setTimeout(function () { aiSend(); }, 90);
}
function aiAppend(role, text) {
  var chat = document.getElementById("aiChat");
  if (!chat) return;
  if (role === "bot") {
    var wrap = document.createElement("div");
    wrap.className = "ai-msg bot";
    var body = document.createElement("div");
    body.className = "ai-bot-body";
    body.textContent = text;
    var cp = document.createElement("button");
    cp.className = "ai-copy";
    cp.textContent = "复制";
    cp.title = "复制这条回复";
    cp.onclick = function () {
      copyText(text);
      cp.textContent = "已复制";
      setTimeout(function () { cp.textContent = "复制"; }, 1500);
    };
    wrap.appendChild(body); wrap.appendChild(cp);
    chat.appendChild(wrap);
  } else {
    var div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.textContent = text;
    chat.appendChild(div);
  }
  chat.scrollTop = chat.scrollHeight;
}
function copyText(t) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t);
    } else {
      var ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  } catch (e) {}
}
function aiClear() {
  WB.dialog.confirm("清空当前对话？记忆库和长期记忆不受影响。", function () {
    aiMsgs = [];
    _dockSessionId = "";   // 清空 = 开新会话，语义一致
    try { localStorage.removeItem(AI_HIST_KEY); } catch (e) {}
    var chat = document.getElementById("aiChat");
    if (chat) chat.innerHTML = '<div class="empty">对话已清空。输入问题，AI 会用大白话回答…</div>';
  });
}
// 「新话题」：断开续接（清 session_id）但保留可见历史。用于连续手打不相关问题时防串。
function dockNewTopic() {
  _dockSessionId = "";
  var chat = document.getElementById("aiChat");
  if (chat && !chat.querySelector(".empty")) {
    var d = document.createElement("div");
    d.className = "ai-topic-sep";
    d.textContent = "— 新话题 —";
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
  }
}
// ---------- 知识库 @提及注入（输入 @笔记标题 引用笔记正文作上下文） ----------
var __kbMentions = [];      // [{name, rel}]
var __kbMentionItems = [];  // 当前浮层候选项
var __kbMentionSel = -1;
function __kbMentionActive() { var p = document.getElementById("kbMentionPop"); return p && p.style.display !== "none"; }
function __kbMentionScan() {
  var box = document.getElementById("aiBox"); if (!box) return;
  var v = box.value, pos = box.selectionStart, pre = v.slice(0, pos);
  var m = pre.match(/@([^\s@]*)$/);
  if (!m) { __kbMentionHide(); return; }
  if (typeof kbMentionList !== "function") return;
  __kbMentionItems = kbMentionList(m[1]);
  __kbMentionSel = -1;
  var p = document.getElementById("kbMentionPop");
  if (!p) { p = document.createElement("div"); p.id = "kbMentionPop"; p.className = "kb-mention-pop"; document.body.appendChild(p); }
  if (!__kbMentionItems.length) { p.style.display = "none"; return; }
  var rect = box.getBoundingClientRect();
  p.style.left = rect.left + "px"; p.style.top = (rect.bottom + 2) + "px"; p.style.width = rect.width + "px";
  p.innerHTML = __kbMentionItems.map(function (it, i) {
    return '<div class="kb-mention-it' + (i === 0 ? " sel" : "") + '" data-i="' + i + '" onclick="__kbMentionPick(' + i + ')">' + ic("book") + ' ' + esc(it.name) + '</div>';
  }).join("");
  __kbMentionSel = 0; p.style.display = "block";
}
function __kbMentionHide() { var p = document.getElementById("kbMentionPop"); if (p) p.style.display = "none"; __kbMentionItems = []; __kbMentionSel = -1; }
function __kbMentionKey(key) {
  if (!__kbMentionItems.length) return;
  if (key === "Escape") { __kbMentionHide(); return; }
  if (key === "ArrowDown") __kbMentionSel = (__kbMentionSel + 1) % __kbMentionItems.length;
  else if (key === "ArrowUp") __kbMentionSel = (__kbMentionSel - 1 + __kbMentionItems.length) % __kbMentionItems.length;
  else if (key === "Enter" || key === "Tab") { __kbMentionPick(__kbMentionSel); return; }
  var p = document.getElementById("kbMentionPop"); if (!p) return;
  var its = p.querySelectorAll(".kb-mention-it");
  its.forEach(function (el, i) { el.classList.toggle("sel", i === __kbMentionSel); });
}
function __kbMentionPick(i) {
  var it = __kbMentionItems[i]; if (!it) return;
  var box = document.getElementById("aiBox"); if (!box) return;
  var v = box.value, pos = box.selectionStart, pre = v.slice(0, pos);
  pre = pre.replace(/@([^\s@]*)$/, "@" + it.name + " ");
  box.value = pre + v.slice(pos);
  box.focus(); var np = pre.length; try { box.setSelectionRange(np, np); } catch (e) {}
  if (!__kbMentions.some(function (m) { return m.rel === it.rel; })) __kbMentions.push({ name: it.name, rel: it.rel });
  __kbMentionHide();
}
function __kbMentionsConsume() {
  // 收集正文：移除已删除的 @提及；返回正文拼条目（异步加载后 resolve）
  var live = [];
  var box = document.getElementById("aiBox");
  var text = box ? box.value : "";
  __kbMentions = __kbMentions.filter(function (m) { return text.indexOf("@" + m.name) >= 0; });
  if (!__kbMentions.length) return Promise.resolve(null);
  return Promise.all(__kbMentions.map(function (m) {
    var cached = (typeof kbGetMentionBody === "function") ? kbGetMentionBody(m.rel) : null;
    if (cached != null) return Promise.resolve({ name: m.name, body: cached });
    return (typeof kbLoadMention === "function" ? kbLoadMention(m.rel) : Promise.resolve(null)).then(function (b) { return { name: m.name, body: b || "" }; });
  })).then(function (arr) {
    var parts = arr.filter(function (x) { return x.body; }).map(function (x) { return "# " + x.name + "\n" + x.body; });
    if (!parts.length) return null;
    var joined = parts.join("\n\n");
    if (joined.length > 8000) joined = joined.slice(0, 8000) + "\n…（已截断）";
    return "以下是用户从知识库引用的笔记，作为回答上下文：\n\n" + joined;
  });
}
// ---------- 沉淀到知识库 ----------
function kbSaveChat() {
  if (!aiMsgs || !aiMsgs.length) { WB.dialog.alert("当前没有对话内容可保存。"); return; }
  var firstUser = (aiMsgs.filter(function (m) { return m.role === "user"; })[0] || {}).content || "对话精华";
  var title = String(firstUser).slice(0, 24).replace(/\n/g, " ");
  var body = "# 对话精华\n\n" + aiMsgs.map(function (m) {
    return (m.role === "user" ? "**问：** " : "**答：** ") + m.content;
  }).join("\n\n");
  if (typeof kbSave !== "function") { WB.dialog.alert("知识库模块未加载。"); return; }
  kbSave({ module: "AI助手", source: "ai-chat", title: title, body: body }).then(function (r) {
    if (r && r.ok) WB.dialog.alert("已存进知识库：\n" + r.path); else WB.dialog.alert("保存失败：" + ((r && r.error) || "未知错误"));
  });
}
function kbSaveReview() {
  var box = document.getElementById("reviewInput");
  var txt = box ? box.value.trim() : "";
  if (!txt) { WB.dialog.alert("复盘内容为空，先写点什么再存。"); return; }
  if (typeof kbSave !== "function") { WB.dialog.alert("知识库模块未加载。"); return; }
  kbSave({ module: "今日", source: "review", title: "今日复盘", body: "# 今日复盘\n\n" + txt }).then(function (r) {
    if (r && r.ok) WB.dialog.alert("已存进知识库：\n" + r.path); else WB.dialog.alert("保存失败：" + ((r && r.error) || "未知错误"));
  });
}
window.kbSaveChat = kbSaveChat;
window.kbSaveReview = kbSaveReview;
window.__kbMentionPick = __kbMentionPick;
// 蒸馏交接指令识别：这类指令要抓网页/字幕正文再提炼，是写给 Claude Code（有抓取 skill）的。
// 粘进站内助手，无抓取工具的 glm 只会幻觉调用、把 <tool_call>/<think> 特殊 token 当正文吐出来。
// 标记见 core/distill-template.js 的 _shell（四段结构化骨架）。
function _looksLikeDistillCmd(t) {
  if (!t) return false;
  return t.indexOf("<六维经验卡") >= 0 || (t.indexOf("<任务>") >= 0 && t.indexOf("<材料>") >= 0);
}
// 过滤模型泄漏的思考/函数调用特殊 token（推理模型偶尔把 <think>/<tool_call> 当正文返回）。
// 全被过滤成空时回退原文，避免把整条回复吃没。
function _stripLeakedTokens(s) {
  if (!s) return s;
  var out = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<\/?(think|tool_call|tool_calls|arg_key|arg_value|tool_response|function_call)\b[^>]*>/gi, "");
  out = out.trim();
  return out || s.trim();
}
function aiSend() {
  if (aiBusy) return;
  var box = document.getElementById("aiBox");
  var q = (box ? box.value : "").trim();
  if (!q) return;
  // 带工具模式：走后端 claude agent（多步·查库·抓网页），用后端配置的 claude，不需要用户自己的 API Key
  if (aiAgentMode()) { _aiAgentSend(q); return; }
  // 普通模式：现有浏览器直连（需 cfg + key）
  var cfg = (typeof getAiActiveConfig === "function") ? getAiActiveConfig() : null;
  if (!cfg) cfg = AI_PROVIDERS[aiProv] ? { label: AI_PROVIDERS[aiProv].label, url: AI_PROVIDERS[aiProv].url, model: AI_PROVIDERS[aiProv].model, key: aiKeyLoad(), maxTokens: aiProv === "agnes" ? 4000 : 800 } : null;
  if (!cfg || !cfg.url) { WB.dialog.alert("请先前往「模型管理」添加并激活一个 AI 模型。"); return; }
  if (!cfg.key) { WB.dialog.alert("「" + cfg.label + "」尚未设置 API Key，请到「模型管理」编辑后保存。"); return; }
  // 护栏：像蒸馏交接指令就拦一下——普通模式抓不了网页/字幕，应去 Claude Code 或切「带工具」跑（确认可强发）
  if (_looksLikeDistillCmd(q)) {
    WB.dialog.confirm(
      "这条像是「蒸馏交接指令」，需要先抓取网页/字幕正文再提炼。\n\n" +
      "站内 AI 助手没有抓取工具，glm 只会假装调用工具、吐出乱码。这类指令请复制到 Claude Code 里跑" +
      "（那里有 baoyu-url-to-markdown / 抓取能力）。\n\n仍要在这里发送吗？",
      function () { _aiSendNow(q, cfg); }
    );
    return;
  }
  _aiSendNow(q, cfg);
}
function _aiSendNow(q, cfg) {
  var box = document.getElementById("aiBox");
  if (box) box.value = "";
  aiAppend("user", q);
  aiMsgs.push({ role: "user", content: q });
  aiHistSave();
  aiBusy = true;
  aiAppend("bot", "…思考中");
  __kbMentionsConsume().then(function (mctx) {
    var msgs = [{ role: "system", content: aiSysPrompt() }];
    if (mctx) msgs.push({ role: "system", content: mctx });
    msgs = msgs.concat(aiMsgs.slice(-10));
    return fetchT("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUrl: cfg.url,
        key: cfg.key,
        model: cfg.model,
        messages: msgs,
        max_tokens: cfg.maxTokens || 4000
      })
    }, 60000);
  })
    .then(function (r) {
      if (!r.ok) {
        if (r.status === 401) throw new Error("Key 无效或已过期，请重新保存");
        if (r.status === 429) throw new Error("请求太频繁（限流），稍等再试");
        throw new Error("HTTP " + r.status);
      }
      return r.json();
    })
    .then(function (j) {
      var msg = j.choices && j.choices[0] && j.choices[0].message;
      // 推理模型可能把 token 都花在思考上：正文空时回退展示思考片段
      var ans = (msg && msg.content && msg.content.trim()) || (msg && msg.reasoning_content ? "（思考中：）\n" + msg.reasoning_content : "（空回复）");
      ans = _stripLeakedTokens(ans);
      aiMsgs.push({ role: "assistant", content: ans });
      aiHistSave();
      var chat = document.getElementById("aiChat");
      if (chat && chat.lastChild) chat.removeChild(chat.lastChild);
      aiAppend("bot", ans);
    })
    .catch(function (err) {
      var chat = document.getElementById("aiChat");
      if (chat && chat.lastChild) chat.removeChild(chat.lastChild);
      var m = String((err && err.message) || err);
      // 「Failed to fetch」= /api/chat 端点不可达（多半是后端没在跑，或从静态服务/Pages 打开）
      if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
        m = "后端未连接：AI 聊天要靠本机后端代理转发。请用 `python -m backend.server <端口>` 启动，" +
            "并从后端那个地址（如 http://127.0.0.1:8899）打开工作台——用静态服务或 GitHub Pages 打开会连不上。";
      } else if (/aborted|AbortError|tim|超时/i.test(m)) {
        m = "请求超时：模型很久没返回，可能是网络慢或模型在长时间推理，稍后重试或换个模型。";
      }
      aiAppend("bot", m);
    })
    .then(function () { aiBusy = false; });
}
// 带工具 agent 对话：流式驱动后端无头 claude。工具步骤 chip + 正文随 SSE 原位增量刷。
// 只读（查库/抓网页）；要落库同样是「起草→人工存」，此处不写库。
function _aiAgentSend(q) {
  var box = document.getElementById("aiBox");
  if (box) box.value = "";
  aiAppend("user", q);
  aiMsgs.push({ role: "user", content: q });
  aiHistSave();
  aiBusy = true;
  var chat = document.getElementById("aiChat");
  var wrap = document.createElement("div");
  wrap.className = "ai-msg bot";
  var steps = document.createElement("div");
  steps.className = "agent-steps";
  var runPill = document.createElement("span");
  runPill.className = "agent-step run";
  runPill.innerHTML = '<span class="agent-dot"></span> 运行中…';
  steps.appendChild(runPill);
  var bodyEl = document.createElement("div");
  bodyEl.className = "ai-bot-body";
  bodyEl.textContent = "";
  wrap.appendChild(steps);
  wrap.appendChild(bodyEl);
  if (chat) { chat.appendChild(wrap); chat.scrollTop = chat.scrollHeight; }
  var acc = "", started = false;
  function finish(text) {
    if (runPill && runPill.parentNode) runPill.remove();
    if (!steps.children.length) steps.style.display = "none";
    var t = _stripLeakedTokens((text || "").trim()) || "（空回复）";
    bodyEl.textContent = t;
    if (!wrap.querySelector(".ai-copy")) {
      var cp = document.createElement("button");
      cp.className = "ai-copy"; cp.textContent = "复制"; cp.title = "复制这条回复";
      cp.onclick = function () { copyText(t); cp.textContent = "已复制"; setTimeout(function () { cp.textContent = "复制"; }, 1500); };
      wrap.appendChild(cp);
    }
    aiMsgs.push({ role: "assistant", content: t });
    aiHistSave();
    aiBusy = false;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
  agentStream({ task: "chat", payload: { prompt: q, session_id: _dockSessionId || undefined } }, {
    onMeta: function (ev) {
      // init 带回本会话 session_id → 记住，供本话题下一轮 --resume 续接。
      if (ev && ev.session_id) _dockSessionId = ev.session_id;
      // 续接失败（会话过期/缺失）→ 后端已降级开新会话，旧 id 作废等新 init 覆盖。
      if (ev && ev.phase === "resume_failed") _dockSessionId = "";
    },
    onTool: function (ev) {
      var s = document.createElement("span");
      s.className = "agent-step done";
      s.innerHTML = '<span class="mk">✓</span> <span class="tname">' + esc(ev.name || "tool") + "</span>";
      steps.insertBefore(s, runPill);
      if (chat) chat.scrollTop = chat.scrollHeight;
    },
    onText: function (t) {
      if (!started) { bodyEl.textContent = ""; started = true; }
      acc += t;
      bodyEl.textContent = acc;
      if (chat) chat.scrollTop = chat.scrollHeight;
    },
    onResult: function (ev) { if (ev && ev.session_id) _dockSessionId = ev.session_id; finish(acc || ev.text || ""); },
    onError: function (ev) {
      if (runPill && runPill.parentNode) runPill.remove();
      if (!steps.children.length) steps.style.display = "none";
      var m = (ev && ev.error) || "出错了";
      if (ev && ev.configured === false) m = "「带工具」需后端配置 claude：workbench.local.json 设 claudeCmd（或 PATH 有 claude）后重开后端。切回「普通」可用你自己的模型。";
      bodyEl.textContent = (acc ? acc + "\n\n" : "") + "⚠️ " + m;
      aiBusy = false;
    }
  });
}
function aiMemoryAdd() {
  var inp = document.getElementById("aiMemInput");
  if (!inp) return;
  var t = inp.value.trim();
  if (!t) return;
  var mem = aiMemLoad();
  mem.push({ ts: Date.now(), text: t });
  aiMemSave(mem);
  inp.value = "";
  if (getData()) renderAI(getData());
  else { var ul = document.getElementById("aiMemList"); if (ul) ul.innerHTML = aiMemHtml(); }
}
function aiMemoryDel(ts) {
  var mem = aiMemLoad().filter(function (m) { return m.ts !== ts; });
  aiMemSave(mem);
  if (getData()) renderAI(getData());
}
function aiMemoryClear() {
  WB.dialog.confirm("清空全部长期记忆？此操作不可恢复，对话不受影响。", function () {
    aiMemSave([]);
    if (getData()) renderAI(getData());
  });
}
window.aiSaveKey = aiSaveKey; window.aiSend = aiSend; window.aiSetProv = aiSetProv; window.aiAsk = aiAsk; window.dockAsk = dockAsk; window.aiClear = aiClear; window.dockNewTopic = dockNewTopic; window.aiMemoryAdd = aiMemoryAdd; window.aiMemoryDel = aiMemoryDel; window.aiMemoryClear = aiMemoryClear; window.aiSetMode = aiSetMode;
// 经典脚本桥接：model-manager.js 改模型配置后 `renderAI(window.__data)` 刷新 AI 视图需此。
window.renderAI = renderAI;

export { renderAI, aiAsk };
