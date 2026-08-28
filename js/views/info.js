// 视图：资讯（AI 日报 + 每日新闻，均支持历史日期切换）。从 app.js 剥出，行为不变。
// isFav 来自 favs feature；favToggle/aiAsk/cmdtext 经 window 桥接（内联 onclick）。
// toggleNS/toggleNews/newsDateChanged/dnewsDateChanged 挂 window 供内联 onclick。
import { esc, escAttr, jsStr, ic } from "../core/util.js";
import { isFav } from "../features/favs.js";

function toggleNS(h) {
  var b = h.nextElementSibling;
  if (!b) return;
  var open = b.style.display !== "none";
  b.style.display = open ? "none" : "";
  h.classList.toggle("closed", open);
  var car = h.querySelector(".ns-car");
  if (car) car.textContent = open ? "▸" : "▾";
}

function toggleNews(btn) {
  var d = btn.previousElementSibling;
  if (!d || !d.classList.contains("nw-d")) return;
  var open = d.classList.toggle("open");
  btn.textContent = open ? "收起 ▴" : "展开 ▾";
}

// 单条新闻卡片渲染（AI 日报 / 每日新闻共用，避免两份重复 HTML）
function renderNewsItem(it, opt) {
  opt = opt || {};
  var prefix = opt.prefix || "";
  var askText = opt.ask || "用大白话展开讲讲这条新闻的背景和影响，并说说对我有什么用：";
  var link = it.url
    ? '<a class="nw-a" href="' + escAttr(it.url) + '" target="_blank" rel="noopener">原文 ↗</a>' : "";
  var src = it.source
    ? '<span class="nw-s">' + esc(it.source) + "</span>"
    : (opt.defaultSrc ? '<span class="nw-s">' + esc(opt.defaultSrc) + "</span>" : "");
  var dHtml = "";
  if (opt.showSummary && it.summary) {
    var long = it.summary.length > 90;
    dHtml = '<div class="nw-d' + (long ? " clamp" : "") + '">' + esc(it.summary) + "</div>" +
      (long ? '<button class="nw-toggle" onclick="toggleNews(this)">展开 ▾</button>' : "");
  }
  var on = isFav(it.url);
  var fav = '<button class="fav-btn' + (on ? " on" : "") + '" onclick="favToggle(this,' + "'" + jsStr(it.title) + "','" + jsStr(it.url) + "','" + jsStr(it.source || "") + "'" + ')">' + (on ? "★" : "☆") + '</button>';
  return '<div class="nw"><div class="nw-t">' + prefix + esc(it.title) + "</div>" +
    dHtml +
    '<div class="nw-f">' + src + link + fav +
    '<button class="nw-ask" onclick="aiAsk(' + "'" + jsStr(askText + it.title) + "'" + ')">让 AI 讲讲</button>' +
    "</div></div>";
}

// ---------- AI 日报（支持历史日期切换） ----------
var NEWS_DATA = null;
function renderNews(d) {
  NEWS_DATA = d;
  var a = d.aiDaily || {};
  var box = document.getElementById("newsBlock");
  if (!box) return;
  var dot = document.getElementById("newsDot");
  if (dot) dot.style.display = ((a.count || 0) > 0) ? "inline-block" : "none";

  // 历史日期下拉（>1 天时显示）
  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史日报：' +
      '<select id="newsSel" onchange="newsDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 条)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = selHtml + '<div id="newsBody"></div>';
  renderNewsBody(curDate);
}
function newsDateChanged() {
  var sel = document.getElementById("newsSel");
  if (sel) renderNewsBody(sel.value);
}
// 资讯 Tab（AI 日报 + 每日新闻合并渲染，红点任一有更新即亮）
export function renderInfo(d) {
  renderNews(d);
  renderDailyNews(d);
  var dot = document.getElementById("infoDot");
  if (dot) {
    var n = ((d.aiDaily || {}).count || 0) + ((d.dailyNews || {}).count || 0);
    dot.style.display = n > 0 ? "inline-block" : "none";
  }
}
function renderNewsBody(date) {
  var box = document.getElementById("newsBody");
  if (!box || !NEWS_DATA) return;
  var a = NEWS_DATA.aiDaily || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var secs = day.sections || [];
  if (!secs.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("fileText") + '</span>AI 日报</h2>' +
      '<div class="empty">这一天还没有抓到日报数据。可以点「立即刷新」让本机重新抓一次；也可以让 WorkBuddy 手动跑 <code>fetch_ai_daily.py</code>。</div>' +
      '<div style="margin-top:10px"><button class="btn" onclick="cmdtext(' + "'跑一下 personal-workbench 的 fetch_ai_daily.py 抓今天的 AI 日报，然后 export + push'" + ')">让 AI 现在抓一次</button></div></div>';
    return;
  }
  var html = '<div class="card news-head"><h2>' + esc(day.date || "") + ' AI 日报' +
    '<span class="news-n">' + (day.count || 0) + ' 条</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "AI HOT") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">看完整日报 ↗</a>' : "") + "</div></div>" +
    '<div class="card"><h2><span class="ic">' + ic("compass") + '</span>基于日报做点什么</h2>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" onclick="aiAsk(' + "'把今天工作台里的 AI 日报总结成 3 条对我最有用的要点，并各给一个可以今天动手试的小实验'" + ')">提炼 3 条要点</button>' +
    '<button class="btn-sm" onclick="aiAsk(' + "'把今天的 AI 日报存进 vault/ 知识库，按主题归档'" + ')">存进知识库</button>' +
    "</div></div>";

  secs.forEach(function (s) {
    html += '<div class="card news-sec"><div class="ns-h" onclick="toggleNS(this)">' +
      '' + esc(s.label) +
      '<span class="news-n">' + (s.items || []).length + '</span><span class="ns-car">▾</span></div><div class="ns-b">';
    (s.items || []).forEach(function (it) {
      html += renderNewsItem(it, { showSummary: true, ask: "用大白话展开讲讲这条 AI 新闻的背景和影响，并说说对我有什么用：" });
    });
    html += "</div></div>";
  });

  box.innerHTML = html;
}

// ---------- 每日新闻（国内/中文，支持历史日期切换） ----------
var DNEWS_DATA = null;
function renderDailyNews(d) {
  DNEWS_DATA = d;
  var a = d.dailyNews || {};
  var box = document.getElementById("dnewsBlock");
  if (!box) return;
  var dot = document.getElementById("dnewsDot");
  if (dot) dot.style.display = ((a.count || 0) > 0) ? "inline-block" : "none";

  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史新闻：' +
      '<select id="dnewsSel" onchange="dnewsDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 条)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = selHtml + '<div id="dnewsBody"></div>';
  renderDNewsBody(curDate);
}
function dnewsDateChanged() {
  var sel = document.getElementById("dnewsSel");
  if (sel) renderDNewsBody(sel.value);
}
function renderDNewsBody(date) {
  var box = document.getElementById("dnewsBody");
  if (!box || !DNEWS_DATA) return;
  var a = DNEWS_DATA.dailyNews || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var items = day.items || [];
  var tip = day.tip || "";
  var cover = day.cover || a.cover || "";
  if (!items.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("fileText") + '</span>每日新闻</h2>' +
      '<div class="empty">这一天还没有抓到新闻数据。可以点「立即刷新」让本机重新抓一次；也可以让 WorkBuddy 手动跑 <code>fetch_daily_news.py</code>。</div>' +
      '<div style="margin-top:10px"><button class="btn" onclick="cmdtext(' + "'跑一下 personal-workbench 的 fetch_daily_news.py 抓今天的国内新闻，然后 export + push'" + ')">让 AI 现在抓一次</button></div></div>';
    return;
  }
  var html = '<div class="card news-head">' +
    (cover ? '<div class="dnews-cover" style="display:none"><img src="' + escAttr(cover) + '" alt="每日新闻封面" loading="lazy" referrerpolicy="no-referrer" onload="if(this.naturalWidth)this.parentNode.style.display=\'block\'" onerror="this.parentNode.style.display=\'none\'"></div>' : "") +
    '<h2>' + esc(day.date || "") + ' 每日新闻' +
    '<span class="news-n">' + (day.count || 0) + ' 条</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "每日60秒") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">看来源 ↗</a>' : "") + "</div>" +
    (tip ? '<div style="margin-top:8px;color:var(--sub);font-style:italic;line-height:1.5">' + esc(tip) + "</div>" : "") + "</div>" +
    '<div class="card"><h2><span class="ic">' + ic("compass") + '</span>基于新闻做点什么</h2>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" onclick="aiAsk(' + "'把今天工作台里的每日新闻挑 3 条跟我最相关的，说说为什么值得关注'" + ')">挑 3 条相关的</button>' +
    '<button class="btn-sm" onclick="aiAsk(' + "'把今天的每日新闻存进 vault/ 知识库，按主题归档'" + ')">存进知识库</button>' +
    "</div></div>";

  html += '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>今日头条</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>",
      defaultSrc: "每日60秒",
      ask: "用大白话展开讲讲这条新闻的背景，并说说对我有什么影响："
    });
  });
  html += "</div></div>";

  box.innerHTML = html;
}

window.toggleNS = toggleNS;
window.toggleNews = toggleNews;
window.newsDateChanged = newsDateChanged;
window.dnewsDateChanged = dnewsDateChanged;
