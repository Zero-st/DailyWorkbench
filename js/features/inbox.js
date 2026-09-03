// 视图：捕获收件箱（inbox）。飞轮"捕获"环节的低摩擦落点。
// 两条捕获路径都汇到这里：
//   ① 浏览器扩展（extension/）——读帖当场选中摘录 + 写感悟，POST /api/inbox/add
//   ② 工作台内秒存 / 拖拽——粘链接或敲一句想法
// 之后一键「→蒸馏」升级成六维经验卡（摘录会内嵌进蒸馏指令，绕过平台反爬），或「归档」进知识库。
//
// 数据层：**API 优先 + 离线队列**。后端 inbox.local.json 是真源；后端不可达时写
// localStorage 队列（标 pending），下次拉取成功自动补推——守住"离线可跑"北极星。
// 复用：js/core/platforms.js（平台枚举/识别）、window.distillNew（蒸馏）、window.kbSave（归档）。
// 设计见 docs/design/捕获收件箱-浏览器扩展-设计.md。
import { esc, escAttr, undoSnack } from "../core/util.js";
import { icon } from "../core/icons.js";
import { platformBadge, detectPlatform } from "../core/platforms.js";

var INBOX_KEY = "wb_inbox";          // 离线缓存 + 待推队列
var _items = [];                     // 当前列表（渲染用）
var _online = true;                  // 上次与后端通信是否成功
var _statusFilter = "";              // ""=全部 / 待处理 / 已蒸馏 / 已归档
var _typeFilter = "";                // ""=全部 / clip / idea
var _pendingId = null;               // 正在「→蒸馏」的条目 id

// ---------- 本地缓存/队列 ----------
function _cacheLoad() {
  try { return JSON.parse(localStorage.getItem(INBOX_KEY) || "[]"); } catch (e) { return []; }
}
function _cacheSave(list) {
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(list)); } catch (e) {}
}
// 兼容旧版纯 localStorage 数据（无 pending 标记的历史条目视为待推）
export function inboxLoad() { return _cacheLoad(); }

function _api(path, body) {
  var opt = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined;
  return fetch(path, opt).then(function (r) { return r.json(); });
}

// 把本地队列补推到后端；成功即从队列移除。
// 队列里的一切都是"后端还没有的东西"，所以不筛 pending——**旧版纯 localStorage 时代
// 留下的条目没有 pending 标记，若只推 pending 它们会永远留在本地、上线后还从列表消失**。
// 串行而非 Promise.all：并行会让多个请求同时进后端的读-改-写，也让"移除已推条目"
// 互相覆盖（各自基于旧快照 _cacheSave）。串行下顺序确定、无竞态。
function _flush() {
  var q = _cacheLoad();
  if (!q.length) return Promise.resolve(0);
  var n = 0;
  return q.reduce(function (chain, it) {
    return chain.then(function () {
      var payload = {
        type: it.type, url: it.url, title: it.title, excerpt: it.excerpt,
        note: it.note, tags: it.tags, platform: it.platform, source: it.source || "web"
      };
      return _api("/api/inbox/add", payload).then(function (r) {
        if (r && r.ok) {
          _cacheSave(_cacheLoad().filter(function (x) { return x.id !== it.id; }));
          n++;
        }
      }).catch(function () { /* 单条失败不阻断后面的，留在队列下次再推 */ });
    });
  }, Promise.resolve()).then(function () { return n; });
}

// 拉列表：API 优先，失败退本地缓存
function _pull() {
  return _api("/api/inbox").then(function (r) {
    if (!r || !r.ok) throw new Error("bad");
    _online = true;
    return _flush().then(function (n) {
      if (!n) return r.items || [];
      // 有补推成功的，再拉一次拿到权威列表
      return _api("/api/inbox").then(function (r2) { return (r2 && r2.items) || r.items || []; });
    });
  }).catch(function () {
    _online = false;
    return _cacheLoad();
  });
}

function _fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + "-" + d.getDate(); }
// 卡片标题 + 它取自哪个字段。渲染时据 from 隐藏重复行——否则"感悟"会同时
// 出现在标题和感悟行（工作台存的条目没有 title，标题会回退用感悟）。
function _titleOf(it) {
  if (it.title && it.title.trim()) return { t: it.title.trim(), from: "title" };
  if (it.note && it.note.trim()) return { t: it.note.trim(), from: "note" };
  if (it.url) return { t: it.url, from: "url" };
  if (it.excerpt && it.excerpt.trim()) return { t: it.excerpt.trim().slice(0, 60), from: "excerpt" };
  return { t: "未命名", from: "none" };
}
function _find(id) { for (var i = 0; i < _items.length; i++) if (_items[i].id === id) return _items[i]; return null; }
// 平台兜底：扩展保存时不带 platform（设计上 Python 侧不复制域名表），故渲染/蒸馏时按 url 现算
function _plat(it) { return it.platform || detectPlatform(it.url || "") || ""; }
function _isInboxActive() { var v = document.getElementById("view-inbox"); return v && v.classList.contains("active"); }
function _hint(msg) { var h = document.getElementById("ibHint"); if (h) h.textContent = msg || ""; }

// ---------- 主渲染 ----------
export function renderInbox() {
  var col = document.getElementById("col-inbox");
  if (!col) return;
  col.innerHTML =
    '<div class="inbox-wrap">' +
      '<div class="card inbox-capture" id="ibDrop" ondragover="inboxDragOver(event)" ondragleave="inboxDragLeave(event)" ondrop="inboxDrop(event)">' +
        '<h2>' + icon("inbox") + ' 秒存一条 <span class="ib-conn" id="ibConn"></span></h2>' +
        '<div class="ib-row"><input id="ibUrl" class="sf" placeholder="粘贴帖子链接（小红书/B站/微博/即刻/文章），或留空只记想法" oninput="inboxDetect()" onkeydown="if(event.key===\'Enter\')inboxAdd()"></div>' +
        '<div class="ib-plat"><span class="ib-plat-lbl">平台</span><span id="ibPlat" class="chip on">想法</span>' +
          '<span class="ib-drop-tip">也可把选中文字或链接直接拖到这张卡上</span></div>' +
        '<div class="ib-row"><textarea id="ibExcerpt" class="sf ib-ta" rows="2" placeholder="摘录：帖子里那段精华（可选；扩展会自动填这里）"></textarea></div>' +
        '<div class="ib-row"><input id="ibNote" class="sf" placeholder="感悟：为什么值得存（想法类必填，剪藏建议填）" onkeydown="if(event.key===\'Enter\')inboxAdd()"></div>' +
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
  inboxDetect();
  _reload();
}

function _reload() {
  return _pull().then(function (items) {
    _items = items || [];
    _drawConn();
    _drawList();
  });
}

function _drawConn() {
  var el = document.getElementById("ibConn");
  if (!el) return;
  var pend = _cacheLoad().length;   // 队列里的一切都还没上后端（含旧版遗留条目）
  if (_online) {
    el.className = "ib-conn ok";
    el.textContent = pend ? "已连后端 · " + pend + " 条待补推" : "已连后端";
  } else {
    el.className = "ib-conn warn";
    el.textContent = "离线暂存" + (pend ? " · " + pend + " 条待推" : "");
  }
}

function _drawFilter() {
  var el = document.getElementById("ibFilter");
  if (!el) return;
  var chip = function (label, active, fn) {
    return '<button class="chip' + (active ? " on" : "") + '" onclick="' + fn + '">' + esc(label) + "</button>";
  };
  el.innerHTML = [
    chip("全部", _statusFilter === "", "inboxFilterStatus('')"),
    chip("待处理", _statusFilter === "待处理", "inboxFilterStatus('待处理')"),
    chip("已蒸馏", _statusFilter === "已蒸馏", "inboxFilterStatus('已蒸馏')"),
    chip("已归档", _statusFilter === "已归档", "inboxFilterStatus('已归档')"),
    '<span class="ib-filter-sep"></span>',
    chip("剪藏", _typeFilter === "clip", "inboxFilterType('clip')"),
    chip("灵感", _typeFilter === "idea", "inboxFilterType('idea')")
  ].join("");
}

function _drawList() {
  var el = document.getElementById("inboxList");
  if (!el) return;
  var rows = _items.filter(function (r) {
    return (!_statusFilter || r.status === _statusFilter) && (!_typeFilter || r.type === _typeFilter);
  });
  var cnt = document.getElementById("inboxCnt");
  if (cnt) cnt.textContent = rows.length + " / " + _items.length + " 条";
  if (!rows.length) {
    el.innerHTML = '<div class="empty">' + (_items.length ? "该筛选下暂无条目" : "还没有捕获。装上浏览器扩展后，读帖时选中一段就能存～") + "</div>";
    return;
  }
  el.innerHTML = rows.map(function (r) {
    var _ti = _titleOf(r);
    var meta = [];
    meta.push(r.type === "clip" ? platformBadge(_plat(r)) : icon("edit") + " 灵感");
    meta.push('<span class="ib-status ib-st-' + _stClass(r.status) + '">' + esc(r.status || "待处理") + "</span>");
    if (r.source === "ext") meta.push('<span class="ib-src">扩展</span>');
    if (r.pending) meta.push('<span class="ib-src warn">待推</span>');
    if (r.at) meta.push(_fmtDate(r.at));
    var tags = (r.tags || []).map(function (t) { return '<span class="ib-tag"># ' + esc(t) + "</span>"; }).join(" ");
    var acts = [];
    if (r.type === "clip" && r.status !== "已蒸馏") acts.push('<button class="button sm" onclick="inboxToDistill(' + "'" + esc(r.id) + "'" + ')">' + icon("beaker") + " →蒸馏</button>");
    if (r.status !== "已归档") acts.push('<button class="button sm ghost" onclick="inboxArchive(' + "'" + esc(r.id) + "'" + ')">' + icon("archive") + " 归档</button>");
    if (r.url) acts.push('<a class="button sm ghost" href="' + escAttr(r.url) + '" target="_blank" rel="noopener">' + icon("link") + " 原文</a>");
    acts.push('<button class="nd" title="删除" onclick="inboxDropItem(' + "'" + esc(r.id) + "'" + ')">✕</button>');
    return '<div class="distill-card ib-card">' +
      '<div class="dc-title">' + esc(_ti.t) + "</div>" +
      '<div class="dc-meta">' + meta.join(" · ") + "</div>" +
      (r.excerpt && _ti.from !== "excerpt" ? '<blockquote class="ib-excerpt">' + esc(r.excerpt) + "</blockquote>" : "") +
      (r.note && _ti.from !== "note" ? '<div class="ib-note">' + icon("edit") + " " + esc(r.note) + "</div>" : "") +
      (tags ? '<div class="ib-tags">' + tags + "</div>" : "") +
      '<div class="ib-card-acts">' + acts.join(" ") + "</div>" +
      "</div>";
  }).join("");
}
function _stClass(s) { return s === "已蒸馏" ? "done" : (s === "已归档" ? "arch" : "todo"); }

// ---------- 捕获 ----------
function inboxDetect() {
  var url = ((document.getElementById("ibUrl") || {}).value || "").trim();
  var badge = document.getElementById("ibPlat");
  if (badge) badge.innerHTML = url ? platformBadge(detectPlatform(url)) : "想法";
}

function inboxAdd() {
  var g = function (id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; };
  var url = g("ibUrl"), note = g("ibNote"), excerpt = g("ibExcerpt"), tagStr = g("ibTags");
  if (!url && !note && !excerpt) { _hint("先粘链接，或写一句想法/摘录"); return; }
  var payload = {
    type: url ? "clip" : "idea",
    url: url, title: "", excerpt: excerpt, note: note,
    tags: tagStr.split(/[\s,，]+/).filter(Boolean),
    platform: url ? detectPlatform(url) : "",
    source: "web"
  };
  _hint("保存中…");
  _api("/api/inbox/add", payload).then(function (r) {
    if (!r || !r.ok) throw new Error("bad");
    _online = true;
    _clearForm();
    _hint(r.deduped ? "✓ 已存在（去重）" : "✓ 已存");
    return _reload();
  }).catch(function () {
    // 后端不可达：写离线队列，仍然"秒存成功"
    _online = false;
    var local = _cacheLoad();
    var item = payload;
    item.id = "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    item.status = "待处理";
    item.at = Date.now();
    item.pending = true;
    local.unshift(item);
    _cacheSave(local);
    _items = local;
    _clearForm();
    _hint("✓ 已离线暂存（后端恢复后自动补推）");
    _drawConn();
    _drawList();
  });
}
function _clearForm() {
  ["ibUrl", "ibExcerpt", "ibNote", "ibTags"].forEach(function (id) {
    var e = document.getElementById(id); if (e) e.value = "";
  });
  inboxDetect();
}

// ---------- 拖拽即存（双窗口并排时零点击） ----------
function inboxDragOver(ev) { ev.preventDefault(); var c = document.getElementById("ibDrop"); if (c) c.classList.add("ib-dragging"); }
function inboxDragLeave(ev) { var c = document.getElementById("ibDrop"); if (c) c.classList.remove("ib-dragging"); }
function inboxDrop(ev) {
  ev.preventDefault();
  var c = document.getElementById("ibDrop"); if (c) c.classList.remove("ib-dragging");
  var dt = ev.dataTransfer; if (!dt) return;
  var uri = (dt.getData("text/uri-list") || "").trim();
  var text = (dt.getData("text/plain") || "").trim();
  var url = uri || (/^https?:\/\//i.test(text) ? text : "");
  var u = document.getElementById("ibUrl"), x = document.getElementById("ibExcerpt");
  if (url && u) u.value = url;
  if (!url && text && x) x.value = text;            // 拖的是选中文字 → 当摘录
  if (url && text && text !== url && x) x.value = text;
  inboxDetect();
  _hint("已接收拖拽内容，补一句感悟后回车");
  var n = document.getElementById("ibNote"); if (n) n.focus();
}

function inboxFilterStatus(v) { _statusFilter = v; _drawFilter(); _drawList(); }
function inboxFilterType(v) { _typeFilter = (_typeFilter === v ? "" : v); _drawFilter(); _drawList(); }

// ---------- 条目动作 ----------
function _patch(id, patch) {
  return _api("/api/inbox/update", { id: id, patch: patch }).then(function (r) {
    if (!r || !r.ok) throw new Error("bad");
    return _reload();
  });
}

function inboxDropItem(id) {
  var it = _find(id);
  if (!it) return;
  if (it.pending) {   // 未推成功的本地条目，直接从队列删
    _cacheSave(_cacheLoad().filter(function (x) { return x.id !== id; }));
    _items = _items.filter(function (x) { return x.id !== id; });
    _drawConn(); _drawList();
    return;
  }
  _api("/api/inbox/delete", { id: id }).then(function () { return _reload(); })
    .then(function () {
      undoSnack("已删除捕获", function () {
        _api("/api/inbox/add", {
          type: it.type, url: it.url, title: it.title, excerpt: it.excerpt,
          note: it.note, tags: it.tags, platform: it.platform, source: it.source
        }).then(function () { _reload(); });
      });
    })
    .catch(function () { _hint("删除失败（后端不可达）"); });
}

// 归档：值得留的 → kbSave 一份到 Obsidian 收件箱/；并标记已归档
function inboxArchive(id) {
  var it = _find(id);
  if (!it) return;
  var mark = function (msg) { _patch(id, { status: "已归档" }).then(function () { _hint(msg); }).catch(function () { _hint(msg + "（状态未同步）"); }); };
  if (typeof window.kbSave !== "function") { mark("已归档（后端未加载，未写入知识库）"); return; }
  var body = [];
  if (it.excerpt) body.push("> " + it.excerpt.replace(/\n/g, "\n> "));
  if (it.note) body.push("\n**我的感悟**：" + it.note);
  if (it.url) body.push("\n原文：" + it.url);
  window.kbSave({
    module: "收件箱", source: "note",
    title: _titleOf(it).t.slice(0, 40), body: body.join("\n"),
    extra: { platform: _plat(it), url: it.url || "", topic: (it.tags || []).join(" "), actionable: [] }
  }).then(function (r) {
    mark(r && r.ok ? "已归档进知识库：" + (r.fileName || r.path || "") : "已归档（写库失败）");
  }).catch(function () { mark("已归档（后端不可达，未写入知识库）"); });
}

// 升级为蒸馏：跳蒸馏库、预填链接+平台+摘录+感悟
function inboxToDistill(id) {
  var it = _find(id);
  if (!it) return;
  _pendingId = id;
  if (typeof window.switchView === "function") window.switchView("distill");
  if (typeof window.distillNew === "function") {
    window.distillNew({ url: it.url, platform: _plat(it) || "article", excerpt: it.excerpt, note: it.note });
  }
}

// 由 distill.js 保存成功后回调（薄耦合）：把来源条目标记已蒸馏
window.inboxOnDistilled = function () {
  if (!_pendingId) return;
  var id = _pendingId;
  _pendingId = null;
  _patch(id, { status: "已蒸馏" }).catch(function () {});
};

// ---- window 桥接（内联 onclick 用；遵项目"文件末尾挂处理器"约定） ----
window.renderInbox = renderInbox;
window.inboxDetect = inboxDetect;
window.inboxAdd = inboxAdd;
window.inboxFilterStatus = inboxFilterStatus;
window.inboxFilterType = inboxFilterType;
window.inboxDropItem = inboxDropItem;
window.inboxArchive = inboxArchive;
window.inboxToDistill = inboxToDistill;
window.inboxDragOver = inboxDragOver;
window.inboxDragLeave = inboxDragLeave;
window.inboxDrop = inboxDrop;
