// 视图：蒸馏库（up 主经验卡）。飞轮"蒸馏"环节的操作台：
// 取材(链接) → cmdtext 交接 skill 萃取 → 粘回产出 → kbSave 落 Obsidian 蒸馏库/ → 检索复用。
// 复用：/api/kb/deposits（列卡）、/api/kb/note（读）、window.kbSave（存）、window.cmdtext（交接指令）。
import { esc, jsStr } from "../core/util.js";
import { icon } from "../core/icons.js";
// 平台枚举与收件箱 inbox 共享，避免两处漂移（含 B站/小红书/微博/即刻/文章）
import { PLATFORMS, platform as _plat, platformBadge as _badge } from "../core/platforms.js";

var _deposits = [];   // /api/kb/deposits 结果（新→旧）
var _filter = "";     // 平台筛选（""=全部）
var _formPlat = "";   // 新蒸馏表单当前平台

// 六维拆解模板：交接给 skill 时明确要什么，保证产出可结构化成经验卡
function _distillCmd(plat, url) {
  var p = _plat(plat);
  if (!p) return "";
  var six = "核心观点 / 方法步骤 / 适用场景 / 边界反例 / 可复用动作 / 出处";
  if (p.skill === "creator-video-decoder") {
    return "用 creator-video-decoder 拆解以下 " + p.label + " " + p.kind + "，输出六维经验卡（" + six + "）：\n" + (url || "");
  }
  return "用 baoyu-url-to-markdown 抓取以下 " + p.label + " " + p.kind + " 转 markdown，再提炼成六维经验卡（" + six + "）：\n" + (url || "");
}

export function renderDistill() {
  var col = document.getElementById("col-distill");
  if (!col) return;
  col.innerHTML =
    '<div class="kb-layout">' +
      '<div class="kb-side">' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
          '<button class="button sm" onclick="distillNew()">' + icon("plus") + ' 新蒸馏</button>' +
          '<span class="kb-cnt" id="distillCnt"></span>' +
        '</div>' +
        '<div class="distill-filter" id="distillFilter"></div>' +
        '<div class="kb-tree" id="distillList"><div class="empty">加载中…</div></div>' +
      '</div>' +
      '<div class="kb-main"><div class="kb-reader" id="distillReader">' +
        '<div class="empty">选择左侧经验卡查看，或点「新蒸馏」蒸一条</div>' +
      '</div></div>' +
    '</div>';
  _drawFilter();
  fetch("/api/kb/deposits?module=" + encodeURIComponent("蒸馏库"))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.configured) { _listEmpty("未配置 depositRoot（见 docs/design/知识库沉淀存储方案.md）"); return; }
      _deposits = d.deposits || [];
      _drawList();
    })
    .catch(function () { _listEmpty("加载失败"); });
}

function _listEmpty(msg) { var el = document.getElementById("distillList"); if (el) el.innerHTML = '<div class="empty">' + esc(msg) + "</div>"; }

function _drawFilter() {
  var el = document.getElementById("distillFilter");
  if (!el) return;
  var chips = ['<button class="chip' + (_filter === "" ? " on" : "") + '" onclick="distillFilter(\'\')">全部</button>'];
  PLATFORMS.forEach(function (p) {
    chips.push('<button class="chip' + (_filter === p.v ? " on" : "") + '" onclick="distillFilter(' + "'" + jsStr(p.v) + "'" + ')">' + icon(p.ic) + " " + esc(p.label) + "</button>");
  });
  el.innerHTML = chips.join("");
}

function _drawList() {
  var el = document.getElementById("distillList");
  if (!el) return;
  var rows = _deposits.filter(function (r) { return !_filter || r.platform === _filter; });
  var cnt = document.getElementById("distillCnt");
  if (cnt) cnt.textContent = rows.length + " 张卡";
  if (!rows.length) { el.innerHTML = '<div class="empty">' + (_deposits.length ? "该平台暂无卡" : "还没有经验卡，点「新蒸馏」开始") + "</div>"; return; }
  el.innerHTML = rows.map(function (r) {
    var meta = [_badge(r.platform)];
    if (r.topic) meta.push(esc(r.topic));
    if (r.date) meta.push(esc(r.date));
    return '<div class="distill-card" onclick="distillOpen(' + "'" + jsStr(r.vaultPath || r.relPath || "") + "'" + ')">' +
      '<div class="dc-title">' + esc(r.title || r.fileName || "未命名") + "</div>" +
      '<div class="dc-meta">' + meta.join(" · ") + "</div></div>";
  }).join("");
}

function distillFilter(v) { _filter = v; _drawFilter(); _drawList(); }

function distillOpen(rel) {
  var box = document.getElementById("distillReader");
  if (!box || !rel) return;
  box.innerHTML = '<div class="empty">加载中…</div>';
  fetch("/api/kb/note?path=" + encodeURIComponent(rel))
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.note) { box.innerHTML = '<div class="empty">读取失败或不在库内</div>'; return; }
      var fm = j.note.fm || {};
      var body = j.note.body || "";
      var html = (window.marked && typeof window.marked.parse === "function")
        ? window.marked.parse(body) : "<pre>" + esc(body) + "</pre>";
      var chips = [];
      if (fm.platform) chips.push('<span class="dc-chip">' + _badge(fm.platform) + "</span>");
      if (fm.author) chips.push('<span class="dc-chip">' + icon("edit") + " " + esc(fm.author) + "</span>");
      if (fm.topic) chips.push('<span class="dc-chip"># ' + esc(fm.topic) + "</span>");
      if (fm.url) chips.push('<a class="dc-chip" href="' + esc(fm.url) + '" target="_blank" rel="noopener">' + icon("link") + " 原文</a>");
      box.innerHTML =
        '<div class="dc-head">' + chips.join(" ") + "</div>" +
        '<div class="kb-md">' + html + "</div>";
    })
    .catch(function () { box.innerHTML = '<div class="empty">加载失败</div>'; });
}

// ---- 新蒸馏表单（渲染在右侧阅读区，避免另加浮层） ----
// prefill: 可选 {url, platform}——由收件箱「→蒸馏」预填；无参时行为不变（向后兼容内联 onclick）
function distillNew(prefill) {
  if (prefill && typeof prefill === "object" && prefill.platform && _plat(prefill.platform)) _formPlat = prefill.platform;
  _formPlat = _formPlat || PLATFORMS[0].v;
  var box = document.getElementById("distillReader");
  if (!box) return;
  var platBtns = PLATFORMS.map(function (p) {
    return '<button class="chip' + (_formPlat === p.v ? " on" : "") + '" onclick="distillPickPlat(' + "'" + jsStr(p.v) + "'" + ')">' + icon(p.ic) + " " + esc(p.label) + "</button>";
  }).join("");
  box.innerHTML =
    '<div class="distill-form">' +
      "<h3>" + icon("plus") + " 新蒸馏一条经验卡</h3>" +
      '<div class="df-row"><label>平台</label><div class="distill-filter" id="dfPlat">' + platBtns + "</div></div>" +
      '<div class="df-row"><label>链接</label><input id="dfUrl" class="sf" placeholder="粘贴 B站/小红书/文章 链接"></div>' +
      '<div class="df-row"><label>作者</label><input id="dfAuthor" class="sf" placeholder="up 主 / 作者（可选）"></div>' +
      '<div class="df-row"><label>主题</label><input id="dfTopic" class="sf" placeholder="主题分类，如 RAG / Agent（可选）"></div>' +
      '<div class="df-step">① 复制蒸馏指令 → 到 AI 里跑（六维拆解）</div>' +
      '<button class="button sm" onclick="distillCopyCmd()">' + icon("copy") + ' 复制蒸馏指令</button>' +
      '<div class="df-step">② 把 AI 产出粘回来</div>' +
      '<div class="df-row"><label>标题</label><input id="dfTitle" class="sf" placeholder="经验卡标题（做文件名）"></div>' +
      '<textarea id="dfBody" rows="10" placeholder="把六维拆解产出粘这里（Markdown）…"></textarea>' +
      '<div class="df-row"><label>可复用动作</label><textarea id="dfAct" rows="3" placeholder="每行一条可复用动作（可选）"></textarea></div>' +
      '<div class="df-actions">' +
        '<span id="dfHint" class="empty"></span>' +
        '<button class="button sm ghost" onclick="distillCancel()">取消</button>' +
        '<button class="button sm" onclick="distillSave()">' + icon("download") + ' 保存进蒸馏库</button>' +
      "</div>" +
    "</div>";
  if (prefill && typeof prefill === "object" && prefill.url) {
    var u = document.getElementById("dfUrl");
    if (u) u.value = prefill.url;
  }
}

function distillPickPlat(v) {
  _formPlat = v;
  var el = document.getElementById("dfPlat");
  if (el) el.innerHTML = PLATFORMS.map(function (p) {
    return '<button class="chip' + (_formPlat === p.v ? " on" : "") + '" onclick="distillPickPlat(' + "'" + jsStr(p.v) + "'" + ')">' + icon(p.ic) + " " + esc(p.label) + "</button>";
  }).join("");
}

function distillCopyCmd() {
  var url = (document.getElementById("dfUrl") || {}).value || "";
  if (typeof window.cmdtext === "function") window.cmdtext(_distillCmd(_formPlat, url));
}

function distillCancel() { renderDistill(); }

function distillSave() {
  var g = function (id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; };
  var title = g("dfTitle"), body = g("dfBody"), url = g("dfUrl"), author = g("dfAuthor"), topic = g("dfTopic");
  var act = g("dfAct").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  var hint = document.getElementById("dfHint");
  if (!title) { if (hint) hint.textContent = "先填标题"; return; }
  if (!body) { if (hint) hint.textContent = "正文为空，先粘产出"; return; }
  if (typeof window.kbSave !== "function") { window.WB.dialog.alert("知识库模块未加载。"); return; }
  if (hint) hint.textContent = "保存中…";
  window.kbSave({
    module: "蒸馏库", source: "distill", title: title, body: body,
    extra: { platform: _formPlat, author: author, url: url, topic: topic, actionable: act }
  }).then(function (r) {
    if (r && r.ok) {
      // 若来源是收件箱「→蒸馏」，回标该条为已蒸馏（薄耦合，inbox.js 注册）
      if (typeof window.inboxOnDistilled === "function") window.inboxOnDistilled();
      window.WB.dialog.alert("已存入蒸馏库：\n" + (r.path || r.fileName || ""));
      renderDistill();
    } else if (hint) {
      hint.textContent = "保存失败：" + ((r && r.error) || "未知");
    }
  }).catch(function () { if (hint) hint.textContent = "保存失败（网络/后端）"; });
}

// ---- window 桥接（内联 onclick 用；遵项目"文件末尾挂自己的处理器"约定） ----
window.renderDistill = renderDistill;
window.distillFilter = distillFilter;
window.distillOpen = distillOpen;
window.distillNew = distillNew;
window.distillPickPlat = distillPickPlat;
window.distillCopyCmd = distillCopyCmd;
window.distillCancel = distillCancel;
window.distillSave = distillSave;
