// 今日「温故」卡：让旧蒸馏经验卡"回来找你"——飞轮复用端的最小切片。
// 简化间隔重复(Leitner-lite) + localStorage；复用 /api/kb/deposits 列卡、window.distillOpen 开卡。
// 设计见 docs/温故复用-设计.md。零后端改动、零依赖。
import { esc, jsStr } from "../core/util.js";
import { icon } from "../core/icons.js";

var LS_KEY = "wb_recall";          // { [vaultPath]: {box, lastReviewed:"YYYY-MM-DD", archived} }
var INTERVAL = [0, 2, 7, 16, 35];  // box→到期间隔(天)
var MAX = 3;                        // 每日最多浮现张数
var MODULE = "蒸馏库";
// 平台 value → 图标名 / 展示名（与 distill.js 一致，本地小映射避免耦合）
var PLAT = {
  bilibili: { ic: "tv", label: "B站" },
  xhs: { ic: "book", label: "小红书" },
  article: { ic: "file", label: "图文" }
};

function _state() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function _save(map) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (e) { /* 忽略配额/隐私模式 */ }
}
function _todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function _daysBetween(aStr, bStr) {  // bStr - aStr，单位天
  var a = new Date(aStr + "T00:00:00"), b = new Date(bStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// 从卡列表 + 复用状态里挑"到期"的前 MAX 张（超期降序；新卡最高优先）
function _due(cards, state, today) {
  var out = [];
  cards.forEach(function (c) {
    var vp = c.vaultPath || c.relPath || "";
    if (!vp) return;
    var rec = state[vp] || {};
    if (rec.archived) return;
    var box = rec.box | 0;
    var last = rec.lastReviewed;
    var interval = INTERVAL[Math.min(box, INTERVAL.length - 1)];
    var overdue, since = null;
    if (!last) { overdue = 99999; }               // 新卡：立即到期、最高优先
    else { since = _daysBetween(last, today); overdue = since - interval; }
    if (overdue >= 0) out.push({ c: c, vp: vp, overdue: overdue, since: since });
  });
  out.sort(function (a, b) { return b.overdue - a.overdue; });
  return out.slice(0, MAX);
}

function _badge(plat) {
  var p = PLAT[plat];
  return p ? icon(p.ic) + " " + esc(p.label) : "";
}

export function renderRecall() {
  var box = document.getElementById("recallBlock");
  if (!box) return;
  fetch("/api/kb/deposits?module=" + encodeURIComponent(MODULE))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.configured || !Array.isArray(d.deposits)) { box.innerHTML = ""; return; }
      var items = _due(d.deposits, _state(), _todayStr());
      _draw(box, items);
    })
    .catch(function () { box.innerHTML = ""; });  // 无后端/离线：静默隐藏，不影响今日
}

function _draw(box, items) {
  if (!items.length) { box.innerHTML = ""; return; }  // 无到期卡：不占地方
  var rows = items.map(function (it) {
    var c = it.c;
    var meta = [];
    var b = _badge(c.platform); if (b) meta.push(b);
    if (c.topic) meta.push("# " + esc(c.topic));
    meta.push(it.since == null ? "未复看" : (it.since + " 天没看"));
    return '<div class="recall-card">' +
        '<div class="rc-body" onclick="recallOpen(' + "'" + jsStr(it.vp) + "'" + ')">' +
          '<div class="rc-title">' + esc(c.title || c.fileName || "未命名") + "</div>" +
          '<div class="rc-meta">' + meta.join(" · ") + "</div>" +
        "</div>" +
        '<div class="rc-acts">' +
          '<button class="button sm ghost" onclick="recallOpen(' + "'" + jsStr(it.vp) + "'" + ')">打开</button>' +
          '<button class="button sm" onclick="recallUseful(' + "'" + jsStr(it.vp) + "'" + ')">' + icon("check") + " 有用</button>" +
          '<button class="button sm ghost" onclick="recallArchive(' + "'" + jsStr(it.vp) + "'" + ')">已内化</button>' +
        "</div>" +
      "</div>";
  }).join("");
  box.innerHTML =
    '<section class="card recall-card-wrap">' +
      '<h2><span class="ic">' + icon("history") + "</span> 该复用了 · " + items.length + " 张</h2>" +
      '<div class="recall-list">' + rows + "</div>" +
    "</section>";
}

function recallOpen(vp) {
  if (!vp) return;
  var m = _state();
  m[vp] = { box: (m[vp] && m[vp].box) | 0, lastReviewed: _todayStr(), archived: !!(m[vp] && m[vp].archived) };
  _save(m);
  if (typeof window.switchView === "function") window.switchView("distill");
  if (typeof window.distillOpen === "function") window.distillOpen(vp);
}
function recallUseful(vp) {
  if (!vp) return;
  var m = _state(); var rec = m[vp] || {};
  m[vp] = { box: Math.min((rec.box | 0) + 1, INTERVAL.length - 1), lastReviewed: _todayStr(), archived: false };
  _save(m);
  renderRecall();
}
function recallArchive(vp) {
  if (!vp) return;
  var m = _state(); var rec = m[vp] || {};
  m[vp] = { box: rec.box | 0, lastReviewed: rec.lastReviewed || _todayStr(), archived: true };
  _save(m);
  renderRecall();
}

// ---- window 桥接（内联 onclick 用；遵项目"文件末尾挂自己的处理器"约定） ----
window.renderRecall = renderRecall;
window.recallOpen = recallOpen;
window.recallUseful = recallUseful;
window.recallArchive = recallArchive;
