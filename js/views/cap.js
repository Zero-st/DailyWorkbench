// 视图：能力速达（Skills 速查 + 一键启动 + 今日引导侧栏）。从 app.js 剥出，行为不变。
// switchTab/cmd/aiAsk 经 window 桥接；filt/toggleCat 挂 window 供内联 onclick。
import { esc, escAttr, jsStr, ic, catLabel } from "../core/util.js";

function filt() {
  var q = document.getElementById("q").value.toLowerCase();
  if (q !== "") switchTab("cap");
  var any = false;
  document.querySelectorAll("#skills .cat").forEach(function (cat) {
    var n = 0;
    cat.querySelectorAll(".skill").forEach(function (it) {
      var hit = (q === "" || it.textContent.toLowerCase().indexOf(q) >= 0);
      it.style.display = hit ? "" : "none";
      if (hit) n++;
    });
    if (q !== "") {
      cat.style.display = (n === 0) ? "none" : "";
      if (n > 0) cat.classList.add("open");
    }
    if (n > 0) any = true;
  });
  var e = document.getElementById("sempty");
  if (e) e.style.display = (q !== "" && !any) ? "block" : "none";
}
function toggleCat(h) { h.parentNode.classList.toggle("open"); }

// Skill 使用统计（吸收自原「Skill 统计」视图）：TOP10 + 分类分布，渲染进能力速达侧栏
function skillStatsHtml(skills) {
  skills = skills || [];
  var used = skills.filter(function (s) { return (s.usage || 0) > 0; });
  var totalUsage = skills.reduce(function (a, s) { return a + (s.usage || 0); }, 0);
  var top = skills.slice().sort(function (a, b) { return (b.usage || 0) - (a.usage || 0); })
    .filter(function (s) { return (s.usage || 0) > 0; }).slice(0, 10);
  var maxU = top.length ? top[0].usage : 1;
  var byCat = {};
  skills.forEach(function (s) { (byCat[s.category] = byCat[s.category] || []).push(s); });
  var catMax = 1; Object.keys(byCat).forEach(function (c) { if (byCat[c].length > catMax) catMax = byCat[c].length; });
  var h = '<div class="side-card"><h4><span class="ic">' + ic("barChart2") + '</span>Skill 使用统计</h4>' +
    '<div class="ov-res" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px">' +
    '<div class="ov-metric"><span class="rk">已装</span><span class="rv">' + skills.length + '</span><span class="rn">个能力</span></div>' +
    '<div class="ov-metric"><span class="rk">用过</span><span class="rv">' + used.length + '</span><span class="rn">占 ' + Math.round(100 * used.length / Math.max(1, skills.length)) + '%</span></div>' +
    '<div class="ov-metric"><span class="rk">累计</span><span class="rv">' + totalUsage + '</span><span class="rn">次调用</span></div>' +
    "</div>";
  h += '<div style="color:var(--accent2);font-size:13px;margin:6px 0 4px">🔥 使用最多的 TOP ' + top.length + '</div>';
  h += top.length ? ('<div class="stat-list">' + top.map(function (s) {
    return '<div class="stat"><span class="st-name">' + esc(s.name) + '</span>' +
      '<span class="st-bar"><span class="st-fill" style="width:' + Math.round(100 * s.usage / maxU) + '%"></span></span>' +
      '<span class="st-num">' + s.usage + '</span></div>';
  }).join("") + "</div>") : '<div class="empty">还没有使用记录，点几个 skill 试试</div>';
  h += '<div style="color:var(--accent2);font-size:13px;margin:10px 0 4px">按分类分布（' + Object.keys(byCat).length + ' 类）</div>' +
    '<div class="stat-list">' + Object.keys(byCat).map(function (c) {
      return '<div class="stat"><span class="st-name">' + esc(catLabel(c)) + '</span>' +
        '<span class="st-bar"><span class="st-fill" style="width:' + Math.round(100 * byCat[c].length / catMax) + '%"></span></span>' +
        '<span class="st-num">' + byCat[c].length + '</span></div>';
    }).join("") + "</div></div>";
  return h;
}

function renderSkills(skills) {
  var byCat = {};
  skills.forEach(function (s) { (byCat[s.category] = byCat[s.category] || []).push(s); });
  var html = "";
  Object.keys(byCat).forEach(function (cat) {
    var list = byCat[cat].slice().sort(function (a, b) { return (b.usage || 0) - (a.usage || 0); });
    html += '<div class="cat"><div class="cat-h" onclick="toggleCat(this)"><span class="ci"></span>' + esc(catLabel(cat)) +
      '<span class="cc">' + list.length + '</span><span class="car">▶</span></div><div class="cat-b">';
    list.forEach(function (s) {
      var fire = (s.usage > 0) ? '<span class="fire">🔥' + s.usage + "</span>" : "";
      html += '<span class="skill" onclick="cmd(this)" data-cmd="' + escAttr(s.cmd) + '" title="' + escAttr(s.desc) + '">' +
        '<span class="sn">' + esc(s.name) + fire + '</span><span class="sd">' + esc(s.desc) + "</span></span>";
    });
    html += "</div></div>";
  });
  return html;
}

export function renderCap(d) {
  var skillsHtml = renderSkills(d.skills);
  var guideHtml = (d.guide || []).map(function (g) {
    return '<div class="guide-item' + (g.indexOf("⚠") >= 0 ? " warn" : "") + '">' + esc(g) + "</div>";
  }).join("");
  var inspireCmd = "根据我的工作台现状生成今日建议：已装 " + d.kpi.skills + " 个 skill，知识库 " + d.kpi.knowledge +
    " 个文件，模型 " + d.kpi.models + " 个（本机 " + ((d.status.localModels || []).length) + "）。请给我：1-2 个今天可以动手的小任务点子；一条 AI agent 学习路径（结合我已装的 skill）；一个值得关注的 AI 趋势。";
  var searchSvg = '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById("col-cap").innerHTML =
    '<div class="card" id="card-skills"><h2><span class="ic">' + ic("zap") + '</span>能力速达（点击复制调用指令）</h2>' +
      '<div class="searchbar"><span class="si">' + searchSvg + '</span><input id="q" placeholder="搜 skill 名称 / 描述，快速定位…（快捷键 /）" oninput="filt()"></div>' +
      '<textarea id="cmdbox" rows="2" placeholder="点击上方 skill，指令会出现在这里（也可直接编辑/粘贴）"></textarea>' +
      '<div id="hint"></div><div id="sempty" class="empty" style="display:none">没有匹配的 skill</div>' +
      '<div id="skills">' + skillsHtml + "</div></div>";
  var side = document.getElementById("side-cap");
  if (side) {
    side.innerHTML =
      '<div class="side-card"><h4><span class="ic">' + ic("compass") + '</span>今日引导 / 建议 / Agent 学习</h4>' +
        '<div class="ov-res" style="grid-template-columns:repeat(2,1fr);margin-bottom:8px">' +
        '<div class="ov-metric"><span class="rk">今日引导</span><span class="rv">' + (d.guide || []).length + '</span><span class="rn">条待办 / 提醒</span></div>' +
        '<div class="ov-metric"><span class="rk">AI 日报</span><span class="rv">' + ((d.aiDaily && d.aiDaily.count) || 0) + '</span><span class="rn">条今日资讯</span></div>' +
        "</div>" +
        '<div class="guide-grid">' + guideHtml + "</div>" +
        '<div style="margin-top:12px"><button class="btn" onclick="aiAsk(' + "'" + jsStr(inspireCmd) + "'" + ')">生成建议</button></div></div>' +
      skillStatsHtml(d.skills);
  }
}

window.filt = filt;
window.toggleCat = toggleCat;
