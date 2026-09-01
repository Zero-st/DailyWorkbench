// 视图：捕获收件箱（inbox）。飞轮"捕获"环节的低摩擦落点：
// 刷小红书/B站/微博/即刻看到好帖子/好想法 → 秒存（localStorage，离线可跑）→
// 之后在收件箱里一键「→蒸馏」升级成六维经验卡，或「归档」进知识库。
// 纯本地、零云、不依赖后端；归档进库才用 window.kbSave（需后端在线）。
// 复用：js/core/platforms.js（平台枚举/自动识别）、window.distillNew（升级蒸馏）、window.kbSave（归档）。
import { esc, escAttr, undoSnack } from "../core/util.js";
import { icon } from "../core/icons.js";
import { PLATFORMS, platform, platformBadge, detectPlatform } from "../core/platforms.js";

var INBOX_KEY = "wb_inbox";
var _statusFilter = "";  // ""=全部 / 待处理 / 已蒸馏 / 已归档
var _typeFilter = "";    // ""=全部 / clip / idea
var _pendingId = null;   // 正在「→蒸馏」的条目 id，蒸馏保存成功后回标已蒸馏

export function inboxLoad() {
  try { return JSON.parse(localStorage.getItem(INBOX_KEY) || "[]"); } catch (e) { return []; }
}
export function inboxSave(list) { try { localStorage.setItem(INBOX_KEY, JSON.stringify(list)); } catch (e) {} }

function _find(id) { var l = inboxLoad(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function _fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + "-" + d.getDate(); }
function _title(it) { return (it.note && it.note.trim()) || it.url || "未命名"; }
function _isInboxActive() { var v = document.getElementById("view-inbox"); return v && v.classList.contains("active"); }

// ---- 主渲染 ----
export function renderInbox() {
  var col = document.getElementById("col-inbox");
  if (!col) return;
  col.innerHTML =
    '<div class="inbox-wrap">' +
      '<div class="card inbox-capture">' +
        '<h2>' + icon("inbox") + ' 秒存一条</h2>' +
        '<div class="ib-row"><input id="ibUrl" class="sf" placeholder="粘贴帖子链接（小红书/B站/微博/即刻/文章），或留空只记想法" oninput="inboxDetect()" onkeydown="if(event.key===\'Enter\')inboxAdd()"></div>' +
        '<div class="ib-plat"><span class="ib-plat-lbl">平台</span><span id="ibPlat" class="chip on">想法</span></div>' +
        '<div class="ib-row"><input id="ibNote" class="sf" placeholder="一句话想法 / 为什么值得存（想法类必填，剪藏可选）" onkeydown="if(event.key===\'Enter\')inboxAdd()"></div>' +
        '<div class="ib-row"><input id="ibTags" class="sf" placeholder="标签，空格分隔（可选，如 RAG Agent）" onkeydown="if(event.key===\'Enter\')inboxAdd()"></div>' +
        '<div class="ib-actions"><span id="ibHint" class="empty"></span>' +
          '<button class="button sm" onclick="inboxAdd()">' + icon("download") + ' 秒存</button></div>' +
      '</div>' +
      '<div class="ib-list-head">' +
        '<div class="ib-filter" id="ibFilter"></div>' +
        '<span class="kb-cnt" id="inboxCnt"></span>' +
      '</div>' +
      '<div class="inbox-list" id="inboxList"><div class="empty">加载中…</div></div>' +
    '</div>';
  _drawFilter();
  _drawList();
  inboxDetect();
}

function _drawFilter() {
  var el = document.getElementById("ibFilter");
  if (!el) return;
  var chip = function (label, active, fn) {
    return '<button class="chip' + (active ? " on" : "") + '" onclick="' + fn + '">' + esc(label) + "</button>";
  };
  var s = [
    chip("全部", _statusFilter === "", "inboxFilterStatus('')"),
    chip("待处理", _statusFilter === "待处理", "inboxFilterStatus('待处理')"),
    chip("已蒸馏", _statusFilter === "已蒸馏", "inboxFilterStatus('已蒸馏')"),
    chip("已归档", _statusFilter === "已归档", "inboxFilterStatus('已归档')")
  ];
  var t = [
    '<span class="ib-filter-sep"></span>',
    chip("剪藏", _typeFilter === "clip", "inboxFilterType('clip')"),
    chip("灵感", _typeFilter === "idea", "inboxFilterType('idea')")
  ];
  el.innerHTML = s.join("") + t.join("");
}

function _drawList() {
  var el = document.getElementById("inboxList");
  if (!el) return;
  var all = inboxLoad();
  var rows = all.filter(function (r) {
    return (!_statusFilter || r.status === _statusFilter) && (!_typeFilter || r.type === _typeFilter);
  });
  var cnt = document.getElementById("inboxCnt");
  if (cnt) cnt.textContent = rows.length + " / " + all.length + " 条";
  if (!rows.length) {
    el.innerHTML = '<div class="empty">' + (all.length ? "该筛选下暂无条目" : "还没有捕获，刷到好帖子/好想法就来这儿秒存～") + "</div>";
    return;
  }
  el.innerHTML = rows.map(function (r) {
    var meta = [];
    if (r.type === "clip") meta.push(platformBadge(r.platform));
    else meta.push(icon("edit") + " 灵感");
    meta.push('<span class="ib-status ib-st-' + _stClass(r.status) + '">' + esc(r.status) + "</span>");
    if (r.at) meta.push(_fmtDate(r.at));
    var tags = (r.tags || []).map(function (t) { return '<span class="ib-tag"># ' + esc(t) + "</span>"; }).join(" ");
    var acts = [];
    if (r.type === "clip" && r.status !== "已蒸馏") acts.push('<button class="button sm" onclick="inboxToDistill(' + "'" + r.id + "'" + ')">' + icon("beaker") + " →蒸馏</button>");
    if (r.status !== "已归档") acts.push('<button class="button sm ghost" onclick="inboxArchive(' + "'" + r.id + "'" + ')">' + icon("archive") + " 归档</button>");
    if (r.url) acts.push('<a class="button sm ghost" href="' + escAttr(r.url) + '" target="_blank" rel="noopener">' + icon("link") + " 原文</a>");
    acts.push('<button class="nd" title="删除" onclick="inboxDrop(' + "'" + r.id + "'" + ')">✕</button>');
    return '<div class="distill-card ib-card">' +
      '<div class="dc-title">' + esc(_title(r)) + "</div>" +
      '<div class="dc-meta">' + meta.join(" · ") + "</div>" +
      (tags ? '<div class="ib-tags">' + tags + "</div>" : "") +
      '<div class="ib-card-acts">' + acts.join(" ") + "</div>" +
      "</div>";
  }).join("");
}
function _stClass(s) { return s === "已蒸馏" ? "done" : (s === "已归档" ? "arch" : "todo"); }

// ---- 捕获 ----
function inboxDetect() {
  var url = (document.getElementById("ibUrl") || {}).value || "";
  var badge = document.getElementById("ibPlat");
  if (!badge) return;
  url = url.trim();
  badge.innerHTML = url ? platformBadge(detectPlatform(url)) : "想法";
}

function inboxAdd() {
  var g = function (id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; };
  var url = g("ibUrl"), note = g("ibNote"), tagStr = g("ibTags");
  var hint = document.getElementById("ibHint");
  if (!url && !note) { if (hint) hint.textContent = "先粘链接，或写一句想法"; return; }
  var tags = tagStr.split(/[\s,，]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  var item = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
    type: url ? "clip" : "idea",
    url: url,
    platform: url ? detectPlatform(url) : "",
    note: note,
    tags: tags,
    status: "待处理",
    at: Date.now()
  };
  var list = inboxLoad();
  list.unshift(item);
  inboxSave(list);
  ["ibUrl", "ibNote", "ibTags"].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ""; });
  inboxDetect();
  if (hint) hint.textContent = "✓ 已存（" + (item.type === "clip" ? "剪藏" : "灵感") + "）";
  _drawList();
}

function inboxFilterStatus(v) { _statusFilter = v; _drawFilter(); _drawList(); }
function inboxFilterType(v) { _typeFilter = (_typeFilter === v ? "" : v); _drawFilter(); _drawList(); }

function inboxDrop(id) {
  var list = inboxLoad();
  var idx = -1; list.forEach(function (r, i) { if (r.id === id) idx = i; });
  if (idx < 0) return;
  var removed = list[idx];
  list.splice(idx, 1); inboxSave(list); _drawList();
  undoSnack("已删除捕获", function () {
    var l = inboxLoad(); l.splice(Math.min(idx, l.length), 0, removed); inboxSave(l); _drawList();
  });
}

// 归档：值得留的想法/剪藏 → 若后端在线，一份 kbSave 到 Obsidian 收件箱/；否则纯本地标记。
function inboxArchive(id) {
  var it = _find(id);
  if (!it) return;
  var mark = function (msg) {
    var l = inboxLoad(); for (var i = 0; i < l.length; i++) if (l[i].id === id) l[i].status = "已归档";
    inboxSave(l); _drawList();
    var hint = document.getElementById("ibHint"); if (hint) hint.textContent = msg;
  };
  if (typeof window.kbSave !== "function") { mark("已归档（本地；后端未加载，未写入知识库）"); return; }
  var title = _title(it).slice(0, 40);
  var bodyLines = [];
  if (it.note) bodyLines.push(it.note);
  if (it.url) bodyLines.push("\n原文：" + it.url);
  window.kbSave({
    module: "收件箱", source: "note", title: title, body: bodyLines.join("\n"),
    extra: { platform: it.platform || "", url: it.url || "", topic: (it.tags || []).join(" "), actionable: [] }
  }).then(function (r) {
    if (r && r.ok) mark("已归档进知识库：" + (r.fileName || r.path || ""));
    else mark("已归档（本地；写库失败：" + ((r && r.error) || "未知") + "）");
  }).catch(function () { mark("已归档（本地；后端不可达，未写入知识库）"); });
}

// 升级为蒸馏：跳蒸馏库、预填链接+平台，走完蒸馏保存后由 inboxOnDistilled 回标。
function inboxToDistill(id) {
  var it = _find(id);
  if (!it) return;
  _pendingId = id;
  if (typeof window.switchView === "function") window.switchView("distill");
  if (typeof window.distillNew === "function") window.distillNew({ url: it.url, platform: it.platform || "article" });
}

// 由 distill.js 的 distillSave 保存成功后回调（薄耦合）：把来源条目标记已蒸馏
window.inboxOnDistilled = function () {
  if (!_pendingId) return;
  var l = inboxLoad();
  for (var i = 0; i < l.length; i++) if (l[i].id === _pendingId) l[i].status = "已蒸馏";
  inboxSave(l);
  _pendingId = null;
  if (_isInboxActive()) _drawList();
};

// ---- window 桥接（内联 onclick 用；遵项目"文件末尾挂处理器"约定） ----
window.renderInbox = renderInbox;
window.inboxDetect = inboxDetect;
window.inboxAdd = inboxAdd;
window.inboxFilterStatus = inboxFilterStatus;
window.inboxFilterType = inboxFilterType;
window.inboxDrop = inboxDrop;
window.inboxArchive = inboxArchive;
window.inboxToDistill = inboxToDistill;
