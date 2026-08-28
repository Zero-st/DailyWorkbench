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
  document.getElementById("col-cap").innerHTML =
    '<div class="card" id="card-skills"><h2><span class="ic">' + ic("zap") + '</span>能力速达（点击复制调用指令）</h2>' +
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
        '<div style="margin-top:12px"><button class="btn" onclick="aiAsk(' + "'" + jsStr(inspireCmd) + "'" + ')">生成建议</button></div></div>';
  }
}

window.filt = filt;
window.toggleCat = toggleCat;
