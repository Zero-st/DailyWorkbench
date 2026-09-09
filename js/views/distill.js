// 视图：蒸馏库（up 主经验卡）。飞轮"蒸馏"环节的操作台：
// 取材(链接) → cmdtext 交接 skill 萃取 → 粘回产出 → kbSave 落 Obsidian 蒸馏库/ → 检索复用。
// 复用：/api/kb/deposits（列卡）、/api/kb/note（读）、window.kbSave（存）、window.cmdtext（交接指令）。
import { esc, jsStr } from "../core/util.js";
import { icon } from "../core/icons.js";
// 平台枚举与收件箱 inbox 共享，避免两处漂移（含 B站/小红书/微博/即刻/文章）
import { PLATFORMS, platform as _plat, platformBadge as _badge } from "../core/platforms.js";
// 蒸馏指令 + 六维 + tier：单一权威源（六维不再在此硬编码，见 core/distill-template.js）
import { buildDistillCmd, buildDistillAgentPrompt, TIERS } from "../core/distill-template.js";
// 页面直接蒸馏：流式驱动无头 agent（Phase 2，见 ADR 0009）
import { agentStream } from "../core/agent-stream.js";

var _deposits = [];   // /api/kb/deposits 结果（新→旧）
var _filter = "";     // 平台筛选（""=全部）
var _tier = "";       // tier 筛选（""=全部）
var _formPlat = "";   // 新蒸馏表单当前平台
var _formTier = "";   // 新蒸馏表单当前 tier（萃取端建议、人工确认后落库）
var _formExtra = null; // 来自收件箱「→蒸馏」的摘录/感悟（有则蒸馏指令走"据此提炼"）

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
  // tier 筛选行（内容价值分档，与平台筛选叠加）
  var tchips = ['<button class="chip' + (_tier === "" ? " on" : "") + '" onclick="distillTier(\'\')">全档</button>'];
  TIERS.forEach(function (t) {
    tchips.push('<button class="chip' + (_tier === t ? " on" : "") + '" onclick="distillTier(' + "'" + jsStr(t) + "'" + ')">' + esc(t) + "</button>");
  });
  el.innerHTML = chips.join("") + '<div class="distill-filter" style="margin-top:6px">' + tchips.join("") + "</div>";
}

function _drawList() {
  var el = document.getElementById("distillList");
  if (!el) return;
  var rows = _deposits.filter(function (r) {
    return (!_filter || r.platform === _filter) && (!_tier || r.tier === _tier);
  });
  var cnt = document.getElementById("distillCnt");
  if (cnt) cnt.textContent = rows.length + " 张卡";
  if (!rows.length) { el.innerHTML = '<div class="empty">' + (_deposits.length ? "该筛选下暂无卡" : "还没有经验卡，点「新蒸馏」开始") + "</div>"; return; }
  el.innerHTML = rows.map(function (r) {
    var meta = [_badge(r.platform)];
    if (r.tier) meta.push("tier " + esc(r.tier));
    if (r.topic) meta.push(esc(r.topic));
    if (r.date) meta.push(esc(r.date));
    return '<div class="distill-card" onclick="distillOpen(' + "'" + jsStr(r.vaultPath || r.relPath || "") + "'" + ')">' +
      '<div class="dc-title">' + esc(r.title || r.fileName || "未命名") + "</div>" +
      '<div class="dc-meta">' + meta.join(" · ") + "</div></div>";
  }).join("");
}

function distillFilter(v) { _filter = v; _drawFilter(); _drawList(); }
function distillTier(v) { _tier = v; _drawFilter(); _drawList(); }

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
      if (fm.tier) chips.push('<span class="dc-chip">tier ' + esc(fm.tier) + "</span>");
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
  _formExtra = (prefill && typeof prefill === "object" && (prefill.excerpt || prefill.note))
    ? { excerpt: prefill.excerpt || "", note: prefill.note || "" } : null;
  if (prefill && typeof prefill === "object" && prefill.platform && _plat(prefill.platform)) _formPlat = prefill.platform;
  _formPlat = _formPlat || PLATFORMS[0].v;
  _formTier = "";  // 每次新蒸馏重置：tier 由萃取端建议、人工据产出确认
  var box = document.getElementById("distillReader");
  if (!box) return;
  var platBtns = PLATFORMS.map(function (p) {
    return '<button class="chip' + (_formPlat === p.v ? " on" : "") + '" onclick="distillPickPlat(' + "'" + jsStr(p.v) + "'" + ')">' + icon(p.ic) + " " + esc(p.label) + "</button>";
  }).join("");
  var tierBtns = _tierBtnsHtml();
  box.innerHTML =
    '<div class="distill-form">' +
      "<h3>" + icon("plus") + " 新蒸馏一条经验卡</h3>" +
      '<div class="df-row"><label>平台</label><div class="distill-filter" id="dfPlat">' + platBtns + "</div></div>" +
      '<div class="df-row"><label>链接</label><input id="dfUrl" class="sf" placeholder="粘贴 B站/小红书/文章 链接"></div>' +
      '<div class="df-row"><label>作者</label><input id="dfAuthor" class="sf" placeholder="up 主 / 作者（可选）"></div>' +
      '<div class="df-row"><label>主题</label><input id="dfTopic" class="sf" placeholder="主题分类，如 RAG / Agent（可选）"></div>' +
      '<div class="df-step">① 萃取：直接跑 agent（自动 WebFetch 抓正文 + 六维拆解），或复制指令去别处跑</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<button class="button sm" id="dfRunBtn" onclick="distillRun()">' + icon("play") + ' 直接蒸馏</button>' +
        '<button class="button sm ghost" onclick="distillCopyCmd()">' + icon("copy") + ' 复制蒸馏指令</button>' +
      '</div>' +
      '<div class="agent-log" id="distillAgentLog" style="display:none"></div>' +
      '<div class="df-step">② 核对 AI 起草的卡（跑完自动填入，或手动粘回）</div>' +
      '<div class="df-row"><label>标题</label><input id="dfTitle" class="sf" placeholder="经验卡标题（做文件名）"></div>' +
      '<textarea id="dfBody" rows="10" placeholder="把六维拆解产出粘这里（Markdown）…"></textarea>' +
      '<div class="df-row"><label>价值分档</label><div class="distill-filter" id="dfTier">' + tierBtns + '</div></div>' +
      '<div class="df-row"><label>可复用动作</label><textarea id="dfAct" rows="3" placeholder="每行一条可复用动作（可选）"></textarea></div>' +
      '<div class="df-actions">' +
        '<span id="dfHint" class="empty"></span>' +
        '<button class="button sm ghost" onclick="distillCancel()">取消</button>' +
        '<button class="button sm" onclick="distillSave()">' + icon("download") + ' 保存进蒸馏库</button>' +
      "</div>" +
    "</div>";
  if (prefill && typeof prefill === "object") {
    if (prefill.url) {
      var u = document.getElementById("dfUrl");
      if (u) u.value = prefill.url;
    }
    // 摘录+感悟预填进正文区：即便不跑 skill，这张卡也已有可用内容
    if (prefill.excerpt || prefill.note) {
      var b = document.getElementById("dfBody");
      if (b && !b.value) {
        var pre = "";
        if (prefill.excerpt) pre += "> " + String(prefill.excerpt).replace(/\n/g, "\n> ") + "\n";
        if (prefill.note) pre += "\n**我的感悟**：" + prefill.note + "\n";
        b.value = pre;
      }
    }
  }
}

function distillPickPlat(v) {
  _formPlat = v;
  var el = document.getElementById("dfPlat");
  if (el) el.innerHTML = PLATFORMS.map(function (p) {
    return '<button class="chip' + (_formPlat === p.v ? " on" : "") + '" onclick="distillPickPlat(' + "'" + jsStr(p.v) + "'" + ')">' + icon(p.ic) + " " + esc(p.label) + "</button>";
  }).join("");
}

// tier 选择器 html（空档 + S/A/B/C/D）；萃取端在产出顶部给建议 tier，人工据此点选
function _tierBtnsHtml() {
  var btns = ['<button class="chip' + (_formTier === "" ? " on" : "") + '" onclick="distillPickTier(\'\')">未评</button>'];
  TIERS.forEach(function (t) {
    btns.push('<button class="chip' + (_formTier === t ? " on" : "") + '" onclick="distillPickTier(' + "'" + jsStr(t) + "'" + ')">' + esc(t) + "</button>");
  });
  return btns.join("");
}

function distillPickTier(v) {
  _formTier = v;
  var el = document.getElementById("dfTier");
  if (el) el.innerHTML = _tierBtnsHtml();
}

function distillCopyCmd() {
  var url = (document.getElementById("dfUrl") || {}).value || "";
  if (typeof window.cmdtext === "function") window.cmdtext(buildDistillCmd({ plat: _plat(_formPlat), url: url, extra: _formExtra }));
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
    extra: { platform: _formPlat, author: author, url: url, topic: topic, tier: _formTier, actionable: act }
  }).then(function (r) {
    if (r && r.ok) {
      // 若来源是收件箱「→蒸馏」，回标该条为已蒸馏（薄耦合，inbox.js 注册）
      if (typeof window.inboxOnDistilled === "function") window.inboxOnDistilled();
      _formExtra = null;
      window.WB.dialog.alert("已存入蒸馏库：\n" + (r.path || r.fileName || ""));
      renderDistill();
    } else if (hint) {
      hint.textContent = "保存失败：" + ((r && r.error) || "未知");
    }
  }).catch(function () { if (hint) hint.textContent = "保存失败（网络/后端）"; });
}

// ---- ▶ 直接蒸馏：页面里流式驱动无头 agent（Phase 2）----
// 只读 agent（WebFetch + kb 读工具）抓取 + 六维起草；产出自动填入正文区，人核对后点「保存进蒸馏库」落库。
var _running = false;
function distillRun() {
  if (_running) return;
  var url = ((document.getElementById("dfUrl") || {}).value || "").trim();
  var hint = document.getElementById("dfHint");
  if (!url && !(_formExtra && _formExtra.excerpt)) {
    if (hint) hint.textContent = "先填链接（或从收件箱带摘录进来）";
    return;
  }
  var prompt = buildDistillAgentPrompt({ plat: _plat(_formPlat), url: url, extra: _formExtra });
  var log = document.getElementById("distillAgentLog");
  var runBtn = document.getElementById("dfRunBtn");
  if (!log) return;
  log.style.display = "";
  log.innerHTML =
    '<div class="agent-metaline"><span class="m" id="daModel">启动 agent…</span>' +
    '<span style="margin-left:auto;color:var(--sub-2)">只读 · 不写库</span></div>' +
    '<div class="agent-steps" id="daSteps"><span class="agent-step run" id="daRun"><span class="agent-dot"></span> 运行中…</span></div>' +
    '<div class="ai-bot-body" id="daText" style="font-size:var(--text-sm);color:var(--ink)"></div>';
  if (runBtn) runBtn.disabled = true;
  if (hint) hint.textContent = "agent 运行中…";
  _running = true;
  var acc = "", started = false;
  var done = function () { _running = false; if (runBtn) runBtn.disabled = false; };
  agentStream({ task: "distill", payload: { prompt: prompt } }, {
    onMeta: function (ev) {
      if (ev.phase === "init") {
        var m = document.getElementById("daModel");
        if (m) m.textContent = (ev.model || "agent") + (Array.isArray(ev.mcp) && ev.mcp.length ? " · MCP✓" : "");
      }
    },
    onTool: function (ev) {
      var steps = document.getElementById("daSteps");
      if (!steps) return;
      var s = document.createElement("span");
      s.className = "agent-step done";
      s.innerHTML = '<span class="mk">✓</span> <span class="tname">' + esc(ev.name || "tool") + "</span>";
      var runEl = document.getElementById("daRun");
      if (runEl) steps.insertBefore(s, runEl); else steps.appendChild(s);
    },
    onText: function (t) {
      var el = document.getElementById("daText");
      if (!started && el) { el.textContent = ""; started = true; }
      acc += t;
      if (el) el.textContent = acc;
    },
    onResult: function (ev) {
      var r = document.getElementById("daRun"); if (r) r.remove();
      _fillDraft((acc || ev.text || "").trim());
      var m = document.getElementById("daModel");
      if (m) m.textContent += (typeof ev.cost_usd === "number" ? " · 完成 $" + ev.cost_usd.toFixed(3) : " · 完成");
      done();
    },
    onError: function (ev) {
      var r = document.getElementById("daRun"); if (r) r.remove();
      var el = document.getElementById("daText");
      var msg = (ev && ev.error) || "出错";
      if (ev && ev.configured === false) msg = "agent 未配置：在 workbench.local.json 设 claudeCmd（或 PATH 有 claude），重开后端后再试。复制指令去 Claude Code 跑是离线退路。";
      if (el) el.textContent = "⚠️ " + msg;
      if (hint) hint.textContent = "";
      done();
    }
  });
}

// 起草卡回填：填正文区，尽量从卡里抽标题 + tier（人可改）；不自动保存（写库=人工点「保存」闸）。
function _fillDraft(cardMd) {
  if (!cardMd) return;
  var body = document.getElementById("dfBody");
  if (body) body.value = cardMd;
  var titleEl = document.getElementById("dfTitle");
  if (titleEl && !titleEl.value) {
    var line = cardMd.split("\n")
      .map(function (s) { return s.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim(); })
      .filter(function (s) { return s && !/^tier\s*[:：]/i.test(s); })[0] || "";
    titleEl.value = line.slice(0, 40);
  }
  var mt = cardMd.match(/tier\s*[:：]\s*([SABCD])/i);
  if (mt) distillPickTier(mt[1].toUpperCase());
  var hint = document.getElementById("dfHint");
  if (hint) hint.textContent = "AI 起草完成 · 请核对后点「保存进蒸馏库」";
}

// ---- window 桥接（内联 onclick 用；遵项目"文件末尾挂自己的处理器"约定） ----
window.renderDistill = renderDistill;
window.distillFilter = distillFilter;
window.distillTier = distillTier;
window.distillOpen = distillOpen;
window.distillNew = distillNew;
window.distillPickPlat = distillPickPlat;
window.distillPickTier = distillPickTier;
window.distillCopyCmd = distillCopyCmd;
window.distillRun = distillRun;
window.distillCancel = distillCancel;
window.distillSave = distillSave;
