// 资讯检索/筛选（叠加式面板）：平时 6 个源块照旧；一旦有 关键词/标签/来源 筛选
// 或 语义查询，就隐藏源块、显示统一结果面板（复用 info.js 的 renderCard 同款卡片）。
//
// 两种匹配（见「图先行」第一性拆解）：
//   词面 = 关键词/标签/来源，纯客户端 over 当日 data，离线即时；
//   语义 = POST /api/info/search（后端 embed 查询 → Zilliz 近邻），token 只在后端。
// 语义未配置（后端回 configured:false）→ 隐藏语义输入，只留客户端筛选，优雅降级。
import { esc, escAttr, jsStr, ic } from "../core/util.js";
import { fetchT } from "../core/net.js";

var _flat = [];            // 当日全部条目（扁平）
var _renderCard = null;    // info.js 注入的卡片渲染器
var _kw = "";              // 关键词
var _semQ = "";            // 语义输入框当前文字（持久化，防 bar 重渲染丢失）
var _src = {};             // 选中来源集合 {源名:true}
var _tags = {};            // 选中标签集合 {标签:true}
var _sem = null;           // 语义结果（null=未处于语义模式）
var _semOn = false;        // 后端语义能力是否可用（探测后置真/假）
var _semProbed = false;

// 从当日 data（非 history）扁平化所有条目，附带兜底来源名
function collect(d) {
  var out = [];
  var ai = d.aiDaily || {};
  (ai.sections || []).forEach(function (sec) {
    (sec.items || []).forEach(function (it) { out.push(withSrc(it, "AI 日报")); });
  });
  [["dailyNews", "每日60秒"], ["hackerNews", "Hacker News"], ["githubTrending", "GitHub Trending"],
   ["productHunt", "Product Hunt"], ["sspai", "少数派"]].forEach(function (pair) {
    ((d[pair[0]] || {}).items || []).forEach(function (it) { out.push(withSrc(it, pair[1])); });
  });
  return out;
}
function withSrc(it, def) {
  if (it.source) return it;
  return Object.assign({}, it, { source: def });
}

function sources() {
  var seen = [], m = {};
  _flat.forEach(function (it) { if (it.source && !m[it.source]) { m[it.source] = 1; seen.push(it.source); } });
  return seen;
}
function topTags(n) {
  var freq = {};
  _flat.forEach(function (it) {
    (Array.isArray(it.aiTags) ? it.aiTags : []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; });
  });
  return Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, n || 20);
}

function active() {
  return !!(_kw || Object.keys(_src).length || Object.keys(_tags).length || _sem);
}

// 客户端筛选：关键词(标题/摘要/标签) + 来源 + 标签
function filtered() {
  var kw = _kw.trim().toLowerCase();
  var srcKeys = Object.keys(_src), tagKeys = Object.keys(_tags);
  return _flat.filter(function (it) {
    if (srcKeys.length && !_src[it.source]) return false;
    var itags = Array.isArray(it.aiTags) ? it.aiTags : [];
    if (tagKeys.length && !tagKeys.some(function (t) { return itags.indexOf(t) >= 0; })) return false;
    if (kw) {
      var hay = ((it.title || "") + " " + (it.aiSummary || it.summary || "") + " " + itags.join(" ")).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    return true;
  });
}

function blocks() {
  var col = document.getElementById("col-info");
  if (!col) return [];
  return Array.prototype.filter.call(col.children, function (el) {
    return /Block$/.test(el.id || "");
  });
}

function render() {
  var panel = document.getElementById("infoSearchResults");
  if (!panel) return;
  var on = active();
  blocks().forEach(function (el) { el.style.display = on ? "none" : ""; });
  if (!on) { panel.style.display = "none"; panel.innerHTML = ""; return; }
  panel.style.display = "";

  var list, head;
  if (_sem) {
    list = _sem;
    head = '语义结果 · ' + list.length + ' 条' + (_kw || Object.keys(_src).length || Object.keys(_tags).length ? '（语义模式下忽略关键词/标签筛选）' : '');
  } else {
    list = filtered();
    head = '筛选结果 · ' + list.length + ' / ' + _flat.length + ' 条';
  }
  var cards = list.length
    ? '<div class="nw-grid">' + list.map(function (it) { return _renderCard(it); }).join("") + "</div>"
    : '<div class="empty">没有匹配的条目。' + (_sem ? '换个说法再试试。' : '试试放宽关键词或清除筛选。') + "</div>";
  panel.innerHTML = '<div class="card"><h2><span class="ic">' + ic("search") + "</span>" + esc(head) +
    '<button class="btn-sm" style="margin-left:auto" onclick="infoClear()">清除</button></h2>' +
    cards + "</div>";
}

// 搜索/筛选条（复用 .sf/.chip/.kb-tag 现成类，仅加极小布局，见 styles.css .info-search）
function bar() {
  var srcChips = sources().map(function (s) {
    return '<span class="chip' + (_src[s] ? " on" : "") + '" onclick="infoSrc(' + "'" + jsStr(s) + "'" + ')">' + esc(s) + "</span>";
  }).join("");
  var tagChips = topTags(20).map(function (t) {
    return '<span class="chip' + (_tags[t] ? " on" : "") + '" onclick="infoTag(' + "'" + jsStr(t) + "'" + ')">' + esc(t) + "</span>";
  }).join("");
  var sem = _semOn
    ? '<div class="kb-search info-sem"><input class="sf" id="infoSemInput" placeholder="语义搜索：按意思找（回车）" ' +
      'value="' + escAttr(_semQ) + '" oninput="infoSemType(this.value)" ' +
      'onkeydown="if(event.key===\'Enter\')infoSem()"><button class="btn-sm" onclick="infoSem()">语义</button></div>'
    : "";
  return '<div class="card info-search" id="infoSearchBarCard">' +
    '<div class="kb-search"><input class="sf" id="infoKwInput" placeholder="输入关键词过滤（标题 / 摘要 / 标签）" ' +
    'value="' + escAttr(_kw) + '" oninput="infoKw(this.value)"></div>' + sem +
    (srcChips ? '<div class="info-filter"><span class="info-flabel">来源</span>' + srcChips + "</div>" : "") +
    (tagChips ? '<div class="info-filter"><span class="info-flabel">标签</span>' + tagChips + "</div>" : "") +
    "</div>";
}

// 对外入口：由 info.js 的 renderInfo 每次渲染调用
export function mountInfoSearch(d, renderCard) {
  _renderCard = renderCard;
  _flat = collect(d);
  var col = document.getElementById("col-info");
  if (!col) return;
  var barEl = document.getElementById("infoSearchBar");
  if (!barEl) {
    barEl = document.createElement("div");
    barEl.id = "infoSearchBar";
    var res = document.createElement("div");
    res.id = "infoSearchResults";
    res.style.display = "none";
    col.insertBefore(barEl, col.firstChild);
    col.insertBefore(res, barEl.nextSibling);
    probeSemantic();
  }
  barEl.innerHTML = bar();
  render();
}

// 探测后端语义能力：空查询打一次 /api/info/search，据 configured 决定是否显示语义输入
function probeSemantic() {
  if (_semProbed) return;
  _semProbed = true;
  fetchT("/api/info/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "" }),
  }, 8000).then(function (r) { return r.json(); }).then(function (j) {
    _semOn = !!(j && j.configured);
    var barEl = document.getElementById("infoSearchBar");
    if (barEl && _semOn) barEl.innerHTML = bar();  // 补上语义输入
  }).catch(function () { _semOn = false; });
}

// ---- window 桥接（内联 onclick/oninput，与本仓一贯风格一致） ----
function infoKw(v) { _kw = v || ""; _sem = null; render(); }
function infoSrc(s) { if (_src[s]) delete _src[s]; else _src[s] = true; _sem = null; syncBar(); render(); }
function infoTag(t) {
  if (_tags[t]) delete _tags[t]; else _tags[t] = true;
  _sem = null;
  ensureInfoView();
  syncBar(); render();
}
function infoClear() { _kw = ""; _semQ = ""; _src = {}; _tags = {}; _sem = null; syncBar(); render(); }
function infoSemType(v) { _semQ = v || ""; }   // 仅记录，不重渲染（保持输入焦点）
function infoSem() {
  var inp = document.getElementById("infoSemInput");
  var q = (inp && inp.value || "").trim();
  _semQ = q;
  if (!q) { _sem = null; render(); return; }
  var panel = document.getElementById("infoSearchResults");
  if (panel) { panel.style.display = ""; blocks().forEach(function (el) { el.style.display = "none"; });
    panel.innerHTML = '<div class="card"><div class="empty">语义检索中…</div></div>'; }
  fetchT("/api/info/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: q, topk: 20 }),
  }, 15000).then(function (r) { return r.json(); }).then(function (j) {
    if (!j || !j.configured) { _semOn = false; _sem = null; syncBar(); render(); return; }
    _sem = (j.results || []).map(function (h) {
      return { title: h.title, url: h.url, aiSummary: h.summary, aiTags: h.tags || [], source: h.source };
    });
    render();
  }).catch(function () {
    var p = document.getElementById("infoSearchResults");
    if (p) p.innerHTML = '<div class="card"><div class="empty">语义检索失败（后端不可达或超时）。</div></div>';
  });
}
// 标签点击可能来自其它视图的卡片：先切到资讯 Tab 再过滤
function ensureInfoView() {
  var cur = document.querySelector(".view.active");
  if ((!cur || cur.id !== "view-info") && typeof window.switchView === "function") window.switchView("info");
}
function syncBar() {
  var barEl = document.getElementById("infoSearchBar");
  if (barEl) barEl.innerHTML = bar();
}

window.infoKw = infoKw;
window.infoSrc = infoSrc;
window.infoTag = infoTag;
window.infoClear = infoClear;
window.infoSem = infoSem;
window.infoSemType = infoSemType;
