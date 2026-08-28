// 视图：会话档案（搜索 / 近期 / 活跃热力图 / 全部档案）。从 app.js 剥出，行为不变。
// aiAsk 经 window 桥接（内联 onclick）取用；openHeat/closeHeat/sessFilter/sessStatus
// 亦挂 window 供内联 onclick 与全局 Esc 键处理调用。
import { esc, escAttr, jsStr } from "../core/util.js";

function openHeat(span) {
  var date = span.getAttribute("data-date");
  var count = span.getAttribute("data-count");
  var titles = (span.getAttribute("data-titles") || "").split("\n").filter(Boolean);
  document.getElementById("heat-detail-date").textContent = date + " · " + count + " 个会话";
  var body = document.getElementById("heat-detail-body");
  body.innerHTML = titles.length
    ? titles.map(function (t) {
        return '<div class="hdi" onclick="aiAsk(' + "'回顾并继续这个会话：" + jsStr(t) + "'" + ')">' + esc(t) + '<span class="hd-arrow">›</span></div>';
      }).join("")
    : '<div class="empty">这天没有会话记录</div>';
  document.getElementById("heat-detail").style.display = "flex";
}
export function closeHeat() { document.getElementById("heat-detail").style.display = "none"; }

function renderHeat(heat) {
  var total = heat.reduce(function (a, b) { return a + b.count; }, 0);
  var html = '<div class="heat"><div class="heat-t">近 17 周会话活跃 · 合计 ' + total + ' 条记录 · 点格子看当天聊了啥</div><div class="heat-g">';
  heat.forEach(function (h) {
    var lvl = h.count === 0 ? "l0" : (h.count <= 2 ? "l1" : (h.count <= 5 ? "l2" : "l3"));
    var titles = (h.titles || []).map(function (t) { return esc(t); }).join("\n");
    html += '<span class="hc ' + lvl + '" data-date="' + h.date + '" data-count="' + h.count + '" data-titles="' + escAttr(titles) + '" onclick="openHeat(this)" title="' + h.date + " : " + h.count + ' 个会话"></span>';
  });
  html += '</div><div class="heat-lg"><span class="hc l1"></span>少 <span class="hc l2"></span>中 <span class="hc l3"></span>多</div></div>';
  return html;
}

function sessFilter() {
  var q = (document.getElementById("sessQ").value || "").trim().toLowerCase();
  var items = document.querySelectorAll("#sessArchiveList .sess-it");
  var n = 0;
  items.forEach(function (it) {
    var show = !q || (it.getAttribute("data-title") || "").toLowerCase().indexOf(q) >= 0;
    it.style.display = show ? "" : "none";
    if (show) n++;
  });
  var c = document.getElementById("sessCount");
  if (c) c.textContent = n + " 条";
}
function sessStatus(v) {
  var chips = document.querySelectorAll(".schip");
  chips.forEach(function (c) { c.classList.toggle("active", c.getAttribute("data-v") === v); });
  var items = document.querySelectorAll("#sessRecentList .sess-it");
  items.forEach(function (it) {
    it.style.display = (v === "all" || it.getAttribute("data-status") === v) ? "" : "none";
  });
}
export function renderSessArchive(d) {
  var box = document.getElementById("col-sess");
  if (!box) return;
  var sess = d.sessions || {};
  var recent = sess.recent || [];
  var heat = sess.heatmap || [];
  var byDate = {};
  heat.forEach(function (h) { byDate[h.date] = (h.titles || []); });
  var dates = Object.keys(byDate).sort().reverse();
  var totalTitles = 0; dates.forEach(function (dt) { totalTitles += byDate[dt].length; });
  var archiveHtml = "";
  dates.forEach(function (dt) {
    var list = byDate[dt];
    if (!list.length) return;
    archiveHtml += '<div class="sess-day">' + esc(dt) + ' <span class="cc">' + list.length + "</span></div>";
    list.forEach(function (t) {
      archiveHtml += '<div class="auto sess sess-it" data-title="' + escAttr(t) + '" onclick="aiAsk(' + "'回顾并继续这个会话：" + jsStr(t) + "'" + ')"><b>' + esc(t) + "</b></div>";
    });
  });
  var recentHtml = '<div class="card"><h2>近期会话（最近 ' + recent.length + ' 条）</h2>' +
    '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">' +
    '<button class="schip active" data-v="all" onclick="sessStatus(\'all\')">全部</button>' +
    '<button class="schip" data-v="working" onclick="sessStatus(\'working\')">进行中</button></div>' +
    '<div id="sessRecentList">' + (recent.length ? recent.map(function (s) {
      var st = s.status || "";
      var disp = s.display || s.title || "";
      return '<div class="auto sess sess-it" data-status="' + escAttr(st) + '" onclick="aiAsk(' + "'回顾并继续这个会话：" + jsStr(disp) + "'" + ')"><b>' + esc(disp) + '</b><span class="meta">' + esc(s.updated) + (st === "working" ? ' <span class="badge on">进行中</span>' : "") + "</span></div>";
    }).join("") : '<div class="empty">暂无近期会话</div>') + "</div></div>";
  var html = '<div class="card"><h2><span class="ic">🔍</span>搜索会话</h2>' +
    '<input id="sessQ" class="sf" placeholder="按标题搜索全部会话…" oninput="sessFilter()">' +
    '<div class="empty" style="margin-top:4px">共 ' + totalTitles + ' 条历史记录 · ' + dates.length + ' 天</div></div>' +
    recentHtml +
    '<div class="card"><h2>活跃热力图 · 近 ' + heat.length + ' 天</h2>' + renderHeat(heat) + "</div>" +
    '<div class="card"><h2>全部会话档案<span class="news-n" id="sessCount">' + totalTitles + " 条</span></h2>" +
    '<div id="sessArchiveList" class="sess-arch">' + archiveHtml + '</div></div>';
  box.innerHTML = html;
}

// 兼容桥接：内联 onclick 与全局 Esc 键（app.js boot 亦 import closeHeat 直接调用）
window.openHeat = openHeat;
window.closeHeat = closeHeat;
window.sessFilter = sessFilter;
window.sessStatus = sessStatus;
