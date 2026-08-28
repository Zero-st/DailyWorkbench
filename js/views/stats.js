// 视图：Skill 使用统计（从 app.js 剥出，行为不变）。
import { esc, ic, catLabel } from "../core/util.js";

export function renderStats(d) {
  var box = document.getElementById("col-stats");
  if (!box) return;
  var skills = d.skills || [];
  var used = skills.filter(function (s) { return (s.usage || 0) > 0; });
  var totalUsage = skills.reduce(function (a, s) { return a + (s.usage || 0); }, 0);
  var top = skills.slice().sort(function (a, b) { return (b.usage || 0) - (a.usage || 0); }).filter(function (s) { return (s.usage || 0) > 0; }).slice(0, 10);
  var maxU = top.length ? top[0].usage : 1;
  var byCat = {};
  skills.forEach(function (s) { (byCat[s.category] = byCat[s.category] || []).push(s); });
  var catMax = 1; Object.keys(byCat).forEach(function (c) { if (byCat[c].length > catMax) catMax = byCat[c].length; });
  var html = '<div class="card"><h2><span class="ic">' + ic("barChart2") + '</span>Skill 使用统计</h2>' +
    '<div class="ov-res" style="margin-bottom:10px">' +
    '<div class="ov-metric"><span class="rk">已装 Skills</span><span class="rv">' + skills.length + '</span><span class="rn">个能力</span></div>' +
    '<div class="ov-metric"><span class="rk">用过</span><span class="rv">' + used.length + '</span><span class="rn">占 ' + Math.round(100 * used.length / Math.max(1, skills.length)) + '%</span></div>' +
    '<div class="ov-metric"><span class="rk">累计使用</span><span class="rv">' + totalUsage + '</span><span class="rn">次调用</span></div>' +
    "</div></div>";
  html += '<div class="card"><h2><span class="ic">🔥</span>使用最多的 TOP ' + top.length + '</h2>';
  if (!top.length) html += '<div class="empty">还没有使用记录，去 能力速达 点几个 skill 试试（点一下即算一次）</div>';
  html += '<div class="stat-list">' + top.map(function (s) {
    return '<div class="stat"><span class="st-name">' + esc(s.name) + '</span>' +
      '<span class="st-bar"><span class="st-fill" style="width:' + Math.round(100 * s.usage / maxU) + '%"></span></span>' +
      '<span class="st-num">' + s.usage + '</span></div>';
  }).join("") + "</div></div>";
  html += '<div class="card"><h2>按分类分布（' + Object.keys(byCat).length + ' 类）</h2><div class="stat-list">' +
    Object.keys(byCat).map(function (c) {
      return '<div class="stat"><span class="st-name">' + esc(catLabel(c)) + '</span>' +
        '<span class="st-bar"><span class="st-fill" style="width:' + Math.round(100 * byCat[c].length / catMax) + '%"></span></span>' +
        '<span class="st-num">' + byCat[c].length + '</span></div>';
    }).join("") + "</div></div>";
  box.innerHTML = html;
}
