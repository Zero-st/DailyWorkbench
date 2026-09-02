// kb.js — 知识库模块（Obsidian vault 浏览/检索/双链 + @提及 + 沉淀写入）
// 依赖：vendor/marked.min.js。IIFE + window.WB 模式（仿 model-manager.js）
(function () {
  "use strict";
  var WB = window.WB = window.WB || {};
  if (window.marked) { try { window.marked.setOptions({ gfm: true, breaks: false }); } catch (e) {} }

  var TREE = null, NAME2PATH = {}, SIG = null, MCACHE = {};
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nameOf(rel) { var p = rel.split("/"); return p[p.length - 1].replace(/\.md$/i, ""); }
  function jq(urisafe) { try { return decodeURIComponent(urisafe); } catch (e) { return urisafe; } }

  function buildIndex(d) {
    TREE = d; NAME2PATH = {}; SIG = d.sig;
    (d.files || []).forEach(function (f) { var n = nameOf(f.rel); (NAME2PATH[n] = NAME2PATH[n] || []).push(f.rel); });
  }

  // ---- 树 ----
  function buildTree(files) {
    var root = { kids: {}, files: [] };
    files.forEach(function (f) {
      var parts = f.rel.split("/"), node = root;
      for (var i = 0; i < parts.length - 1; i++) {
        var seg = parts[i];
        node.kids[seg] = node.kids[seg] || { kids: {}, files: [] };
        node = node.kids[seg];
      }
      node.files.push(f);
    });
    return root;
  }
  function drawTree() {
    var box = document.getElementById("kbTree");
    if (!box) return;
    if (!TREE || !TREE.files || !TREE.files.length) { box.innerHTML = '<div class="empty">未配置 vault 或无 .md 文件</div>'; return; }
    var root = buildTree(TREE.files), html = "";
    Object.keys(root.kids).sort().forEach(function (k) { html += renderNode(root.kids[k], k, 0); });
    root.files.forEach(function (f) { html += fileItem(f, 0); });
    box.innerHTML = html;
  }
  function renderNode(node, name, depth) {
    var h = '<div class="kb-dir" style="margin-left:' + (depth * 12) + 'px">';
    h += '<div class="kb-dir-h" onclick="kbToggleDir(this)"><span class="kb-tw">▾</span>' + WB.ic("folder") + ' ' + esc(name) + '</div><div class="kb-dir-b">';
    Object.keys(node.kids).sort().forEach(function (k) { h += renderNode(node.kids[k], k, depth + 1); });
    node.files.forEach(function (f) { h += fileItem(f, depth + 1); });
    return h + '</div></div>';
  }
  function fileItem(f, depth) {
    var rel = f.rel.replace(/'/g, "\\'");
    return '<div class="kb-file" style="margin-left:' + (12 + depth * 12) + 'px" onclick="kbOpenNote(\'' + esc(rel) + '\')" title="' + esc(f.rel) + '">' + WB.ic("fileText") + ' ' + esc(nameOf(f.rel)) + '</div>';
  }
  function kbToggleDir(el) {
    var b = el.nextElementSibling; if (!b) return;
    var open = b.style.display !== "none"; b.style.display = open ? "none" : "block";
    el.querySelector(".kb-tw").textContent = open ? "▸" : "▾";
  }

  // ---- Obsidian 语法预处理 ----
  function preprocess(raw) {
    var codes = [], inl = [];
    raw = raw.replace(/```[\s\S]*?```/g, function (m) { codes.push(m); return "\u0000C" + (codes.length - 1) + "\u0000"; });
    raw = raw.replace(/`[^`\n]+`/g, function (m) { inl.push(m); return "\u0000I" + (inl.length - 1) + "\u0000"; });
    raw = raw.replace(/!\[\[([^\]]+)\]\]/g, function (_, x) { return "[嵌入:" + x + "](#kb:embed:" + encodeURIComponent(x) + ")"; });
    raw = raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, function (_, x, y) { return "[" + y + "](#kb:name:" + encodeURIComponent(x.trim()) + ")"; });
    raw = raw.replace(/\[\[([^\]]+)\]\]/g, function (_, x) { return "[" + x + "](#kb:name:" + encodeURIComponent(x.trim()) + ")"; });
    raw = raw.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
    raw = raw.replace(/^([^\n#>]*?)(#[\u4e00-\u9fa5\w-]+)/gm, function (_, pre, tag) { return pre + "[§" + tag.slice(1) + "](#kb:tag:" + encodeURIComponent(tag.slice(1)) + ")"; });
    raw = raw.replace(/\u0000I(\d+)\u0000/g, function (_, i) { return inl[+i]; });
    raw = raw.replace(/\u0000C(\d+)\u0000/g, function (_, i) { return codes[+i]; });
    return raw;
  }
  function postprocess(html) {
    return html.replace(/<blockquote>\s*<p>\[!(\w+)\]([\s\S]*?)<\/p>\s*<\/blockquote>/g, function (_, t, rest) {
      return '<div class="kb-callout kb-co-' + t.toLowerCase() + '"><b>' + t + '</b>' + rest + '</div>';
    });
  }

  // ---- 渲染笔记 ----
  function renderNote(note) {
    var reader = document.getElementById("kbReader");
    if (!reader) return;
    if (!note || note.error) { reader.innerHTML = '<div class="empty">' + esc((note && note.error) || "读取失败") + '</div>'; return; }
    var fm = note.fm || {}, fmHtml = '<div class="kb-fm">';
    if (Object.keys(fm).length) {
      if (fm.title) fmHtml += '<b>' + esc(fm.title) + '</b> ';
      if (fm.date) fmHtml += '<span class="kb-fm-d">' + esc(fm.date) + '</span> ';
      if (fm.module) fmHtml += '<span class="kb-fm-m">' + esc(fm.module) + '</span> ';
      var tags = fm.tags; if (typeof tags === "string") tags = [tags];
      if (Array.isArray(tags)) fmHtml += tags.map(function (t) { return '<span class="kb-tag" onclick="kbSearch(\'tag:' + encodeURIComponent(t) + '\')">#' + esc(t) + '</span>'; }).join("");
    }
    fmHtml += '<span class="kb-fm-path">' + esc(note.path) + '</span></div>';
    var body = note.body || "", html;
    try { html = window.marked ? postprocess(window.marked.parse(preprocess(body))) : "<pre>" + esc(body) + "</pre>"; }
    catch (e) { html = "<pre>" + esc(body) + "</pre>"; }
    reader.innerHTML = fmHtml + '<div class="kb-md">' + html + '</div>';
    reader.scrollTop = 0;
    // 内部链接拦截
    reader.querySelectorAll('a[href^="#kb:"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var p = a.getAttribute("href").slice(4).split(":");
        var kind = p[0], val = jq(p.slice(1).join(":"));
        if (kind === "name") kbOpenByName(val);
        else if (kind === "tag") kbSearch("tag:" + val);
        else if (kind === "embed") { if (window.WB && WB.dialog) WB.dialog.alert("嵌入: " + val + "（库内嵌入暂以链接形式呈现）"); }
      });
    });
  }

  function kbOpenNote(rel) {
    var reader = document.getElementById("kbReader");
    if (reader) reader.innerHTML = '<div class="empty">加载中…</div>';
    fetch("/api/kb/note?path=" + encodeURIComponent(rel)).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.configured) { renderNote({ error: "未配置 vault" }); return; }
      renderNote(j.note);
    }).catch(function () { renderNote({ error: "请求失败" }); });
  }
  function kbOpenByName(name) {
    var arr = NAME2PATH[name];
    if (!arr || !arr.length) { if (WB.dialog) WB.dialog.alert("未找到笔记: " + name); return; }
    if (arr.length === 1) { kbOpenNote(arr[0]); return; }
    // 重名选择
    var html = arr.map(function (r, i) { return '<div class="kb-pick" onclick="kbOpenNote(\'' + r.replace(/'/g, "\\'") + '\');kbClosePick()">' + WB.ic("fileText") + ' ' + esc(r) + '</div>'; }).join("");
    var ov = document.getElementById("kbPick");
    if (!ov) { ov = document.createElement("div"); ov.id = "kbPick"; ov.className = "kb-pick-pop"; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="kb-pick-h">选择笔记<button class="kb-pick-x" onclick="kbClosePick()">✕</button></div>' + html;
    ov.style.display = "block";
  }
  function kbClosePick() { var ov = document.getElementById("kbPick"); if (ov) ov.style.display = "none"; }

  // ---- 检索 ----
  function kbSearch(q) {
    if (!q) return;
    var type = "full", term = q;
    if (q.indexOf("tag:") === 0) { type = "tag"; term = q.slice(4); }
    else if (q.indexOf("title:") === 0) { type = "title"; term = q.slice(6); }
    var reader = document.getElementById("kbReader");
    if (reader) reader.innerHTML = '<div class="empty">检索中…</div>';
    fetch("/api/kb/search?q=" + encodeURIComponent(term) + "&type=" + type).then(function (r) { return r.json(); }).then(function (j) {
      var rs = j.results || [];
      if (!rs.length) { if (reader) reader.innerHTML = '<div class="empty">无匹配结果</div>'; return; }
      var h = '<div class="kb-rs-head">检索 "' + esc(term) + '"（' + type + '）· ' + rs.length + ' 条</div>';
      rs.forEach(function (r) {
        h += '<div class="kb-rs" onclick="kbOpenNote(\'' + r.path.replace(/'/g, "\\'") + '\')"><div class="kb-rs-t">' + esc(r.title) + '</div><div class="kb-rs-p">' + esc(r.path) + '</div><div class="kb-rs-s">' + esc(r.snippet) + '</div></div>';
      });
      if (reader) reader.innerHTML = h;
    }).catch(function () { if (reader) reader.innerHTML = '<div class="empty">检索失败</div>'; });
  }

  // ---- @提及 ----
  function kbMentionList(query) {
    var q = (query || "").toLowerCase(), out = [];
    Object.keys(NAME2PATH).forEach(function (n) {
      if (!q || n.toLowerCase().indexOf(q) >= 0) out.push({ name: n, rel: NAME2PATH[n][0] });
    });
    return out.slice(0, 12);
  }
  function kbGetMentionBody(rel) { return MCACHE[rel] || null; }
  function kbLoadMention(rel) {
    return fetch("/api/kb/note?path=" + encodeURIComponent(rel)).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.note && j.note.body != null) { MCACHE[rel] = j.note.body; return j.note.body; }
      return null;
    }).catch(function () { return null; });
  }

  // ---- 沉淀写入 ----
  function kbSave(opt) {
    var payload = { module: opt.module, source: opt.source, title: opt.title, body: opt.body };
    if (opt.extra) payload.extra = opt.extra;  // 经验卡等额外元数据（platform/author/url/topic/actionable）
    return fetch("/api/kb/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  // ---- 主渲染 ----
  function renderKb() {
    var col = document.getElementById("col-kb");
    if (!col) return;
    col.innerHTML =
      '<div class="kb-layout">' +
        '<div class="kb-side">' +
          '<div class="kb-search"><input id="kbQ" class="sf" placeholder="检索（回车全文；tag:xx / title:xx）" onkeydown="if(event.key===\'Enter\')kbSearch(this.value)"><span class="kb-cnt" id="kbCnt"></span></div>' +
          '<div class="kb-acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
            '<button class="btn-sm" onclick="cmdtext(\'在 knowledge-base/ 新建一篇笔记，主题：\')">' + WB.ic("plus") + ' 新建笔记</button>' +
            '<button class="btn-sm" onclick="switchView(\'distill\')">蒸馏经验卡</button>' +
            '<button class="btn-sm" onclick="var q=document.getElementById(\'kbQ\');if(q){q.focus();q.select();}">' + WB.ic("search") + ' 搜索</button>' +
          '</div>' +
          '<div class="kb-tree" id="kbTree"><div class="empty">加载中…</div></div>' +
        '</div>' +
        '<div class="kb-main"><div class="kb-reader" id="kbReader"><div class="empty">选择左侧笔记查看，或在上方检索</div></div></div>' +
      '</div>';
    fetch("/api/kb/tree").then(function (r) { return r.json(); }).then(function (d) {
      if (!d.configured) { var t = document.getElementById("kbTree"); if (t) t.innerHTML = '<div class="empty">未配置 kb.local.json</div>'; return; }
      buildIndex(d); drawTree();
      var c = document.getElementById("kbCnt"); if (c) c.textContent = (d.files || []).length + " 篇";
    }).catch(function () { var t = document.getElementById("kbTree"); if (t) t.innerHTML = '<div class="empty">加载失败</div>'; });
  }

  // ---- 轮询同步（30s，sig 变化才重建树；与 app.js maybeReload 同节奏） ----
  setInterval(function () {
    if (typeof __view !== "undefined" && window.__view !== "kb") return;
    if (!document.getElementById("kbTree")) return;
    fetch("/api/kb/tree").then(function (r) { return r.json(); }).then(function (d) {
      if (d.configured && d.sig !== SIG) { buildIndex(d); drawTree(); }
    }).catch(function () {});
  }, 30000);

  // ---- 暴露 ----
  window.renderKb = renderKb;
  window.kbOpenNote = kbOpenNote;
  window.kbOpenByName = kbOpenByName;
  window.kbToggleDir = kbToggleDir;
  window.kbClosePick = kbClosePick;
  window.kbSearch = kbSearch;
  window.kbMentionList = kbMentionList;
  window.kbGetMentionBody = kbGetMentionBody;
  window.kbLoadMention = kbLoadMention;
  window.kbSave = kbSave;

  // ---- 启动时预加载索引（让 @提及在未打开知识库视图时也能用） ----
  fetch("/api/kb/tree").then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.configured) buildIndex(d);
  }).catch(function () {});
})();
