// 视图：系统状态（个人状态看板 / 环境体检 / 自动化 / 知识生产）。从 app.js 剥出，行为不变。
import { esc, ic } from "../core/util.js";

// 把 RRULE 风格 cron（FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0）解析成中文
function cronZh(cron) {
  if (!cron) return "";
  var p = {};
  String(cron).split(";").forEach(function (kv) {
    var i = kv.indexOf("=");
    if (i > 0) p[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1);
  });
  var freq = p.FREQ || "";
  var days = { MO: "一", TU: "二", WE: "三", TH: "四", FR: "五", SA: "六", SU: "日" };
  var when = [];
  if (p.BYHOUR) { when.push((p.BYHOUR.length === 1 ? "0" + p.BYHOUR : p.BYHOUR) + ":" + (p.BYMINUTE ? (p.BYMINUTE.length === 1 ? "0" + p.BYMINUTE : p.BYMINUTE) : "00")); }
  var hm = when.length ? " " + when[0] : "";
  if (freq.indexOf("WEEKLY") >= 0) {
    var ds = (p.BYDAY || "").split(",").filter(Boolean).map(function (d) { return days[d] || ""; }).join("、");
    return (ds ? "每周" + ds : "每周") + hm;
  }
  if (freq.indexOf("DAILY") >= 0) return "每天" + hm;
  if (freq.indexOf("HOURLY") >= 0) return "每小时";
  if (freq.indexOf("MONTHLY") >= 0) return "每月" + hm;
  return String(cron).slice(0, 30);
}

export function renderOv(d) {
  var st = d.status;
  var modelsHtml = (st.models || []).map(function (m) {
    return '<div class="model"><span class="mn">' + esc(m.name) + '</span><span class="mm">' + esc(m.type) + "</span></div>";
  }).join("");
  var mcpHtml = (st.mcp || []).map(function (m) {
    var off = (m.online === false);
    return '<span class="mcp' + (off ? " off" : "") + '">' + esc(m.name) +
      (off ? ' <span class="mcp-badge">离线</span>' : "") + "</span>";
  }).join("");
  var disk = st.disk || {};
  var localHtml = (st.localModels || []).map(function (m) { return '<div class="model">' + esc(m) + "</div>"; }).join("");
  var ol = st.ollama || {};
  var olModels = ol.models || [];
  var olRunning = ol.running || [];
  var olHtml = ol.available === false ? '<div class="empty">Ollama 未安装</div>' :
    (olModels.length ? olModels.map(function (m) {
      var tags = m.tags || [m.name];
      var run = olRunning.some(function (r) { return tags.indexOf(r.name) >= 0; });
      var alias = tags.length > 1 ? " · 等 " + tags.length + " 个标签" : "";
      return '<div class="model ol-model"><span class="ol-dot ' + (run ? "on" : "") + '"></span><b>' + esc(tags[0]) + '</b>' +
        '<span class="meta">' + esc(m.size || "") + alias + (run ? " · 运行中" : "") + "</span></div>";
    }).join("") : '<div class="empty">Ollama 未运行 · 暂无本地模型</div>');
  var autoHtml = (st.automations || []).map(function (a) {
    var badge = a.status === "ACTIVE" || a.status === "active" ? '<span class="badge on">ACTIVE</span>' : '<span class="badge off">' + esc(a.status) + "</span>";
    var freq = cronZh(a.cron);
    return '<div class="auto">' + badge + "<b>" + esc(a.name) + '</b><span class="meta">' + (freq ? esc(freq) + " · " : "") + "下次 " + esc(a.next || "-") + "</span></div>";
  }).join("") || '<div class="empty">暂无自动化任务</div>';
  var kb = d.knowledge || { total: 0, types: {}, files: [] };
  var kbTypes = Object.keys(kb.types || {}).map(function (t) { return t + " " + kb.types[t]; }).join(" · ");
  var kbHtml = (kb.files || []).map(function (f) {
    return '<div class="auto"><b>' + esc(f.name) + '</b><span class="meta">' + esc(f.mtime) + "</span></div>";
  }).join("");

  document.getElementById("col-ov").innerHTML =
    '<div class="card" id="card-ov"><h2><span class="ic">' + ic("activity") + '</span>个人状态看板</h2>' +
      '<div class="ov-sub">已接入模型（' + (st.models || []).length + '）</div><div class="ov-models">' + modelsHtml + "</div>" +
      '<div class="ov-sub">集成与资源</div>' +
      '<div class="ov-res">' +
      '<div class="ov-mcp"><div class="ov-mcp-h"><span class="rk">MCP 集成</span><span class="rv">' + (st.mcp || []).length + '</span></div><div class="ov-mcp-chips">' + mcpHtml + "</div></div>" +
      '<div class="ov-metric"><span class="rk">记忆库</span><span class="rv">' + d.kpi.memory + '</span><span class="rn">个文件</span></div>' +
      '<div class="ov-metric"><span class="rk">磁盘 C:</span><span class="rv">' + (disk.C ? disk.C.free + "G" : "-") + '</span><span class="rn">共 ' + (disk.C ? disk.C.total + "G" : "-") + "</span></div>" +
      '<div class="ov-metric"><span class="rk">磁盘 D:</span><span class="rv">' + (disk.D ? disk.D.free + "G" : "-") + '</span><span class="rn">可用 · 共 ' + (disk.D ? disk.D.total + "G" : "-") + "</span></div>" +
      "</div></div>" +
    '<div class="card"><h2><span class="ic">' + ic("tool") + '</span>环境体检台</h2>' +
      '<div class="ov-res">' +
      '<div class="ov-metric"><span class="rk">本地模型</span><span class="rv">' + olModels.length + '</span><span class="rn">' + (ol.available === false ? "Ollama 未装" : (olRunning.length ? olRunning.length + " 运行中" : "已就绪")) + "</span></div>" +
      '<div class="ov-metric"><span class="rk">C 盘剩余</span><span class="rv">' + (disk.C ? disk.C.free + "G" : "-") + '</span><span class="rn">共 ' + (disk.C ? disk.C.total + "G" : "-") + "</span></div>" +
      '<div class="ov-metric"><span class="rk">运行时</span><span class="rv" style="font-size:14px">' + esc(st.runtime || "-") + '</span><span class="rn">Python / Node</span></div>' +
      "</div>" +
      (olModels.length ? '<div style="margin:8px 0 2px;color:var(--accent2);font-size:13px">本地 Ollama 模型（' + olModels.length + '）</div><div class="ov-ol">' + olHtml + "</div>" : "") +
    "</div>" +
    '<div class="card" id="card-auto"><h2><span class="ic">' + ic("settings") + '</span>自动化与任务编排</h2>' +
      '<div class="ov-res" style="grid-template-columns:repeat(2,1fr);margin-bottom:8px">' +
      '<div class="ov-metric"><span class="rk">自动化任务</span><span class="rv">' + (st.automations || []).length + '</span><span class="rn">WorkBuddy 内置</span></div>' +
      '<div class="ov-metric"><span class="rk">活跃中</span><span class="rv">' + (st.automations || []).filter(function (a) { return a.status === "ACTIVE" || a.status === "active"; }).length + '</span><span class="rn">ACTIVE 状态</span></div>' +
      "</div>" +
      '<div class="ov-auto-panel">' + autoHtml + "</div>" +
      '<div style="margin-top:10px"><button class="btn" onclick="cmdtext(' + "'新建定时任务：频率（如每周一10点）+ 工作区 + 任务描述'" + ')">➕ 新建定时任务</button></div></div>' +
    '<div class="card" id="card-kb"><h2><span class="ic">' + ic("book") + '</span>内容与知识生产</h2>' +
      '<div class="ov-res" style="grid-template-columns:repeat(2,1fr)">' +
      '<div class="ov-metric"><span class="rk">知识库文件</span><span class="rv">' + kb.files.length + '</span><span class="rn">篇笔记 / 资料</span></div>' +
      '<div class="ov-metric"><span class="rk">知识库类型</span><span class="rv" style="font-size:14px">' + Object.keys(kb.types || {}).length + '</span><span class="rn">' + esc(kbTypes || "未分类") + "</span></div>" +
      "</div>" +
      (kb.files.length ? '<div class="ov-kb" style="margin-top:8px">' + kbHtml + "</div>" : '<div class="empty" style="margin-top:8px">暂无知识库文件，点下方新建</div>') +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" onclick="cmdtext(' + "'在 knowledge-base/ 新建一篇笔记，主题：'" + ')">➕ 新建笔记</button>' +
      '<button class="btn" onclick="cmdtext(' + "'用 video-cangjie-distill 把以下视频转成 skill：'" + ')">蒸馏视频</button>' +
      '<button class="btn-sm" onclick="cmdtext(' + "'在 knowledge-base/ 搜索：'" + ')">🔍 搜知识库</button></div></div>';
}
