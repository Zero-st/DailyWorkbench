// 个人工作台 · 数据驱动渲染 + PWA（ES Modules 主模块）
// 工具/图标/弹窗/复制/撤销已抽到 js/core/util.js（详见该文件）。
// 本文件暂作主模块，后续按视图逐步剥离到 js/views/*。
import { esc, escAttr, jsStr, ic, catLabel, undoSnack } from "./js/core/util.js";
import { getData, setData, getView, setView } from "./js/core/state.js";
import { renderStats } from "./js/views/stats.js";
import { renderOv } from "./js/views/ov.js";
import { renderSessArchive, closeHeat } from "./js/views/sess.js";
import { renderWeekAll } from "./js/views/week.js";
import { favsLoad, favsSave, renderFavs } from "./js/features/favs.js";
import { renderInfo } from "./js/views/info.js";
import { renderCap } from "./js/views/cap.js";

// WB 命名空间（dialog/esc/ic/jsStr）由 util.js 挂载到 window.WB；本模块内沿用 WB.dialog.*
var WB = window.WB;



  // ---------- 交互 ----------
  // filt/toggleCat 与 renderSkills/renderCap 已剥到 js/views/cap.js
  // 历史遗留：曾与 switchView 双路由并存。现统一委托 switchView（保留导出与全部调用者）。
  function switchTab(id) { switchView(id); }
  function goKPI(tab, cardId) {
    switchTab(tab);
    setTimeout(function () {
      var el = document.getElementById(cardId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
  // openHeat/closeHeat/renderHeat/sessFilter/sessStatus/renderSessArchive 已剥到 js/views/sess.js

  // ---------- 我的速记（localStorage，纯前端） ----------
  function notesLoad() {
    try { return JSON.parse(localStorage.getItem("wb_notes") || "[]"); } catch (e) { return []; }
  }
  function notesSave(list) { try { localStorage.setItem("wb_notes", JSON.stringify(list)); } catch (e) {} }

  function renderNotes() {
    var ul = document.getElementById("notesList");
    if (!ul) return;
    var list = notesLoad();
    if (!list.length) { ul.innerHTML = '<li class="empty">还没有速记，记一笔吧～</li>'; return; }
    ul.innerHTML = list.map(function (n, i) {
      return '<li class="note"><span class="nt">' + esc(n.text) + '</span>' +
        '<button class="nd" onclick="editNote(' + i + ')" title="编辑">✎</button>' +
        '<button class="nd" onclick="delNote(' + i + ')" title="删除">✕</button></li>';
    }).join("");
  }
  function addNote() {
    var ta = document.getElementById("noteInput");
    var t = (ta.value || "").trim();
    var h = document.getElementById("notesHint");
    if (!t) { if (h) h.textContent = "先写点内容"; return; }
    var list = notesLoad();
    list.unshift({ text: t, at: Date.now() });
    notesSave(list); ta.value = ""; if (h) h.textContent = "✓ 已添加";
    renderNotes();
  }
  function delNote(i) {
    var list = notesLoad();
    if (i < 0 || i >= list.length) return;
    var removed = list[i];
    list.splice(i, 1); notesSave(list); renderNotes();
    undoSnack("已删除速记", function () {
      var l = notesLoad(); l.splice(Math.min(i, l.length), 0, removed); notesSave(l); renderNotes();
    });
  }
  function editNote(i) {
    var list = notesLoad();
    if (i < 0 || i >= list.length) return;
    WB.dialog.prompt("编辑这条速记", list[i].text || "", function (t) {
      if (t === null) return;
      t = (t || "").trim();
      if (!t) { delNote(i); return; }
      list[i].text = t; list[i].at = Date.now(); notesSave(list); renderNotes();
    });
  }

  // 我的收藏/稍后读 已剥到 js/features/favs.js

  // ---------- 主题切换（三态：深色 / 浅色 / 跟随系统，与 App 端一致） ----------
  function syncThemeColor(light) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", light ? "#eaeef3" : "#0e1116");
  }
  // 读取主题模式：light / dark / system（默认浅色·钢蓝科技风）
  function _themeMode() {
    var v = localStorage.getItem("wb_theme");
    return (v === "light" || v === "dark" || v === "system") ? v : "light";
  }
  // 算出当前是否浅色：system 模式跟随系统配色偏好
  function _themeLight(mode) {
    if (mode === "light") return true;
    if (mode === "dark") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function applyTheme() {
    var mode = _themeMode();
    var light = _themeLight(mode);
    document.body.classList.toggle("light", light);
    var b = document.getElementById("themeBtn");
    if (b) {
      b.innerHTML = ic(light ? "sun" : "moon");
      b.title = "主题：" + (mode === "system" ? "跟随系统" : (light ? "浅色" : "深色")) + "（点此切换）";
    }
    syncThemeColor(light);
  }
  function toggleTheme() {
    // 循环：深色 → 浅色 → 跟随系统 → 深色
    var cur = _themeMode();
    var next = cur === "dark" ? "light" : (cur === "light" ? "system" : "dark");
    localStorage.setItem("wb_theme", next);
    applyTheme();
  }
  // 跟随系统模式下，系统主题变化实时响应
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (_themeMode() === "system") applyTheme();
    });
  }

  // toggleNS/toggleNews/renderNewsItem 与资讯(news)渲染 已剥到 js/views/info.js

  window.switchTab = switchTab; window.goKPI = goKPI;
  window.addNote = addNote; window.delNote = delNote; window.editNote = editNote; window.toggleTheme = toggleTheme;

  // ---------- 待办清单（可勾选，localStorage 纯前端） ----------
  var TODO_KEY = "wb_todos";
  function todosLoad() {
    try { return JSON.parse(localStorage.getItem(TODO_KEY) || "[]"); } catch (e) { return []; }
  }
  function todosSave(list) { try { localStorage.setItem(TODO_KEY, JSON.stringify(list)); } catch (e) {} }
  function renderTodos() {
    var ul = document.getElementById("todosList");
    if (!ul) return;
    var list = todosLoad();
    var done = list.filter(function (t) { return t.done; }).length;
    var prog = document.getElementById("todoProg");
    if (prog) {
      if (!list.length) {
        prog.innerHTML = '<span class="empty">还没有待办，写一条吧～</span>';
      } else {
        var pct = Math.round(done / list.length * 100);
        prog.innerHTML =
          '<span class="todo-badge">✓ ' + done + ' / ' + list.length + '</span>' +
          '<span class="todo-progress-bar"><span class="todo-progress-fill" style="width:' + pct + '%"></span></span>' +
          '<span style="font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums">' + pct + '%</span>';
      }
    }
    if (!list.length) { ul.innerHTML = '<li class="empty">还没有待办，写一条吧～</li>'; return; }
    ul.innerHTML = list.map(function (t, i) {
      return '<li class="todo' + (t.done ? " done" : "") + '">' +
        '<input type="checkbox" class="tc" ' + (t.done ? "checked" : "") + ' onchange="toggleTodo(' + i + ')">' +
        '<span class="tt">' + esc(t.text) + '</span>' +
        '<button class="nd" onclick="delTodo(' + i + ')" title="删除">✕</button></li>';
    }).join("");
  }
  function addTodo() {
    var ta = document.getElementById("todoInput");
    var t = (ta.value || "").trim();
    var h = document.getElementById("todosHint");
    if (!t) { if (h) h.textContent = "先写点内容"; return; }
    var list = todosLoad();
    list.unshift({ text: t, done: false, at: Date.now() });
    todosSave(list); ta.value = ""; if (h) h.textContent = "✓ 已添加";
    renderTodos();
  }
  function toggleTodo(i) {
    var list = todosLoad();
    if (i < 0 || i >= list.length) return;
    list[i].done = !list[i].done;
    todosSave(list); renderTodos();
  }
  function delTodo(i) {
    var list = todosLoad();
    if (i < 0 || i >= list.length) return;
    var removed = list[i];
    list.splice(i, 1); todosSave(list); renderTodos();
    undoSnack("已删除待办", function () {
      var l = todosLoad(); l.splice(Math.min(i, l.length), 0, removed); todosSave(l); renderTodos();
    });
  }
  function clearDone() {
    var list = todosLoad().filter(function (t) { return !t.done; });
    todosSave(list); renderTodos();
    var h = document.getElementById("todosHint");
    if (h) h.textContent = "✓ 已清除已完成";
  }

  // ---------- 专注计时（番茄钟，纯前端） ----------
  var pomoTotal = 25 * 60;
  var pomoRemain = pomoTotal;
  var pomoRunning = false;
  var pomoTimer = null;
  function pomoRender() {
    var el = document.getElementById("pomoT");
    if (el) el.textContent = ("0" + Math.floor(pomoRemain / 60)).slice(-2) + ":" + ("0" + (pomoRemain % 60)).slice(-2);
    var bar = document.getElementById("pomoBar");
    if (bar) bar.style.width = Math.round(100 * pomoRemain / pomoTotal) + "%";
    var b = document.getElementById("pomoBtn");
    if (b) b.textContent = pomoRunning ? "⏸ 暂停" : "▶ 开始专注";
  }
  function pomoToggle() {
    if (pomoRunning) {
      clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
    } else {
      pomoRunning = true;
      pomoTimer = setInterval(function () {
        pomoRemain--;
        if (pomoRemain <= 0) {
          clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
          pomoRemain = pomoTotal;
          var h = document.getElementById("pomoHint");
          if (h) h.textContent = "专注结束！把完成的待办勾掉吧";
          pomoBeep();
        }
        pomoRender();
      }, 1000);
    }
    pomoRender();
  }
  function pomoReset() {
    clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
    pomoRemain = pomoTotal;
    var h = document.getElementById("pomoHint"); if (h) h.textContent = "";
    pomoRender();
  }
  // 切换专注时长（未运行时同步重置倒计时；运行中保持当前进度，结束后按新时长）
  function pomoSetLen(min) {
    min = parseInt(min, 10) || 25;
    pomoTotal = min * 60;
    if (!pomoRunning) { pomoRemain = pomoTotal; }
    pomoRender();
  }
  function pomoBeep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  }
  window.pomoToggle = pomoToggle; window.pomoReset = pomoReset; window.pomoSetLen = pomoSetLen;
  window.addTodo = addTodo; window.toggleTodo = toggleTodo; window.delTodo = delTodo; window.clearDone = clearDone;

  // ---------- 渲染 ----------
  function renderKPI(d) {
    var k = d.kpi, disk = (d.status && d.status.disk) || {};
    var items = [
      { c: "kpi-blue", i: ic("book"), v: k.knowledge, l: "知识库文件", tab: "ov", card: "card-kb" },
      { c: "kpi-green", i: ic("settings"), v: k.automations, l: "定时任务", tab: "ov", card: "card-auto" },
      { c: "kpi-purple", i: ic("hardDrive"), v: (disk.D ? disk.D.free + "G" : "-"), l: "磁盘可用 · 共 " + (disk.D ? disk.D.total + "G" : "-"), tab: "ov", card: "card-ov" },
      { c: "kpi-amber", i: ic("zap"), v: k.skills, l: "已装 Skills", tab: "cap", card: "card-skills" },
      { c: "kpi-blue", i: ic("messageSquare"), v: k.sessions, l: "近期会话", tab: "sess", card: "col-sess" },
      { c: "kpi-purple", i: ic("archive"), v: k.memory, l: "记忆库文件", tab: "ov", card: "card-ov" },
    ];
    document.getElementById("kpis").innerHTML = items.map(function (x) {
      return '<div class="kpi ' + x.c + '" onclick="goKPI(' + "'" + x.tab + "','" + x.card + "'" + ')" title="跳转到 ' + esc(x.l) + '"><div class="ki">' + x.i + '</div><div><div class="kv">' + x.v + '</div><div class="kl">' + x.l + "</div></div></div>";
    }).join("");
  }

  function renderQuick(d) {
    document.getElementById("quickbar").innerHTML = (d.quickActions || []).map(function (q) {
      return '<button class="qb" onclick="cmdtext(' + "'" + jsStr(q.cmd) + "'" + ')">' + q.icon + " " + esc(q.label) + "</button>";
    }).join("");
  }

  function renderOverview(d) {
    var a = d.aiDaily || {}, dn = d.dailyNews || {};
    var aCount = a.count || 0, dCount = dn.count || 0;
    var total = aCount + dCount;
    var aTime = String(a.fetchedAt || "").slice(11, 16) || "-";
    var dTime = String(dn.fetchedAt || "").slice(11, 16) || "-";
    var prompt = "帮我把今天工作台里的资讯划 3 条重点：AI 日报 " + aCount + " 条、每日新闻 " + dCount + " 条。请挑出 3 条对我（AI 工具重度玩家，正在搭建自媒体创作工具集与自动化工作流，关注开源项目和 AI 前沿动态）最值得关注的，每条用大白话说明：背景是什么；为什么重要；今天能动手试什么。";
    document.getElementById("overview").innerHTML =
      '<div class="ov-hero">' +
        '<div class="ov-hero-top"><div class="ov-ttl">今日速览</div>' +
        '<div class="ov-meta">共 ' + total + ' 条资讯 · 已加载 2 个网页来源</div></div>' +
        '<div class="ov-chips">' +
          '<span class="chip"><span class="ok">✓</span> AI 日报 · ' + aCount + ' 条 · ' + aTime + '</span>' +
          '<span class="chip"><span class="ok">✓</span> 每日新闻 · ' + dCount + ' 条 · ' + dTime + '</span>' +
          '<span class="chip"><span class="ok">✓</span> 技术热榜 · App 端实时</span>' +
        '</div>' +
        '<button class="btn-cy" onclick="aiAsk(' + "'" + jsStr(prompt) + "'" + ')">AI 帮你划 3 条重点</button>' +
      '</div>';
  }

  // 今日概览统计卡（bento 内：待做 / 速记 / 收藏 本机小数据，与 App 端口径一致）
  function renderOvCard(d) {
    var box = document.getElementById("ovStats");
    if (!box) return;
    var todos = todosLoad().filter(function (t) { return !t.done; }).length;
    var notes = notesLoad().length;
    var favs = favsLoad().length;
    box.innerHTML =
      '<div class="ov-metric"><span class="rk">✅ 待做</span><span class="rv">' + todos + '</span><span class="rn">条未完成</span></div>' +
      '<div class="ov-metric"><span class="rk">速记</span><span class="rv">' + notes + '</span><span class="rn">条记录</span></div>' +
      '<div class="ov-metric"><span class="rk">收藏</span><span class="rv">' + favs + '</span><span class="rn">条稍后读</span></div>';
  }

  // 今日建议：把工作台现状拼成 prompt 发给 AI 助手
  function inspireToday() {
    var d = getData() || {};
    var k = d.kpi || {};
    var cmd = "根据我的工作台现状生成今日建议：已装 " + (k.skills || 0) + " 个 skill，知识库 " + (k.knowledge || 0) +
      " 个文件，模型 " + (k.models || 0) + " 个（本机 " + (((d.status || {}).localModels || []).length) + "）。请给我：1-2 个今天可以动手的小任务点子；一条 AI agent 学习路径（结合我已装的 skill）；一个值得关注的 AI 趋势。";
    aiAsk(cmd);
  }
  window.inspireToday = inspireToday;

  // renderSkills/renderCap 见 js/views/cap.js


  // cronZh + renderOv 已剥到 js/views/ov.js

  // renderStats 已剥到 js/views/stats.js（renderActiveTab 通过 import 调用）

  // 会话档案(sess) 与 本周动态(week) 已剥到 js/views/sess.js 与 js/views/week.js

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
      '<button class="btn-sm" onclick="switchView(\'models\')">🧠 模型管理</button>' +
      '</div>' +
      '<div class="ai-bar">' +
      '<button class="btn-sm" onclick="aiClear()">清空对话</button>' +
      (hasKey ? "" : '<span class="ai-guide">⚠️ 还没设置 API Key，请到「模型管理」添加并激活一个模型。</span>') +
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
      '<button class="btn-sm" onclick="kbSaveChat()" title="把当前对话精华存进知识库">📥 存知识库</button></div>' +
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
    switchTab("ai");
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
      return '<div class="kb-mention-it' + (i === 0 ? " sel" : "") + '" data-i="' + i + '" onclick="__kbMentionPick(' + i + ')">📘 ' + (it.name) + '</div>';
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
        aiAppend("bot", "⚠️ " + err.message);
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

  // 课程表模块已拆到 schedule.js（独立 IIFE，window.WB.esc 依赖注入，加载顺序在 app.js 前）
  // 对外接口：window.renderSchedule / ghToken / scheduleLoad / schedulePullCloud / setGhToken / GH_REPO

  // 头部条（KPI/同步/快捷启动/本周动态）+ tab 内容拆分渲染：省 CPU、按需
  function renderHeaderStrip(d) {
    document.getElementById("snap").textContent = "快照 · " + (d.generatedAt || "-");
    renderSync(d);
    renderFreshness(d);
    renderKPI(d);
    renderOverview(d);
    renderOvCard(d);
    renderQuick(d);
  }
  function renderActiveTab(d) {
    if (!d) return;
    // 用 __view 路由（P0 后 DOM 已无 .tab 按钮，不能再依赖 .tab.active）
    var id = getView() || "cap";
    if (id === "cap") renderCap(d);
    else if (id === "ai") renderAI(d);
    else if (id === "models") renderModels();
    else if (id === "info") renderInfo(d);
    else if (id === "ov") renderOv(d);
    else if (id === "stats") renderStats(d);
    else if (id === "sess") renderSessArchive(d);
    else if (id === "week") renderWeekAll(d);
    else if (id === "kb") { if (typeof renderKb === "function") renderKb(); }
    // schedule 是纯 localStorage，启动时已渲染，无需数据
  }
  // ---------- 数据规范化（兜底缺字段，避免 data.json 部分缺失/损坏导致白屏） ----------
  function normalizeData(d) {
    d = d || {};
    d.kpi = d.kpi || {};
    d.status = d.status || {};
    d.status.disk = d.status.disk || {};
    d.skills = Array.isArray(d.skills) ? d.skills : [];
    d.sessions = d.sessions || {};
    d.sessions.recent = Array.isArray(d.sessions.recent) ? d.sessions.recent : [];
    d.sessions.heatmap = Array.isArray(d.sessions.heatmap) ? d.sessions.heatmap : [];
    d.aiDaily = d.aiDaily || {};
    d.aiDaily.sections = Array.isArray(d.aiDaily.sections) ? d.aiDaily.sections : [];
    d.aiDaily.history = Array.isArray(d.aiDaily.history) ? d.aiDaily.history : [];
    d.dailyNews = d.dailyNews || {};
    d.dailyNews.items = Array.isArray(d.dailyNews.items) ? d.dailyNews.items : [];
    d.dailyNews.history = Array.isArray(d.dailyNews.history) ? d.dailyNews.history : [];
    d.weekly = Array.isArray(d.weekly) ? d.weekly : [];
    d.guide = Array.isArray(d.guide) ? d.guide : [];
    d.quickActions = Array.isArray(d.quickActions) ? d.quickActions : [];
    d.knowledge = d.knowledge || {};
    d.knowledge.types = d.knowledge.types || {};
    d.knowledge.files = Array.isArray(d.knowledge.files) ? d.knowledge.files : [];
    return d;
  }
  // ---------- 今日复盘（主页聚焦模块：基于真实数据自动生成 + 本机手动复盘） ----------
  var REVIEW_KEY = "wb_review_" + (function () {
    var n = new Date();
    return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2);
  })();
  function reviewLoad() { try { return localStorage.getItem(REVIEW_KEY) || ""; } catch (e) { return ""; } }
  function saveReview() {
    var t = document.getElementById("reviewInput");
    var h = document.getElementById("reviewHint");
    if (!t) return;
    try { localStorage.setItem(REVIEW_KEY, t.value); if (h) h.textContent = "✓ 已保存（" + REVIEW_KEY.slice(10) + "）"; }
    catch (e) { if (h) h.textContent = "保存失败"; }
  }
  window.saveReview = saveReview;
  function renderTodayReview(d) {
    var done = document.getElementById("reviewDone");
    if (done) {
      var list = todosLoad();
      var dn = list.filter(function (t) { return t.done; }).length;
      var total = list.length;
      if (!total) {
        done.innerHTML = '<span class="empty">今日还没有待办，写一条吧～</span>';
      } else {
        var pct = Math.round(dn / total * 100);
        done.innerHTML =
          '<span style="color:var(--sub);font-size:13px">今日代办完成度</span>' +
          '<span class="review-done-badge">✓ ' + dn + ' / ' + total + '</span>' +
          '<span class="review-progress"><span class="review-progress-fill" style="width:' + pct + '%"></span></span>' +
          '<span style="font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums">' + pct + '%</span>';
      }
    }
    var sess = document.getElementById("revSessions");
    if (sess) {
      var rec = (d.sessions && d.sessions.recent) || [];
      sess.innerHTML = rec.length ? rec.slice(0, 3).map(function (s) {
        return "<li>" + esc(s.title || s.custom_title || "未命名会话") + "</li>";
      }).join("") : '<li class="empty">今天还没有会话记录</li>';
    }
    var txt = document.getElementById("reviewInput");
    if (txt) { var saved = reviewLoad(); if (saved) txt.value = saved; }
  }
  function render(d) {
    try {
      d = normalizeData(d);
      setData(d);
      renderHeaderStrip(d);
      renderActiveTab(d);
      renderTodayReview(d);
      if (!__inited) { __inited = true; switchView("home"); }
    } catch (err) {
      console.error("render 出错", err);
      var box = document.getElementById("col-cap");
      if (box && !box.innerHTML) {
        box.innerHTML = '<div class="card"><h2>⚠️ 渲染异常</h2><div class="empty">页面渲染遇到问题：' +
          esc(String((err && err.message) || err)) +
          '。其余内容已尽量保留，可点「立即刷新」重试。</div></div>';
      }
    }
  }

  // ---------- 侧边栏多视图切换（首页只留今日，其余模块侧边栏切换） ----------
  var __inited = false;
  function switchView(v) {
    setView(v);
    document.querySelectorAll(".side-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === v);
    });
    var titles = {
      home: ["今日", "WorkBuddy 本地面板 · 聚焦今日代办与复盘"],
      dash: ["仪表盘", "本机 Skills / 会话 / 收藏 / 入口总览"],
      cap: ["能力速达", "本机 Skills 速查与一键启动"],
      ai: ["AI 助手", "用大白话回答你的问题"],
      models: ["模型管理", "AI 平台与模型配置"],
      info: ["资讯", "AI 日报与每日新闻"],
      ov: ["系统状态", "本机运行环境与服务健康度"],
      stats: ["Skill 统计", "Skills 数量与分类分布"],
      sess: ["会话档案", "本机会话记录与活跃热力图"],
      week: ["本周动态", "近期变化与里程碑"],
      schedule: ["课程表", "本地课程表管理"],
      kb: ["知识库", "Obsidian vault 浏览 / 检索 / 双链 / 沉淀"]
    };
    var t = titles[v] || ["", ""];
    var h = document.getElementById("viewTitle"); if (h) h.textContent = t[0];
    var s = document.getElementById("viewSub"); if (s) s.textContent = t[1];
    // 统一容器体系：隐藏所有 .view，显示 #view-<v>（home/dash 与其余 10 个已收敛为同一套）
    document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
    var target = document.getElementById("view-" + v);
    if (target) target.classList.add("active");
    try { localStorage.setItem("wb_tab", v); } catch (e) {}
    if (getData()) renderActiveTab(getData());
  }
  window.switchView = switchView;

  // ---------- 同步健康度（数据新鲜度 + 失败/陈旧告警） ----------
  function renderFreshness(d) {
    var el = document.getElementById("freshness");
    if (!el) return;
    var st = (d && d.status) || {};
    var parts = [];
    var since = function (ds) {
      if (!ds) return "未知";
      var t = new Date(String(ds).slice(0, 10) + "T00:00:00").getTime();
      var days = Math.max(0, Math.round((Date.now() - t) / 86400000));
      if (days === 0) return "今天";
      if (days === 1) return "昨天";
      return days + " 天前";
    };
    if (st.skillsLastUpdate) parts.push("skills 数据 " + since(st.skillsLastUpdate));
    if (st.memoryLastUpdate) parts.push("记忆库 " + since(st.memoryLastUpdate));
    el.textContent = parts.length ? parts.join(" · ") + " · " : "";
  }
  function renderSync(d) {
    var el = document.getElementById("syncStatus");
    if (!el) return;
    var s = d.sync;
    if (!s || !s.lastRun) {
      el.className = "sync-status warn";
      el.textContent = "⚠️ 暂无同步记录，定时任务可能未运行";
      return;
    }
    var last = new Date(s.lastRun.replace(" ", "T"));
    var stale = (s.staleHours != null) ? s.staleHours : 2;
    var diffMs = Date.now() - last.getTime();
    var diffH = diffMs / 3600000;
    var hhmm = (last.getMonth() + 1) + "-" + last.getDate() + " " +
      ("0" + last.getHours()).slice(-2) + ":" + ("0" + last.getMinutes()).slice(-2);

    if (s.status === "fail" || diffH > stale) {
      el.className = "sync-status warn";
      var overdue = diffH > 0 ? "，已超时约 " + (diffH >= 1 ? diffH.toFixed(1) + " 小时" : Math.round(diffMs / 60000) + " 分钟") : "";
      el.textContent = "⚠️ 同步可能已停止（上次 " + hhmm + overdue + "）· 定时任务或网络异常";
    } else {
      el.className = "sync-status ok";
      var next = s.nextRun ? new Date(s.nextRun.replace(" ", "T")) : null;
      var nextStr = next ? (" · 下次约 " + ("0" + next.getHours()).slice(-2) + ":" + ("0" + next.getMinutes()).slice(-2)) : "";
      el.textContent = "✅ 同步正常（上次 " + hhmm + nextStr + "）";
    }
  }

  // ---------- 启动 ----------
  var __lastGen = "";
  var __lastMod = "";
  // 带超时的 fetch：防止网络挂起导致页面一直"加载中"像冻住
  function fetchT(url, opts, ms) {
    ms = ms || 15000;
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, o).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }
  function loadData() {
    return fetchT("data.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (r.ok) __lastMod = r.headers.get("Last-Modified") || ""; return r.json(); })
      .then(function (d) { render(d); __lastGen = d.generatedAt || ""; return d; });
  }
  // 数据变化时自动重渲染（覆盖自动/手动同步），免去手动刷新浏览器
  // HEAD 优先：先取文件头对比 Last-Modified，没变就跳过正文下载，省 99% 流量
  function maybeReload() {
    // 加 cache-buster 穿透 GitHub Pages 边缘缓存，确保拿到最新 Last-Modified（否则旧缓存让误判"没变"→ 顶部同步状态卡在旧快照）
    return fetchT("data.json?t=" + Date.now(), { method: "HEAD", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) return false;
        var lm = r.headers.get("Last-Modified") || "";
        if (lm && lm === __lastMod) return false;
        return fetchT("data.json?t=" + Date.now(), { cache: "no-store" })
          .then(function (rr) { return rr.json(); })
          .then(function (d) {
            d = normalizeData(d);
            setData(d);
            renderHeaderStrip(d);
            renderActiveTab(d);
            __lastGen = d.generatedAt || "";
            __lastMod = lm;
            return true;
          });
      })
      .catch(function () { return false; });
  }
  // ---------- 立即刷新：路线 A（本地）触发本机 local_refresh.py ----------
  // 保留下方 GitHub Actions 相关函数（pollUntilSynced 等），供路线 B（云同步）启用
  function refreshData() {
    var btn = document.getElementById("refreshBtn");
    var old = btn ? btn.textContent : "同步数据";
    if (btn) { btn.disabled = true; btn.textContent = "⏳ 本机刷新中…"; }
    WB.dialog.toast("已开始同步（后台跑约 5–30 秒）", "info", 1800);
    fetchT("/api/refresh", { method: "POST" }, 8000).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      if (btn) btn.textContent = "⏳ 抓取资讯与数据…";
      // 看看 server 是否告知「已在跑」：200 OK 但 running=true 表示这是重复点击，复用已有任务
      try {
        r.clone().json().then(function (j) {
          if (j && j.running) WB.dialog.toast("刷新任务正在执行中，请稍候", "info", 2200);
        });
      } catch (e) {}
      localReloadWait(btn, old, 0);
    }).catch(function () {
      // 本地刷新服务不可达（静态服务器 / file:// 打开）：退化为重读磁盘上的数据
      if (btn) { btn.disabled = false; btn.textContent = old; }
      loadData().then(function () {
        WB.dialog.toast("⚠️ 当前打开方式不支持触发刷新（需用 server.py 启动工作台）。\n已重新加载磁盘上的最新数据；计划任务每小时会自动刷新。", "warn", 4500);
      }).catch(function () {
        WB.dialog.toast("刷新失败：无法访问 data.json。", "err", 3500);
      });
    });
  }
  // 轮询本地数据直到 generatedAt 变化（本地刷新全程约 5-30 秒）
  // 优化：第 1 次 2s 后立刻查（让"开始"反馈更明确）；之后按 5s 节流
  function localReloadWait(btn, old, tries) {
    var MAX = 12; // 12 × 5s = 1 分钟
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.toast("数据可能没变化（已轮询 1 分钟）。下次每小时自动任务或再点一次试试。", "warn", 4000);
      loadData().catch(function () {});
      return;
    }
    if (btn) btn.textContent = "⏳ 等待新数据 (" + (tries + 1) + "/" + MAX + ")";
    setTimeout(function () {
      maybeReload().then(function (reloaded) {
        if (reloaded) {
          if (btn) { btn.disabled = false; btn.textContent = old; }
          WB.dialog.toast("✅ 同步完成，数据已更新", "ok", 2400);
        }
        else localReloadWait(btn, old, tries + 1);
      });
    }, tries === 0 ? 2000 : 5000);
  }

  // 轮询本次触发的运行，完成后等 Pages 重新部署再刷新页面
  function pollUntilSynced(btn, old, tries, afterTs) {
    var MAX = 24; // 24 × 10s ≈ 4 分钟
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.alert("同步任务已提交，但本机 Runner 似乎没在运行（任务一直排队）。\n请确认本机 Runner 进程已启动，或稍后手动刷新浏览器。");
      loadData().catch(function () {});
      return;
    }
    var runsApi = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/runs?per_page=10";
    fetch(runsApi, {
      headers: {
        "Authorization": "Bearer " + ghToken(),
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then(function (r) { return r.json(); }).then(function (j) {
      // 取 created_at >= afterTs 的最新一次运行
      var runs = (j.workflow_runs || []).filter(function (x) {
        return new Date(x.created_at).getTime() >= afterTs;
      }).sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      var run = runs[0] || null;
      if (run && run.status === "completed") {
        if (run.conclusion === "success") {
          if (btn) btn.textContent = "✅ 同步完成，刷新中…";
          tightReload(btn, old, 0);
        } else {
          if (btn) { btn.disabled = false; btn.textContent = old; }
          WB.dialog.alert("本次同步运行失败（" + (run.conclusion || "unknown") + "），请到 GitHub Actions 看日志。");
          loadData().catch(function () {});
        }
      } else if (run && (run.status === "in_progress" || run.status === "queued" || run.status === "waiting")) {
        if (btn) btn.textContent = "本机 Runner 执行中… (" + (tries + 1) + "/" + MAX + ")";
        setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
      } else {
        // 列表里还没出现本次触发，继续等
        setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
      }
    }).catch(function () {
      setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
    });
  }
  // 同步完成后紧轮询：每 10s 看一次数据，直到 generatedAt 变化（新数据已上线）再复位按钮
  function tightReload(btn, old, tries) {
    if (tries >= 30) { // 30 × 10s ≈ 5 分钟，给 GitHub Pages 部署留足时间
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.alert("本机同步已完成，但 GitHub Pages 上线略有延迟。\n页面会在后台继续检测，30 秒内若数据上线会自动刷新；也可稍后手动刷新浏览器。");
      return;
    }
    if (btn) btn.textContent = "✅ 同步完成，刷新中… (" + (tries + 1) + "/30)";
    maybeReload().then(function (reloaded) {
      if (reloaded) { if (btn) { btn.disabled = false; btn.textContent = old; } }
      else setTimeout(function () { tightReload(btn, old, tries + 1); }, 10000);
    });
  }
  window.refreshData = refreshData;

  // ---------- 功能自检：一键验证「触发 → 同步 → 自动刷新」全链路 ----------
  function setSelfCheck(cls, msg) {
    var box = document.getElementById("selfCheckResult");
    if (!box) return;
    box.className = "selfcheck" + (cls ? " " + cls : "");
    box.style.display = "block";
    box.textContent = msg;
  }
  function selfCheck() {
    var btn = document.getElementById("selfCheckBtn");
    var token = ghToken();
    if (!token) {
      setSelfCheck("warn", "⚠️ 需先填 GitHub Token（点「🌙」旁的 或首次点「立即刷新」会提示）");
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = "🔍 自检中…"; }
    setSelfCheck("run", "步骤 1/4 · 正在触发同步…");

    var api = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/dispatches";
    var afterTs = Date.now() - 3000;
    fetch(api, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ ref: "main" })
    }).then(function (r) {
      if (r.ok) return;
      if (r.status === 401 || r.status === 403) throw new Error("Token 无效或权限不足（HTTP " + r.status + "）");
      if (r.status === 404) throw new Error("找不到同步工作流（404）");
      throw new Error("触发失败：HTTP " + r.status);
    }).then(function () {
      pollSelfCheck(btn, afterTs, 0);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "❌ 自检中断：" + err.message);
    });
  }
  function pollSelfCheck(btn, afterTs, tries) {
    var MAX = 24;
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "❌ 超时：本机 Runner 一直没响应，请确认 Runner 服务在运行");
      return;
    }
    var runsApi = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/runs?per_page=10";
    fetch(runsApi, {
      headers: {
        "Authorization": "Bearer " + ghToken(),
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then(function (r) { return r.json(); }).then(function (j) {
      var runs = (j.workflow_runs || []).filter(function (x) {
        return new Date(x.created_at).getTime() >= afterTs;
      }).sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      var run = runs[0] || null;
      if (run && run.status === "completed") {
        if (run.conclusion === "success") {
          setSelfCheck("run", "步骤 3/4 · 同步成功 (run " + run.id + ")，等待数据上线…");
          tightReloadSelfCheck(btn, 0);
        } else {
          if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
          setSelfCheck("warn", "❌ 同步运行失败（" + (run.conclusion || "unknown") + "），请到 GitHub Actions 看日志");
        }
      } else if (run && (run.status === "in_progress" || run.status === "queued" || run.status === "waiting")) {
        setSelfCheck("run", "步骤 2/4 · Runner 执行中（" + run.status + "）…");
        setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
      } else {
        setSelfCheck("run", "步骤 2/4 · 等待 Runner 接收任务…");
        setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
      }
    }).catch(function () {
      setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
    });
  }
  function tightReloadSelfCheck(btn, tries) {
    if (tries >= 30) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "⚠️ 同步已完成，但数据上线略有延迟，页面会在后台自动刷新");
      return;
    }
    maybeReload().then(function (reloaded) {
      if (reloaded) {
        if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
        setSelfCheck("ok", "✅ 自检通过：触发 → 同步 → 自动刷新 全链路正常");
      } else {
        setTimeout(function () { tightReloadSelfCheck(btn, tries + 1); }, 10000);
      }
    });
  }
  // ---------- 常用入口（纯前端，本机 localStorage 存，不依赖 data.json） ----------
  var LINKS_KEY = "wb_links";
  var DEFAULT_LINKS = [
    {"label": "GitHub", "url": "https://github.com"},
    {"label": "哔哩哔哩", "url": "https://www.bilibili.com"},
    {"label": "小宇宙播客", "url": "https://www.xiaoyuzhoufm.com"},
    {"label": "飞书", "url": "https://www.feishu.cn"},
    {"label": "WorkBuddy 文档", "url": "https://www.workbuddy.cn/docs/"},
    {"label": "AI 日报源", "url": "https://aihot.virxact.com/daily"},
    {"label": "每日新闻源", "url": "https://github.com/vikiboss/60s"}
  ];
  function getLinks() {
    try { var v = localStorage.getItem(LINKS_KEY); if (v) return JSON.parse(v); } catch (e) {}
    return DEFAULT_LINKS.slice();
  }
  function saveLinks(a) { try { localStorage.setItem(LINKS_KEY, JSON.stringify(a)); } catch (e) {} }
  function renderLinks() {
    var g = document.getElementById("linksGrid");
    if (!g) return;
    var links = getLinks();
    if (!links.length) { g.innerHTML = '<div class="empty">还没有入口，点“加一个”添加常用链接</div>'; return; }
    g.innerHTML = links.map(function (l, i) {
      return '<a class="link-item" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
        '<span class="li-ic"></span><span class="li-label">' + esc(l.label) + '</span>' +
        '<span class="li-del" data-i="' + i + '" title="删除">✕</span></a>';
    }).join("");
    Array.prototype.forEach.call(g.querySelectorAll(".li-del"), function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        delLink(parseInt(b.getAttribute("data-i"), 10));
      });
    });
  }
  function addLink() {
    WB.dialog.prompt("入口名称", "", function (label) {
      if (!label) return;
      label = label.trim();
      if (!label) return;
      WB.dialog.prompt("链接地址", "https://", function (url) {
        if (url === null) return;
        url = (url || "").trim();
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        var links = getLinks(); links.push({ label: label, url: url }); saveLinks(links); renderLinks();
        var h = document.getElementById("linksHint"); if (h) h.textContent = "✓ 已添加（仅存本浏览器）";
      }, null, "以 http 开头，可留空自动补 https://");
    }, null, "如：抖音");
  }
  function delLink(i) {
    var links = getLinks(); if (i < 0 || i >= links.length) return;
    links.splice(i, 1); saveLinks(links); renderLinks();
  }

  // ---------- 一键导出（速记/待办/收藏/入口 → Markdown） ----------
  // ---------- 今日概览（KPI + 头条 + 引导 → 一键发给 AI 助手） ----------
  function copyToday() {
    var d = getData();
    if (!d) { aiAsk("今日数据还没加载完，请稍等几秒再点。"); return; }
    var lines = [];
    var k = d.kpi || {};
    lines.push("今天是 " + (d.generatedAt ? String(d.generatedAt).slice(0, 10) : "") + "，我的工作台现状：");
    lines.push("- 已装 " + (k.skills || 0) + " 个 skills，知识库 " + (k.knowledge || 0) + " 个文件，定时任务 " + (k.automations || 0) + " 个，记忆库 " + (k.memory || 0) + " 个文件");
    var disk = (d.status && d.status.disk) || {};
    if (disk.D) lines.push("- D 盘可用 " + disk.D.free + "G（共 " + disk.D.total + "G）");
    var news = (d.dailyNews && d.dailyNews.items) || [];
    if (news.length) {
      lines.push("- 今日新闻 Top3：");
      news.slice(0, 3).forEach(function (n, i) { lines.push((i + 1) + ". " + n.title); });
    }
    var ai = (d.aiDaily && d.aiDaily.count) || 0;
    if (ai) lines.push("- AI 日报已抓取 " + ai + " 条");
    var guide = d.guide || [];
    if (guide.length) {
      lines.push("- 今日引导：" + guide.slice(0, 2).join("；"));
    }
    lines.push("");
    lines.push("请基于以上信息，给我今天最值得做的 3 件事（结合我的 skill 和知识库）。");
    aiAsk(lines.join("\n"));
  }
  function exportAll() {
    var now = new Date();
    var p2 = function (n) { return ("0" + n).slice(-2); };
    var ds = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate());
    var lines = ["# 个人工作台导出 · " + ds, ""];
    var todos = todosLoad();
    if (todos.length) {
      lines.push("## 待办清单（" + todos.filter(function (t) { return t.done; }).length + "/" + todos.length + "）");
      todos.forEach(function (t) { lines.push("- [" + (t.done ? "x" : " ") + "] " + t.text); });
      lines.push("");
    }
    var notes = notesLoad();
    if (notes.length) {
      lines.push("## 我的速记");
      notes.forEach(function (n) { lines.push("- " + n.text); });
      lines.push("");
    }
    var favs = favsLoad();
    if (favs.length) {
      lines.push("## 我的收藏（稍后读）");
      favs.forEach(function (f) { lines.push("- [" + f.title + "](" + (f.url || "") + ")" + (f.source ? " · " + f.source : "")); });
      lines.push("");
    }
    var links = getLinks();
    if (links.length) {
      lines.push("## 常用入口");
      links.forEach(function (l) { lines.push("- [" + l.label + "](" + l.url + ")"); });
      lines.push("");
    }
    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "工作台导出_" + ds + ".md";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- 数据备份 / 恢复（JSON，可完整还原） ----------
  function backupExport() {
    var data = { notes: notesLoad(), todos: todosLoad(), favs: favsLoad(), links: getLinks() };
    var payload = { app: "lite_workbench_web", version: 1, exportedAt: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var p2 = function (n) { return ("0" + n).slice(-2); };
    var d = new Date();
    a.download = "工作台备份_" + d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function doImportBackup(m) {
    if (!m || !m.data || typeof m.data !== "object") { WB.dialog.alert("不是有效的工作台备份文件"); return; }
    WB.dialog.confirm("导入将用备份覆盖当前的 速记 / 待办 / 收藏 / 常用入口。\n确定继续吗？（建议先点“备份”存一份当前数据）", function () {
      var d = m.data;
      if (d.notes) notesSave(d.notes);
      if (d.todos) todosSave(d.todos);
      if (d.favs) favsSave(d.favs);
      if (d.links) saveLinks(d.links);
      renderNotes(); renderTodos(); renderFavs(); renderLinks();
      WB.dialog.alert("✓ 已恢复备份（速记 / 待办 / 收藏 / 常用入口）");
    });
  }
  function backupImportFromFile(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (e) {
      try { doImportBackup(JSON.parse(String(e.target.result))); }
      catch (err) { WB.dialog.alert("备份文件解析失败：" + err.message); }
    };
    r.onerror = function () { WB.dialog.alert("读取文件失败"); };
    r.readAsText(f, "utf-8");
    input.value = "";
  }
  function backupImport() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () { backupImportFromFile(inp); };
    inp.click();
  }
  window.backupExport = backupExport; window.backupImport = backupImport;

  // ---------- 头部实时时钟 ----------
  function updateClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    var now = new Date();
    var wd = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    var p2 = function (n) { return ("0" + n).slice(-2); };
    el.textContent = "🕐 " + (now.getMonth() + 1) + "-" + p2(now.getDate()) + " 周" + wd + " " + p2(now.getHours()) + ":" + p2(now.getMinutes()) + ":" + p2(now.getSeconds());
  }
  window.exportAll = exportAll; window.updateClock = updateClock; window.copyToday = copyToday; window.backupExport = backupExport; window.backupImport = backupImport;
  window.addLink = addLink; window.delLink = delLink; window.renderLinks = renderLinks;

  window.selfCheck = selfCheck;
  applyTheme();
  renderNotes();
  renderSchedule();
  renderLinks();
  renderTodos();
  renderFavs();
  updateClock();
  setInterval(updateClock, 1000);
  pomoRender();
  // 本地无课程表时，自动从云端拉取一次（换设备也能看到）
  if (!scheduleLoad().length) schedulePullCloud(true);
  var ni = document.getElementById("noteInput");
  if (ni) ni.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } });
  var ti = document.getElementById("todoInput");
  if (ti) ti.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); } });
  loadData().catch(function (e) {
    document.getElementById("col-cap").innerHTML = '<div class="card"><h2>⚠️ 数据加载失败</h2><div class="empty">无法读取 data.json：' + esc(e) + "。10 秒后自动重试。</div></div>";
    // 网络抖动恢复：10 秒后自动重试一次
    setTimeout(function () { loadData().catch(function () {}); }, 10000);
  });
  // 恢复上次停留的标签页
  var lastTab = "";
  try { lastTab = localStorage.getItem("wb_tab") || ""; } catch (e) {}
  if (lastTab === "news" || lastTab === "dnews") lastTab = "info"; // 资讯 Tab 合并兼容
  if (lastTab && lastTab !== "cap") switchView(lastTab);

  // 后台自动刷新：每 30s 检测数据是否更新，有变化就自动重渲染（覆盖每小时自动同步）
  // 页面不可见（切后台标签页）时暂停轮询省流量/电量，回到前台立即补查一次
  var pollTimer = setInterval(maybeReload, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    } else {
      if (!pollTimer) pollTimer = setInterval(maybeReload, 30000);
      maybeReload();
    }
  });

  // 全局键盘增强：按 / 聚焦搜索（不在输入框时）；按 Esc 关闭热力图弹窗
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var hm = document.getElementById("heat-detail");
      if (hm && hm.style.display === "flex") { closeHeat(); return; }
    }
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) {
      var q = document.getElementById("q");
      if (q) { e.preventDefault(); q.focus(); q.select(); }
    }
  });

  // 离线提示：断网时顶部出现提示条，恢复后自动消失（复用已有 Service Worker 离线缓存能力）
  var offlineEl = null;
  function showOffline(on) {
    if (on && !offlineEl) {
      offlineEl = document.createElement("div");
      offlineEl.className = "offline-bar";
      offlineEl.textContent = "当前离线 · 正在显示已缓存的数据";
      var hd = document.querySelector(".header");
      if (hd && hd.parentNode) hd.parentNode.insertBefore(offlineEl, hd);
    } else if (!on && offlineEl) {
      if (offlineEl.parentNode) offlineEl.parentNode.removeChild(offlineEl);
      offlineEl = null;
    }
  }
  window.addEventListener("offline", function () { showOffline(true); });
  window.addEventListener("online", function () { showOffline(false); });
  if (!navigator.onLine) showOffline(true);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ---------- PWA 安装引导（Android/Chrome 一键装，iOS 给说明） ----------
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installEvt = e;
    var b = document.getElementById("installBtn");
    if (b) b.style.display = "";
  });
  window.addEventListener("appinstalled", function () {
    installEvt = null;
    var b = document.getElementById("installBtn");
    if (b) b.style.display = "none";
  });
  window.promptInstall = function () {
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      WB.dialog.alert("iPhone / iPad 安装方法：点浏览器底部「分享」按钮 → 「添加到主屏幕」，之后就能像 App 一样从桌面打开。");
      return;
    }
    if (!installEvt) {
      WB.dialog.alert("当前浏览器不支持一键安装。可以打开浏览器菜单 →「添加到主屏幕 / 安装应用」，效果一样。");
      return;
    }
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; });
  };
