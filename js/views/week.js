// 视图：本周动态（全部 + 按类型筛选）。从 app.js 剥出，行为不变。
// weekSet 读共享状态 getData()，并挂 window 供内联 onclick 调用。
import { esc } from "../core/util.js";
import { getData } from "../core/state.js";

var WK_ICON = { skill: "", automation: "", kb: "", model: "" };
var WK_LABEL = { skill: "新增/更新 skill", automation: "新建自动化任务", kb: "新增知识库文件", model: "拉取本地模型" };
function wkItemHtml(it) {
  var dt = new Date((it.when || 0) * 1000);
  var ds = (dt.getMonth() + 1) + "-" + dt.getDate() + " " +
    ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);
  var scope = (it.scope || "").replace(/^[（(]|[）)]$/g, "").trim();
  return '<li class="wk">' + "•" + '</span>' +
    '<div class="wk-b"><span class="wk-name">' + esc(it.name) + '</span></div>' +
    (scope ? '<span class="wk-scope">' + esc(scope) + '</span>' : '') +
    '<span class="wk-meta">' + ds + '</span></li>';
}
function wkGroupHtml(items) {
  var order = ["skill", "kb", "automation", "model"];
  var html = "";
  order.forEach(function (k) {
    var list = items.filter(function (it) { return it.kind === k; });
    if (!list.length) return;
    html += '<li class="wk-grp">' + "•" + " " + esc(WK_LABEL[k] || k) +
      '<span class="cc">' + list.length + "</span></li>" + list.map(wkItemHtml).join("");
  });
  var rest = items.filter(function (it) { return order.indexOf(it.kind) < 0; });
  if (rest.length) {
    html += '<li class="wk-grp">• 其他<span class="cc">' + rest.length + "</span></li>" + rest.map(wkItemHtml).join("");
  }
  return html;
}

// 本周动态全部 tab：全量 + 按类型筛选
var weekFilter = "all";
function weekSet(k) {
  weekFilter = k;
  var data = getData();
  if (data) renderWeekAll(data);
}
export function renderWeekAll(d) {
  var box = document.getElementById("col-week");
  if (!box) return;
  var items = d.weekly || [];
  var kinds = ["all", "skill", "kb", "automation", "model"];
  var labels = { all: "全部", skill: "skill", kb: "知识库", automation: "自动化", model: "模型" };
  var chips = kinds.map(function (k) {
    var n = k === "all" ? items.length : items.filter(function (it) { return it.kind === k; }).length;
    return '<button class="week-chip' + (weekFilter === k ? " on" : "") + '" onclick="weekSet(' + "'" + k + "'" + ')">' + labels[k] + ' <span class="cc">' + n + "</span></button>";
  }).join("");
  var list = weekFilter === "all" ? items : items.filter(function (it) { return it.kind === weekFilter; });
  var body = list.length
    ? '<ul class="wk-list week-full">' + wkGroupHtml(list) + "</ul>"
    : '<div class="empty">该类型暂无变化</div>';
  box.innerHTML = '<div class="card"><h2>本周动态 · 全部（' + items.length + ' 条）</h2>' +
    '<div class="week-chips">' + chips + '</div>' + body + "</div>";
}

window.weekSet = weekSet;
