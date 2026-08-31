// 视图：今日头部辅助（快捷启动台 + 今日复盘）。
// IA 重构后原「仪表盘」下线：速记/收藏/入口/快捷启动已并入「今日」；KPI 指标条与今日速览已删除，
// 「今日建议」按钮去重（保留于「能力速达」）。cmdtext 经 window 桥接（内联 onclick）。
import { esc, jsStr } from "../core/util.js";
import { todosLoad } from "../features/todos.js";

// 快捷启动台（今日视图卡片）：把 quickActions 渲染成一键命令按钮
export function renderQuick(d) {
  var box = document.getElementById("quickbar");
  if (!box) return;
  box.innerHTML = (d.quickActions || []).map(function (q) {
    return '<button class="qb" onclick="cmdtext(' + "'" + jsStr(q.cmd) + "'" + ')">' + q.icon + " " + esc(q.label) + "</button>";
  }).join("");
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
export function renderTodayReview(d) {
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

window.saveReview = saveReview;
