// 视图：资讯（七个资讯源，均支持历史日份切换）。从 app.js 剥出，行为不变。
// 源与源之间的差异（键名/文案/图标/提问语/空态…）全在 js/core/feeds.js 的 FEEDS 表里，
// 本文件只负责一套渲染骨架：源标题条 → 历史下拉 → 正文（分节 or 条目列表）。
// isFav 来自 favs feature；favToggle/aiAsk/cmdtext 经 window 桥接（内联 onclick）。
// toggleNS/toggleSource/toggleNews/feedDateChanged/feedAsk/newsExplain 挂 window 供内联 onclick。
import { esc, escAttr, jsStr, ic } from "../core/util.js";
import { isFav } from "../features/favs.js";
import { mountInfoSearch } from "../features/infosearch.js";
import { FEEDS, feedById } from "../core/feeds.js";

// 源级折叠状态记忆（照 recall.js 的 map + try/catch 兜底）：{ news:true, dnews:false, ... }
var COLLAPSE_KEY = "wb_info_collapsed";
function _collapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function _saveCollapsed(m) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(m)); } catch (e) { /* 忽略配额/隐私模式 */ }
}
// 生成裸放的源标题条（复用 .ns-h/.ns-car，与 AI 日报内部 section 折叠同款视觉）
function sourceHead(key, label, count, unit, iconName) {
  var closed = _collapsed()[key] === true;
  return '<div class="ns-h source-h' + (closed ? " closed" : "") + '" data-src="' + key +
    '" onclick="toggleSource(this)" tabindex="0">' +
    (iconName ? '<span class="ic">' + ic(iconName) + '</span>' : "") + esc(label) +
    '<span class="news-n">' + (count || 0) + ' ' + esc(unit) + '</span>' +
    '<span class="ns-car">' + (closed ? "▸" : "▾") + '</span></div>';
}
// 折叠体开标签（按记忆的折叠态决定初始 display）
function nsBodyOpen(key) {
  return '<div class="ns-b"' + (_collapsed()[key] === true ? ' style="display:none"' : '') + '>';
}

function toggleNS(h) {
  var b = h.nextElementSibling;
  if (!b) return;
  var open = b.style.display !== "none";
  b.style.display = open ? "none" : "";
  h.classList.toggle("closed", open);
  var car = h.querySelector(".ns-car");
  if (car) car.textContent = open ? "▸" : "▾";
}

// 源级折叠：复用 toggleNS 逻辑（折 nextElementSibling=.ns-b），额外把状态写进 localStorage
function toggleSource(h) {
  var b = h.nextElementSibling;
  if (!b) return;
  var open = b.style.display !== "none";
  b.style.display = open ? "none" : "";
  h.classList.toggle("closed", open);
  var car = h.querySelector(".ns-car");
  if (car) car.textContent = open ? "▸" : "▾";
  var key = h.getAttribute("data-src");
  if (key) {
    var m = _collapsed();
    if (open) m[key] = true; else delete m[key];  // 只存"折叠"，展开=删键，map 保持精简
    _saveCollapsed(m);
  }
}

function toggleNews(btn) {
  var d = btn.previousElementSibling;
  if (!d || !d.classList.contains("nw-d")) return;
  var open = d.classList.toggle("open");
  btn.textContent = open ? "收起 ▴" : "展开 ▾";
}

// 单条新闻卡片渲染（七个源共用，避免多份重复 HTML）
function renderNewsItem(it, opt) {
  opt = opt || {};
  var prefix = opt.prefix || "";
  var askText = opt.ask || "用大白话展开讲讲这条新闻的背景和影响，并说说对我有什么用：";
  var link = it.url
    ? '<a class="nw-a" href="' + escAttr(it.url) + '" target="_blank" rel="noopener">原文 ↗</a>' : "";
  var src = it.source
    ? '<span class="nw-s">' + esc(it.source) + "</span>"
    : (opt.defaultSrc ? '<span class="nw-s">' + esc(opt.defaultSrc) + "</span>" : "");
  // 摘要优先用 enrich 生成的 aiSummary（统一质量），回退各源原始 summary
  var sum = it.aiSummary || it.summary || "";
  var dHtml = "";
  if (opt.showSummary && sum) {
    var long = sum.length > 90;
    dHtml = '<div class="nw-d' + (long ? " clamp" : "") + '">' + esc(sum) + "</div>" +
      (long ? '<button class="nw-toggle" onclick="toggleNews(this)">展开 ▾</button>' : "");
  }
  // AI 标签（点击→按标签过滤，见 infosearch.js）；无标签则不渲染
  var tags = Array.isArray(it.aiTags) ? it.aiTags : [];
  var tagsHtml = tags.length
    ? '<div class="nw-tags">' + tags.map(function (t) {
        return '<span class="kb-tag" onclick="infoTag(' + "'" + jsStr(t) + "'" + ')">' + esc(t) + "</span>";
      }).join("") + "</div>"
    : "";
  var on = isFav(it.url);
  var fav = '<button class="fav-btn' + (on ? " on" : "") + '" onclick="favToggle(this,' + "'" + jsStr(it.title) + "','" + jsStr(it.url) + "','" + jsStr(it.source || "") + "'" + ')">' + (on ? "★" : "☆") + '</button>';
  // 讲讲：带全上下文 {标题+摘要+链接+来源}（data-*，修「只带标题」），点开 → 右侧副驾开讲
  var askBtn = '<button class="nw-ask" onclick="newsExplain(this)"' +
    ' data-t="' + escAttr(it.title || "") + '"' +
    ' data-s="' + escAttr(sum) + '"' +
    ' data-u="' + escAttr(it.url || "") + '"' +
    ' data-src="' + escAttr(it.source || opt.defaultSrc || "") + '"' +
    ' data-ask="' + escAttr(askText) + '">让 AI 讲讲</button>';
  return '<div class="nw"><div class="nw-t">' + prefix + esc(it.title) + "</div>" +
    dHtml + tagsHtml +
    '<div class="nw-f">' + src + link + fav + askBtn +
    "</div></div>";
}

// 单条卡片渲染的对外入口（供 infosearch 检索结果面板复用同款卡片，含摘要/标签/收藏/讲讲）
export function renderCard(it, opt) {
  return renderNewsItem(it, Object.assign({ showSummary: true }, opt || {}));
}

// ---------- 渲染骨架：七个资讯源共用一套，差异全部来自 FEEDS 表 ----------
var _data = null;      // 最近一次渲染用的整份 data
var _curDate = {};     // { <id>: 当前选中的日份 } —— 供顶部「提炼/存库」取当日数据

// 正文抬头：日期 + 源名 + 计数 + 数据源/抓取时间/外链；每日60秒额外有封面与「一言」
function feedHead(day, a, spec) {
  var cover = spec.cover ? (day.cover || a.cover || "") : "";
  var tip = spec.tip ? (day.tip || "") : "";
  return '<div class="card news-head">' +
    (cover ? '<div class="dnews-cover" style="display:none"><img src="' + escAttr(cover) + '" alt="每日新闻封面" loading="lazy" referrerpolicy="no-referrer" onload="if(this.naturalWidth)this.parentNode.style.display=\'block\'" onerror="this.parentNode.style.display=\'none\'"></div>' : "") +
    '<h2>' + esc(day.date || "") + ' ' + esc(spec.label) +
    '<span class="news-n">' + (day.count || 0) + ' ' + esc(spec.unit) + '</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || spec.fallbackSource) +
    ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">' + esc(spec.linkText) + '</a>' : "") +
    "</div>" +
    (tip ? '<div style="margin-top:8px;color:var(--sub);font-style:italic;line-height:1.5">' + esc(tip) + "</div>" : "") +
    "</div>";
}

// 顶部动作卡（只有带 actions 的源有：AI 日报、每日新闻）
function feedActions(spec) {
  return '<div class="card"><h2><span class="ic">' + ic("compass") + '</span>' + esc(spec.actions.title) + "</h2>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" onclick="feedAsk(' + "'" + jsStr(spec.id) + "','refine'" + ')">' + esc(spec.actions.refine) + "</button>" +
    '<button class="btn-sm" onclick="feedAsk(' + "'" + jsStr(spec.id) + "','archive'" + ')">' + esc(spec.actions.archive) + "</button>" +
    "</div></div>";
}

// 没数据时的提示卡；部分源给一个「让 AI 现在抓一次」按钮
function feedEmpty(spec) {
  return '<div class="card"><h2><span class="ic">' + ic(spec.icon) + '</span>' + esc(spec.label) + "</h2>" +
    '<div class="empty">' + spec.empty.text + "</div>" +   // 本仓字面量（含 <code>），不转义
    (spec.empty.cmd
      ? '<div style="margin-top:10px"><button class="btn" onclick="cmdtext(' + "'" + jsStr(spec.empty.cmd) + "'" + ')">让 AI 现在抓一次</button></div>'
      : "") +
    "</div>";
}

// 分节正文（AI 日报：每节一张可折叠的卡）
function feedSections(secs, spec) {
  var html = "";
  secs.forEach(function (s) {
    html += '<div class="card news-sec"><div class="ns-h" onclick="toggleNS(this)">' + esc(s.label) +
      '<span class="news-n">' + (s.items || []).length + '</span><span class="ns-car">▾</span></div><div class="ns-b">';
    (s.items || []).forEach(function (it) {
      html += renderNewsItem(it, { showSummary: spec.summary, ask: spec.ask });
    });
    html += "</div></div>";
  });
  return html;
}

// 条目正文（其余六源：一张卡 + 网格）
function feedItems(items, spec) {
  var html = '<div class="card"><h2><span class="ic">' + ic(spec.cardIcon) + '</span>' + esc(spec.cardTitle) +
    '</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: spec.numbered
        ? '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>"
        : "",
      defaultSrc: spec.defaultSrc,
      showSummary: spec.summary,
      ask: spec.ask,
    });
  });
  return html + "</div></div>";
}

// 正文：按选中日份取那一份数据（history 里找不到就回落到当日）
function renderFeedBody(spec, date) {
  var box = document.getElementById(spec.id + "Body");
  if (!box || !_data) return;
  var a = _data[spec.key] || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  _curDate[spec.id] = date;
  var list = (spec.kind === "sections" ? day.sections : day.items) || [];
  if (!list.length) { box.innerHTML = feedEmpty(spec); return; }
  box.innerHTML = feedHead(day, a, spec) + (spec.actions ? feedActions(spec) : "") +
    (spec.kind === "sections" ? feedSections(list, spec) : feedItems(list, spec));
}

// 一个资讯源：源标题条（可折叠、状态记忆）+ 历史日份下拉 + 正文容器
function renderFeed(d, spec) {
  var box = document.getElementById(spec.id + "Block");
  if (!box) return;
  var a = d[spec.key] || {};
  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {  // 只有一天就没必要给下拉
    selHtml = '<div class="news-sel">' + esc(spec.histLabel) + "：" +
      '<select id="' + spec.id + 'Sel" onchange="feedDateChanged(' + "'" + jsStr(spec.id) + "'" + ')">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + ">" +
          esc(h.date) + " (" + (h.count || 0) + " " + esc(spec.unit) + ")</option>";
      }).join("") + "</select></div>";
  }
  box.innerHTML = sourceHead(spec.id, spec.label, a.count, spec.unit, spec.icon) +
    nsBodyOpen(spec.id) + selHtml + '<div id="' + spec.id + 'Body"></div></div>';
  renderFeedBody(spec, curDate);
}

function feedDateChanged(id) {
  var spec = feedById(id);
  var sel = document.getElementById(id + "Sel");
  if (spec && sel) renderFeedBody(spec, sel.value);
}

// 资讯 Tab：顶部检索条 + 逐个资讯源
export function renderInfo(d) {
  _data = d;
  mountInfoSearch(d, renderCard);  // 顶部搜索/筛选条 + 语义检索（叠加式面板）
  FEEDS.forEach(function (spec) { renderFeed(d, spec); });
}

// ---------- 「让 AI 讲讲」/顶部动作 → 右侧 AI 副驾 dock（取代原跳转到 AI 助手整页视图） ----------
// 每卡讲讲：带全上下文 {标题+摘要+链接+来源}；有链接则让 agent 先 WebFetch 原文再讲（深挖）。
function newsExplain(btn) {
  var t = btn.getAttribute("data-t") || "";
  var s = btn.getAttribute("data-s") || "";
  var u = btn.getAttribute("data-u") || "";
  var src = btn.getAttribute("data-src") || "";
  var ask = btn.getAttribute("data-ask") || "用大白话讲讲这条：";
  var p = ask + (u ? "\n先用 WebFetch 抓取下面链接的原文拿到全文，再讲。" : "") +
    "\n\n标题：" + t + (s ? "\n摘要：" + s : "") + (u ? "\n原文：" + u : "") + (src ? "\n来源：" + src : "");
  if (typeof window.dockAsk === "function") window.dockAsk(p, { agent: true, autoSend: true });
  else if (typeof window.aiAsk === "function") window.aiAsk(p, true);
}

function _digestSections(secs, max) {
  var out = [], n = 0;
  (secs || []).forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      if (max && n >= max) return;
      out.push("- " + (it.title || "") + (it.summary ? "：" + String(it.summary).slice(0, 90) : ""));
      n++;
    });
  });
  return out.join("\n");
}
function _digestItems(items, max) {
  var out = [];
  (items || []).forEach(function (it, i) {
    if (max && i >= max) return;
    out.push("- " + (it.title || "") + (it.summary ? "：" + String(it.summary).slice(0, 90) : ""));
  });
  return out.join("\n");
}

// 顶部「提炼要点 / 存进知识库」：把**当前选中日份**的 digest 内嵌进 prompt。
// 此前 digest 是渲染时写进模块变量的副作用，切了日期或没渲染过就会带错/带空数据。
function feedAsk(id, action) {
  var spec = feedById(id);
  if (!spec || !spec.actions || !_data) return;
  var a = _data[spec.key] || {};
  var date = _curDate[id] || a.date || "";
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var digest = spec.kind === "sections" ? _digestSections(day.sections, 40) : _digestItems(day.items, 40);
  if (!digest) { if (typeof window.dockOpen === "function") window.dockOpen(); return; }  // 无数据只开 dock
  var tmpl = action === "refine" ? spec.actions.refinePrompt : spec.actions.archivePrompt;
  if (!tmpl) return;
  var p = tmpl.replace("{n}", day.count || 0) + "\n\n" + digest;
  if (typeof window.dockAsk === "function") window.dockAsk(p, { agent: true, autoSend: true });
}

window.newsExplain = newsExplain;
window.feedAsk = feedAsk;
window.toggleNS = toggleNS;
window.toggleSource = toggleSource;
window.toggleNews = toggleNews;
window.feedDateChanged = feedDateChanged;
