// 视图：资讯（AI 日报 + 每日新闻，均支持历史日期切换）。从 app.js 剥出，行为不变。
// isFav 来自 favs feature；favToggle/aiAsk/cmdtext 经 window 桥接（内联 onclick）。
// toggleNS/toggleNews/newsDateChanged/dnewsDateChanged 挂 window 供内联 onclick。
import { esc, escAttr, jsStr, ic } from "../core/util.js";
import { isFav } from "../features/favs.js";

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
  // 讲讲：带全上下文 {标题+摘要+链接+来源}（data-*，修「只带标题」），点开 → 右侧副驾开讲
  var askBtn = '<button class="nw-ask" onclick="newsExplain(this)"' +
    ' data-t="' + escAttr(it.title || "") + '"' +
    ' data-s="' + escAttr(it.summary || "") + '"' +
    ' data-u="' + escAttr(it.url || "") + '"' +
    ' data-src="' + escAttr(it.source || opt.defaultSrc || "") + '"' +
    ' data-ask="' + escAttr(askText) + '">让 AI 讲讲</button>';
  return '<div class="nw"><div class="nw-t">' + prefix + esc(it.title) + "</div>" +
    dHtml +
    '<div class="nw-f">' + src + link + fav + askBtn +
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
  box.innerHTML = sourceHead("news", "AI 日报", a.count, "条", "fileText") +
    nsBodyOpen("news") + selHtml + '<div id="newsBody"></div></div>';
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
  renderHackerNews(d);
  renderGithubTrending(d);
  renderProductHunt(d);
  renderSspai(d);
  var dot = document.getElementById("infoDot");
  if (dot) {
    var n = ((d.aiDaily || {}).count || 0) + ((d.dailyNews || {}).count || 0) +
      ((d.hackerNews || {}).count || 0) + ((d.githubTrending || {}).count || 0) +
      ((d.productHunt || {}).count || 0) + ((d.sspai || {}).count || 0);
    dot.style.display = n > 0 ? "inline-block" : "none";
  }
}
function renderNewsBody(date) {
  var box = document.getElementById("newsBody");
  if (!box || !NEWS_DATA) return;
  var a = NEWS_DATA.aiDaily || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var secs = day.sections || [];
  _aiDigest = _digestSections(secs, 40);   // 供顶部「提炼/存库」内嵌当日 digest（修「数据带不过去」）
  _aiCount = day.count || 0;
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
    '<button class="btn" onclick="feedAsk(\'refine-ai\')">提炼 3 条要点</button>' +
    '<button class="btn-sm" onclick="feedAsk(\'archive-ai\')">存进知识库</button>' +
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
  box.innerHTML = sourceHead("dnews", "每日新闻", a.count, "条", "fileText") +
    nsBodyOpen("dnews") + selHtml + '<div id="dnewsBody"></div></div>';
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
  _dnewsDigest = _digestItems(items, 40);   // 供顶部「挑3条/存库」内嵌当日 digest
  _dnewsCount = day.count || 0;
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
    '<button class="btn" onclick="feedAsk(\'refine-dnews\')">挑 3 条相关的</button>' +
    '<button class="btn-sm" onclick="feedAsk(\'archive-dnews\')">存进知识库</button>' +
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

// ---------- Hacker News 热帖（经 OpenCLI 取数层，支持历史日期切换） ----------
var HNEWS_DATA = null;
function renderHackerNews(d) {
  HNEWS_DATA = d;
  var a = d.hackerNews || {};
  var box = document.getElementById("hnewsBlock");
  if (!box) return;
  var dot = document.getElementById("hnewsDot");
  if (dot) dot.style.display = ((a.count || 0) > 0) ? "inline-block" : "none";

  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史热帖：' +
      '<select id="hnewsSel" onchange="hnewsDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 条)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = sourceHead("hnews", "Hacker News 热帖", a.count, "条", "trendingUp") +
    nsBodyOpen("hnews") + selHtml + '<div id="hnewsBody"></div></div>';
  renderHNBody(curDate);
}
function hnewsDateChanged() {
  var sel = document.getElementById("hnewsSel");
  if (sel) renderHNBody(sel.value);
}
function renderHNBody(date) {
  var box = document.getElementById("hnewsBody");
  if (!box || !HNEWS_DATA) return;
  var a = HNEWS_DATA.hackerNews || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var items = day.items || [];
  if (!items.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>Hacker News 热帖</h2>' +
      '<div class="empty">还没有抓到 Hacker News 数据。点「立即刷新」让本机经 OpenCLI 抓一次；若本机没装 OpenCLI（Node ≥20），该源会自动跳过，不影响其它资讯。</div></div>';
    return;
  }
  var html = '<div class="card news-head"><h2>' + esc(day.date || "") + ' Hacker News 热帖' +
    '<span class="news-n">' + (day.count || 0) + ' 条</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "Hacker News") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">去 HN ↗</a>' : "") + "</div></div>";
  html += '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>今日热帖</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>",
      defaultSrc: "Hacker News",
      showSummary: true,
      ask: "用大白话讲讲这条 Hacker News 热帖在讨论什么、为什么值得关注："
    });
  });
  html += "</div></div>";
  box.innerHTML = html;
}

// ---------- GitHub Trending 今日热门（经 OpenCLI 取数层，支持历史日期切换） ----------
var GT_DATA = null;
function renderGithubTrending(d) {
  GT_DATA = d;
  var a = d.githubTrending || {};
  var box = document.getElementById("gtBlock");
  if (!box) return;
  var dot = document.getElementById("gtDot");
  if (dot) dot.style.display = ((a.count || 0) > 0) ? "inline-block" : "none";

  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史热门：' +
      '<select id="gtSel" onchange="gtDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 个)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = sourceHead("gt", "GitHub Trending 今日热门", a.count, "个", "trendingUp") +
    nsBodyOpen("gt") + selHtml + '<div id="gtBody"></div></div>';
  renderGTBody(curDate);
}
function gtDateChanged() {
  var sel = document.getElementById("gtSel");
  if (sel) renderGTBody(sel.value);
}
function renderGTBody(date) {
  var box = document.getElementById("gtBody");
  if (!box || !GT_DATA) return;
  var a = GT_DATA.githubTrending || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var items = day.items || [];
  if (!items.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>GitHub Trending 今日热门</h2>' +
      '<div class="empty">还没有抓到 GitHub Trending 数据。点「立即刷新」让本机经 OpenCLI 抓一次；若本机没装 OpenCLI（Node ≥20），该源会自动跳过，不影响其它资讯。</div></div>';
    return;
  }
  var html = '<div class="card news-head"><h2>' + esc(day.date || "") + ' GitHub Trending 今日热门' +
    '<span class="news-n">' + (day.count || 0) + ' 个</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "GitHub Trending") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">去 Trending ↗</a>' : "") + "</div></div>";
  html += '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>今日热门仓库</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>",
      defaultSrc: "GitHub Trending",
      showSummary: true,
      ask: "用大白话讲讲这个 GitHub 仓库是做什么的、解决了什么问题、什么时候该用它："
    });
  });
  html += "</div></div>";
  box.innerHTML = html;
}

// ---------- Product Hunt 每日新品（stdlib Atom 取数，支持历史日期切换） ----------
var PH_DATA = null;
function renderProductHunt(d) {
  PH_DATA = d;
  var a = d.productHunt || {};
  var box = document.getElementById("phBlock");
  if (!box) return;
  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史新品：' +
      '<select id="phSel" onchange="phDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 个)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = sourceHead("ph", "Product Hunt 每日新品", a.count, "个", "trendingUp") +
    nsBodyOpen("ph") + selHtml + '<div id="phBody"></div></div>';
  renderPHBody(curDate);
}
function phDateChanged() {
  var sel = document.getElementById("phSel");
  if (sel) renderPHBody(sel.value);
}
function renderPHBody(date) {
  var box = document.getElementById("phBody");
  if (!box || !PH_DATA) return;
  var a = PH_DATA.productHunt || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var items = day.items || [];
  if (!items.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>Product Hunt 每日新品</h2>' +
      '<div class="empty">还没有抓到 Product Hunt 数据。点「立即刷新」让本机抓一次（走公开 Atom feed，无需 Node/OpenCLI）。</div></div>';
    return;
  }
  var html = '<div class="card news-head"><h2>' + esc(day.date || "") + ' Product Hunt 每日新品' +
    '<span class="news-n">' + (day.count || 0) + ' 个</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "Product Hunt") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">去 Product Hunt ↗</a>' : "") + "</div></div>";
  html += '<div class="card"><h2><span class="ic">' + ic("trendingUp") + '</span>今日上新（挑一个拆产品感）</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>",
      defaultSrc: "Product Hunt",
      showSummary: true,
      ask: "用大白话讲讲这个新产品解决了谁的什么需求、亮点在哪、我能从它的设计里学到什么："
    });
  });
  html += "</div></div>";
  box.innerHTML = html;
}

// ---------- 少数派上新（stdlib RSS 取数，支持历史日期切换） ----------
var SSPAI_DATA = null;
function renderSspai(d) {
  SSPAI_DATA = d;
  var a = d.sspai || {};
  var box = document.getElementById("sspaiBlock");
  if (!box) return;
  var hist = a.history || [];
  var curDate = a.date || "";
  var selHtml = "";
  if (hist.length > 1) {
    selHtml = '<div class="news-sel">历史上新：' +
      '<select id="sspaiSel" onchange="sspaiDateChanged()">' +
      hist.map(function (h) {
        return '<option value="' + escAttr(h.date) + '"' + (h.date === curDate ? " selected" : "") + '>' +
          esc(h.date) + ' (' + (h.count || 0) + ' 篇)</option>';
      }).join("") + '</select></div>';
  }
  box.innerHTML = sourceHead("sspai", "少数派上新", a.count, "篇", "fileText") +
    nsBodyOpen("sspai") + selHtml + '<div id="sspaiBody"></div></div>';
  renderSspaiBody(curDate);
}
function sspaiDateChanged() {
  var sel = document.getElementById("sspaiSel");
  if (sel) renderSspaiBody(sel.value);
}
function renderSspaiBody(date) {
  var box = document.getElementById("sspaiBody");
  if (!box || !SSPAI_DATA) return;
  var a = SSPAI_DATA.sspai || {};
  var day = (a.history || []).filter(function (h) { return h.date === date; })[0] || a;
  var items = day.items || [];
  if (!items.length) {
    box.innerHTML = '<div class="card"><h2><span class="ic">' + ic("fileText") + '</span>少数派上新</h2>' +
      '<div class="empty">还没有抓到少数派数据。点「立即刷新」让本机抓一次（走公开 RSS，无需 Node/OpenCLI）。</div></div>';
    return;
  }
  var html = '<div class="card news-head"><h2>' + esc(day.date || "") + ' 少数派上新' +
    '<span class="news-n">' + (day.count || 0) + ' 篇</span></h2>' +
    '<div class="news-meta">数据源 ' + esc(day.source || a.source || "少数派") + ' · 抓取于 ' + esc(day.fetchedAt || "-") +
    (day.canonical ? ' · <a href="' + escAttr(day.canonical) + '" target="_blank" rel="noopener">去少数派 ↗</a>' : "") + "</div></div>";
  html += '<div class="card"><h2><span class="ic">' + ic("fileText") + '</span>近期文章</h2><div class="nw-grid">';
  items.forEach(function (it, i) {
    html += renderNewsItem(it, {
      prefix: '<span style="color:var(--accent2);font-weight:600;margin-right:7px;flex:0 0 auto">' + (i + 1) + ".</span>",
      defaultSrc: "少数派",
      showSummary: true,
      ask: "用大白话讲讲这篇文章在说什么、对提升产品品味/效率有什么启发："
    });
  });
  html += "</div></div>";
  box.innerHTML = html;
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
// 顶部「提炼要点 / 存进知识库」：把当日 digest 内嵌进 prompt（修「数据带不过去」= Loss B）。
var _aiDigest = "", _aiCount = 0, _dnewsDigest = "", _dnewsCount = 0;
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
function feedAsk(kind) {
  var p = "", has;
  if (kind === "refine-ai") { p = "下面是今天的 AI 日报（" + _aiCount + " 条）。挑出对我最有用的 3 条要点，各配一个今天就能动手试的小实验。\n\n" + _aiDigest; has = !!_aiDigest; }
  else if (kind === "archive-ai") { p = "把今天这份 AI 日报整理成一篇可归档的主题化摘要（Markdown，分主题、要点式）。整理好后我自己点「存知识库」入库。\n\n" + _aiDigest; has = !!_aiDigest; }
  else if (kind === "refine-dnews") { p = "下面是今天的每日新闻（" + _dnewsCount + " 条）。挑 3 条跟我最相关的，说说为什么值得关注。\n\n" + _dnewsDigest; has = !!_dnewsDigest; }
  else if (kind === "archive-dnews") { p = "把今天这份每日新闻整理成一篇可归档的主题化摘要（Markdown）。整理好后我自己点「存知识库」入库。\n\n" + _dnewsDigest; has = !!_dnewsDigest; }
  else return;
  if (!has) { if (typeof window.dockOpen === "function") window.dockOpen(); return; }  // 无数据只开 dock
  if (typeof window.dockAsk === "function") window.dockAsk(p, { agent: true, autoSend: true });
}
window.newsExplain = newsExplain;
window.feedAsk = feedAsk;
window.toggleNS = toggleNS;
window.toggleSource = toggleSource;
window.toggleNews = toggleNews;
window.newsDateChanged = newsDateChanged;
window.dnewsDateChanged = dnewsDateChanged;
window.hnewsDateChanged = hnewsDateChanged;
window.gtDateChanged = gtDateChanged;
window.phDateChanged = phDateChanged;
window.sspaiDateChanged = sspaiDateChanged;
