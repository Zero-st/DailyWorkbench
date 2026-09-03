// 视图：AI 助手（Agnes / 智谱 GLM 双可选，浏览器直连，Key 存本机）+ 长期记忆 +
// @知识库提及 + 沉淀到知识库。从 app.js 剥出，行为不变。
// getAiActiveConfig/kbSave/kbMentionList 等经 window 全局取用（sibling 经典脚本）；
// switchView 亦经 window 桥接。aiAsk/renderAI 既 export（app.js router/首页调用）
// 又挂 window（内联 onclick）。
import { esc, ic } from "../core/util.js";
import { getData } from "../core/state.js";
import { fetchT } from "../core/net.js";

var WB = window.WB;

// ---------- AI 助手（Agnes / 智谱 GLM 双可选，浏览器直连，Key 存本机） ----------
var AI_PROVIDERS = {
  agnes: { label: "Agnes 2.5 Flash", url: "https://apihub.agnes-ai.cn/v1/chat/completions", model: "agnes-2.5-flash", keyKey: "wb_ai_key_agnes" },
  glm: { label: "智谱 GLM Flash", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash", keyKey: "wb_ai_key_glm" }
};
var aiProv = localStorage.getItem("wb_ai_prov") === "glm" ? "glm" : "agnes";
var aiMsgs = [];   // 会话内消息历史
var aiBusy = false;
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
    '<button class="btn-sm" onclick="aiClear()">清空对话</button>' +
    (hasKey ? "" : '<span class="ai-guide">' + ic("alertTriangle") + ' 还没设置 API Key，请到「模型管理」添加并激活一个模型。</span>') +
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
// 从其他卡片一键跳转 AI 助手：切 tab → 内容填入输入框（可选自动发送）
function aiAsk(text, autoSend) {
  switchView("ai");
  var box = document.getElementById("aiBox");
  if (box) {
    box.value = text || "";
    try { box.focus(); } catch (e) {}
  }
  if (autoSend) {
    setTimeout(function () { aiSend(); }, 80);
  }
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
    try { localStorage.removeItem(AI_HIST_KEY); } catch (e) {}
    var chat = document.getElementById("aiChat");
    if (chat) chat.innerHTML = '<div class="empty">对话已清空。输入问题，AI 会用大白话回答…</div>';
  });
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
function aiSend() {
  if (aiBusy) return;
  var box = document.getElementById("aiBox");
  var cfg = (typeof getAiActiveConfig === "function") ? getAiActiveConfig() : null;
  if (!cfg) cfg = AI_PROVIDERS[aiProv] ? { label: AI_PROVIDERS[aiProv].label, url: AI_PROVIDERS[aiProv].url, model: AI_PROVIDERS[aiProv].model, key: aiKeyLoad(), maxTokens: aiProv === "agnes" ? 4000 : 800 } : null;
  if (!cfg || !cfg.url) { WB.dialog.alert("请先前往「模型管理」添加并激活一个 AI 模型。"); return; }
  if (!cfg.key) { WB.dialog.alert("「" + cfg.label + "」尚未设置 API Key，请到「模型管理」编辑后保存。"); return; }
  var q = (box ? box.value : "").trim();
  if (!q) return;
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
window.aiSaveKey = aiSaveKey; window.aiSend = aiSend; window.aiSetProv = aiSetProv; window.aiAsk = aiAsk; window.aiClear = aiClear; window.aiMemoryAdd = aiMemoryAdd; window.aiMemoryDel = aiMemoryDel; window.aiMemoryClear = aiMemoryClear;
// 经典脚本桥接：model-manager.js 改模型配置后 `renderAI(window.__data)` 刷新 AI 视图需此。
window.renderAI = renderAI;

export { renderAI, aiAsk };
