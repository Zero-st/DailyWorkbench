// 视图：项目进度（ADR 0016）。**页面上零手打数字**——全部由 GET /api/progress
// 从作战板勾选框、需求台账 §4、周表、git log 派生。
//
// 它和 2026-09-02 被删掉的 ov/cap/sess 的区别，全在置顶那条「判决条」：
// 那三个是「看机器在干嘛」（消遣），这个是「看自己离放弃线还有多远」（压力）。
// 若做完发现它变成了欣赏进度，ADR 0016 预注册的放弃线会把它删掉。
//
// 写侧只开两处（§⑤ 追加偏离 / §④ 改风险状态）——它们没有 DoD 约束，纯粹是
// 「摩擦高就不会被记」。§②③ 的勾选刻意不开：指南 §3 要求勾 [x] 前过 DoD 四款，
// 一键勾选会把四款架空，而「计划宣称完成、无人逐条对过」正是这套机制要治的病。
import { esc, ic } from "../core/util.js";
import { track } from "../core/usage.js";

var _hash = null;            // 作战板内容哈希，写回时带上做前置条件（防覆盖你在编辑器里的改动）
var _busy = false;

function _toast(msg, kind) {
  try { window.WB.dialog.toast(msg, kind); } catch (e) { /* 提示失败不该影响主流程 */ }
}

function _pct(done, total) { return total ? Math.round((done * 100) / total) : 0; }

function _meter(label, done, total, extra) {
  var p = _pct(done, total);
  return '<div class="pg-meter"><span class="pg-ml">' + esc(label) + "</span>" +
    '<span class="review-progress"><i class="review-progress-fill" style="width:' + p + '%"></i></span>' +
    '<span class="pg-mv">' + done + "/" + total + (extra ? " · " + p + "%" : "") + "</span></div>";
}

var ST = { ok: "ok", doing: "doing", todo: "wait", wait: "wait", cut: "wait",
           bad: "bad", warn: "warn", "new": "doing" };

// 作战板里的状态符号 → **文字标签**。
// 准则 §4 红线：emoji 绝不单独承载语义——本机就没有 emoji 字体，真机走查时
// ✅🔧⏳🔴🟡🟢 整列渲染成豆腐块 ☒，状态列等于没信息。这里一律转文字。
var SYM = {
  "✅": ["ok", "完成"], "🔧": ["doing", "部分"], "🚧": ["bad", "未开始"],
  "⏸": ["wait", "推迟"], "✂": ["wait", "已砍"], "⏳": ["wait", "未开始"],
  "🔴": ["bad", "高"], "🟡": ["warn", "中"], "🟢": ["ok", "低"],
  "⚪": ["wait", "未到期"], "🆕": ["doing", "新增"]
};

/** 行内 markdown：先转义再还原 **粗体** 与 `代码`，否则表格里会漏出字面量语法。 */
function _md(t) {
  return esc(String(t == null ? "" : t))
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** 从单元格里认出状态符号，输出「文字标签 + 余下说明」。缺字体也认得出。 */
function _symSt(cell) {
  var raw = String(cell == null ? "" : cell).trim();
  var hit = null;
  for (var k in SYM) { if (raw.indexOf(k) >= 0) { hit = SYM[k]; raw = raw.split(k).join(" ").trim(); break; } }
  if (!hit) return raw ? '<span class="pg-st wait">' + _md(raw) + "</span>" : "";
  // 余下文字若就是标签本身（如单元格写「⚪ 未到期」），别重复渲染成「未到期 未到期」
  var rest = raw.replace(/\*/g, "").trim();
  if (rest === hit[1]) rest = "";
  return '<span class="pg-st ' + hit[0] + '">' + esc(hit[1]) + "</span>" +
    (rest ? ' <span class="pg-dim">' + _md(raw) + "</span>" : "");
}

function _st(word, text) {
  return '<span class="pg-st ' + (ST[word] || "wait") + '">' + esc(text) + "</span>";
}

// ---------- 判决条：本视图的立身之本，永远置顶 ----------
function _verdict(d) {
  var dl = d.deadline || {}, u = d.usage || {};
  var lines = [];
  // 逐条对放弃线（阈值抄自作战板 §3 / ADR 0015，**只读不判**，判决在 10-17 由人做）
  if ((u.cards || 0) === 0) lines.push("真卡流量 30 天为 0 → 蒸馏库进删除测试");
  if ((u.inbox || 0) === 0) lines.push("收件箱 0 条 → 浏览器扩展进删除测试");
  if ((u.reviewWindow || 0) < 5) lines.push("复盘 7 天窗口 " + (u.reviewWindow || 0) + " 天 < 5 → 承认不做 dogfood");
  if ((u.usefulCards || 0) === 0) lines.push("温故标「有用」0 张 → 该指标删除，温故卡列入删除测试候选");
  if ((u.reportRuns || 0) < 4) lines.push("report_run " + (u.reportRuns || 0) + " 次 < 4 → 删掉整条量测线");
  if ((u.usedDays || 0) < 8) lines.push("28 天有交互 " + (u.usedDays || 0) + " 天 < 8 → 整个前端进删除测试");

  var days = dl.daysLeft;
  var danger = lines.length >= 3 || (days !== null && days !== undefined && days <= 3);
  var when = (days === null || days === undefined)
    ? '<div class="pg-countdown">?<small>对表日未知</small></div>'
    : '<div class="pg-countdown">' + days + "<small>天后对表 " + esc(dl.date || "") +
      (dl.source === "fallback" ? "（兜底值）" : "") + "</small></div>";

  return '<div class="pg-verdict' + (danger ? " danger" : "") + '">' + when +
    '<div class="pg-verdict-txt">' +
    (lines.length
      ? "<b>" + lines.length + " 条放弃线正踩线。</b>若对表日仍如此：" + esc(lines.join("；")) + "。"
      : "<b>暂无放弃线被触发。</b>继续按每日契约用它。") +
    "</div></div>";
}

// ---------- 解析失败自曝：宁可喊出来，也不静默留白 ----------
function _parseAlerts(d) {
  var b = d.board || {}, bad = [];
  if (!b.ok) bad.push("作战板读不到：" + (b.note || ""));
  if (b.ok && !b.phases) bad.push("§⓪ 层一（项目阶段）：" + (b.phasesNote || ""));
  if (b.ok && !b.weeks) bad.push("§⓪ 层二（当期四周）：" + (b.weeksNote || ""));
  if (b.ok && !b.gate) bad.push("§② 出口门禁：没读到勾选框");
  if (d.ledger && !d.ledger.ok) bad.push("需求台账：" + (d.ledger.note || ""));
  if (d.weekly && !d.weekly.ok) bad.push("周表：" + (d.weekly.note || ""));
  if (!bad.length) return "";
  return '<div class="pg-verdict danger"><div class="pg-verdict-txt">' +
    "<b>有 " + bad.length + " 段没解析出来</b>（多半是 markdown 表头被改动过）：<br>" +
    esc(bad.join("　|　")) +
    "<br>表头是解析契约，改法见 <code>docs/guides/项目管理-操作指南.md</code> §4.1。" +
    "</div></div>";
}

function _tbl(head, rows) {
  return '<div class="pg-wrapx"><table class="pg-table"><thead><tr>' +
    head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
    "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}

function _card(iconName, title, body, tag) {
  return '<div class="card"><h2><span class="ic">' + ic(iconName) + "</span>" + esc(title) +
    (tag ? '<span class="pg-st doing" style="margin-left:auto">' + esc(tag) + "</span>" : "") +
    "</h2>" + body + "</div>";
}

export function renderProgress() {
  var host = document.getElementById("view-progress");
  if (!host) return;
  host.innerHTML = '<div class="card"><h2><span class="ic">' + ic("activity") + "</span>项目进度</h2><p>读取中…</p></div>";

  fetch("/api/progress").then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) throw new Error("bad payload");
    _hash = d.hash || null;
    host.innerHTML = _render(d);
  }).catch(function () {
    // 优雅劣化：后端不在（离线 / GitHub Pages 版）时说清楚，不空白也不崩
    host.innerHTML = _card("alertTriangle", "项目进度",
      '<p class="pg-dim">读不到进度——本视图要本地后端在跑（<code>systemctl --user start workbench</code>）。' +
      "GitHub Pages 版拿不到，属预期。</p>");
  });
}

function _render(d) {
  var b = d.board || {}, led = d.ledger || {}, mix = d.mix || null;
  var out = [_parseAlerts(d), _verdict(d)];

  // ② 三层完成度（复活 [0.7.0] 起就没人用的 .kpis/.kpi/.kv/.kl）
  var g = b.gate, t = b.task;
  out.push('<div class="kpis" style="grid-template-columns:repeat(4,1fr)">' +
    '<div class="kpi kpi-amber"><div><div class="kv">' + (g ? g.done + "/" + g.total : "—") +
      '</div><div class="kl">当期门禁' + (g ? " · " + g.pct + "%" : "") + "</div></div></div>" +
    '<div class="kpi kpi-green"><div><div class="kv">' + (led.ok ? led.done + "/" + led.denom : "—") +
      '</div><div class="kl">需求完成' + (led.ok ? " · " + led.pct + "%" : "") + "</div></div></div>" +
    '<div class="kpi"><div><div class="kv">' +
      (d.weekly && d.weekly.ok ? d.weekly.passed + "/" + d.weekly.judged : "—") +
      '</div><div class="kl">周门通过</div></div></div>' +
    '<div class="kpi kpi-purple"><div><div class="kv">' +
      (mix && mix.ratio !== null && mix.ratio !== undefined ? Math.round(mix.ratio * 100) + "%" : "—") +
      '</div><div class="kl">元工作占比' + (mix && mix.warn ? " · 过半" : "") + "</div></div></div></div>");

  out.push('<div class="wrap"><div class="col">');

  // ③ 层二 · 当期四周
  if (b.weeks) {
    out.push(_card("calendar", "当期四周 · " + (b.title || ""), _tbl(
      ["周", "区间", "计划内容", "周门", "状态"],
      b.weeks.map(function (w) {
        return "<tr><td class=\"pg-c1\">" + esc(w["周"]) + '</td><td class="pg-num pg-dim">' + esc(w["区间"]) +
          "</td><td>" + _md(w["计划内容"]) + '</td><td class="pg-dim">' + _md(w["周门"]) +
          "</td><td>" + _symSt(w["状态"]) + "</td></tr>";
      }))));
  }

  // ③ 层一 · 项目阶段
  if (b.phases) {
    out.push(_card("compass", "项目阶段 · 知识飞轮路线图", _tbl(
      ["阶段", "内容", "门性", "状态", "完成日 / 依赖"],
      b.phases.map(function (p) {
        return '<tr><td class="pg-c1">' + esc(p["阶段"]) + "</td><td>" + _md(p["内容"]) +
          '</td><td class="pg-dim">' + _md(p["门性"]) + "</td><td>" + _symSt(p["状态"]) +
          '</td><td class="pg-dim">' + _md(p["完成日 / 依赖"]) + "</td></tr>";
      }))));
  }

  // ④ 出口门禁逐条（只读——勾选刻意不开）
  if (g && g.items) {
    out.push(_card("checkSquare", "出口门禁",
      _meter("当期完成度", g.done, g.total, true) + '<hr class="rev-rule">' +
      _tbl(["门禁", "状态"], g.items.map(function (it) {
        var w = it.mark === "x" ? "ok" : it.mark === "~" ? "doing" : it.mark === "-" ? "wait" : "bad";
        var txt = it.mark === "x" ? "已勾" : it.mark === "~" ? "在做" : it.mark === "-" ? "已放弃" : "未开始";
        return "<tr><td>" + _md(it.title) + "</td><td>" + _st(w, txt) + "</td></tr>";
      })) +
      '<div class="pg-locked"><b>这里刻意不可点。</b>勾 <code>[x]</code> 前要过 DoD 四款' +
      "（已 commit · 跑过门禁 · 写一句可验证的验收事实 · 台账已回写）。一键勾选会把四款架空，" +
      "而「计划宣称完成、无人逐条对过」正是这套机制要治的病 —— 勾选只在编辑器里改。</div>"));
  }

  out.push("</div><div class=\"col\">");

  // ④ 风险登记册（状态可点改）
  if (b.risks && b.risks.length) {
    out.push(_card("alertTriangle", "风险与假设 · " + b.risks.length + " 条", _tbl(
      ["#", "风险 / 假设", "状态"],
      b.risks.map(function (r) {
        var cur = (r["状态"] || "").trim();
        return '<tr><td class="pg-c1">' + esc(r["#"]) + "</td><td>" + _md(r["风险 / 假设"]) +
          '</td><td><span class="pg-riskbtn" title="点一下循环：高 → 中 → 低 → 未到期" ' +
          "onclick=\"wbProgressRisk('" + esc(r["#"]) + "','" + esc(cur) + "')\">" +
          _symSt(cur) + "</span></td></tr>";
      })) +
      '<div class="pg-locked">点一下在「高 → 中 → 低 → 未到期」间循环，就地写回作战板 §④，只改那一格。</div>'));
  }

  // ④ 本周任务（只读）
  if (t && t.items) {
    out.push(_card("clipboard", "本周任务",
      _meter("本周", t.done, t.total) + '<hr class="rev-rule">' +
      _tbl(["任务", "状态"], t.items.map(function (it) {
        var w = it.mark === "x" ? "ok" : it.mark === "~" ? "doing" : it.mark === "-" ? "wait" : "bad";
        var txt = it.mark === "x" ? "完成" : it.mark === "~" ? "在做" : it.mark === "-" ? "已放弃" : "未开始";
        return "<tr><td>" + _md(it.title) + "</td><td>" + _st(w, txt) + "</td></tr>";
      }))));
  }

  // ⑤ 偏离记录（可追加）
  var devRows = (b.deviationRows || []).map(function (r) {
    return '<tr><td class="pg-num pg-dim">' + esc(r[0]) + "</td><td>" + _md(r[1] || "") + "</td></tr>";
  });
  out.push(_card("activity", "偏离记录 · " + (b.deviations || 0) + " 条",
    (devRows.length ? _tbl(["时间", "做了什么"], devRows) : '<p class="pg-dim">还没有记过偏离。</p>') +
    '<div class="pg-form">' +
    '<input class="sf" id="pgDevWhat" placeholder="做了什么计划外的事？" aria-label="偏离内容">' +
    '<input class="sf" id="pgDevWhy" placeholder="为什么" aria-label="偏离原因">' +
    '<button class="button sm" onclick="wbProgressDeviation()">记一条</button></div>' +
    '<div class="pg-locked">日期由服务端盖戳。<b>开编辑器记一行偏离的摩擦，正是它不会被记的原因</b>' +
    "——所以这一处开放写入。</div>", "可在此追加"));

  // ⑤ 工作构成
  if (mix && mix.total) {
    var order = Object.keys(mix.counts).sort(function (a, b2) { return mix.counts[b2] - mix.counts[a]; });
    out.push(_card("barChart2", "工作构成 · 近 30 天",
      _meter("元工作占比", mix.meta, mix.total, true) +
      '<p class="pg-dim" style="margin:8px 0 0">共 ' + mix.total + " 条提交：" +
      esc(order.map(function (k) { return k + " " + mix.counts[k]; }).join(" · ")) + "。" +
      (mix.warn ? "<b>过半</b>——周五第 4 问要写一句为什么。只提示不判红。" : "未过半。") + "</p>"));
  }

  out.push("</div></div>");
  return out.join("");
}

// ---------- 写侧（只开两处） ----------
function _post(path, body) {
  body.hash = _hash;
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(function (r) { return r.json(); });
}

function _afterWrite(res, okMsg) {
  if (res && res.ok) { _toast(okMsg, "ok"); renderProgress(); return; }
  if (res && res.error === "stale") {
    _toast("作战板在别处被改过了，已刷新——请重试", "warn");
    renderProgress();
    return;
  }
  _toast("写入失败：" + ((res && res.error) || "后端不可达"), "err");
}

function addDeviation() {
  if (_busy) return;
  var w = document.getElementById("pgDevWhat"), y = document.getElementById("pgDevWhy");
  var what = (w && w.value || "").trim();
  if (!what) { _toast("先写一句「做了什么」", "warn"); if (w) w.focus(); return; }
  _busy = true;
  _post("/api/progress/deviation", { what: what, why: (y && y.value || "").trim() })
    .then(function (res) { _afterWrite(res, "已记入作战板 §⑤"); })
    .catch(function () { _toast("写入失败：后端不可达", "err"); })
    .then(function () { _busy = false; });
}

var CYCLE = ["🔴", "🟡", "🟢", "⚪"];
function cycleRisk(id, cur) {
  if (_busy) return;
  var i = -1;
  for (var n = 0; n < CYCLE.length; n++) { if ((cur || "").indexOf(CYCLE[n]) >= 0) { i = n; break; } }
  var next = CYCLE[(i + 1) % CYCLE.length];
  _busy = true;
  _post("/api/progress/risk", { id: id, status: next })
    .then(function (res) { _afterWrite(res, "风险 " + id + " → " + next); })
    .catch(function () { _toast("写入失败：后端不可达", "err"); })
    .then(function () { _busy = false; });
}

/** 今日页摘要行：让它来找你，而不是你去找它（治心法 §4 频率门）。 */
export function renderProgressPeek() {
  var host = document.getElementById("progressPeek");
  if (!host) return;
  fetch("/api/progress").then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) throw new Error("bad");
    var g = d.board && d.board.gate, led = d.ledger || {}, dl = d.deadline || {}, u = d.usage || {};
    var tripped = 0;
    if ((u.cards || 0) === 0) tripped++;
    if ((u.inbox || 0) === 0) tripped++;
    if ((u.reviewWindow || 0) < 5) tripped++;
    if ((u.usefulCards || 0) === 0) tripped++;
    if ((u.reportRuns || 0) < 4) tripped++;
    if ((u.usedDays || 0) < 8) tripped++;
    host.innerHTML = '<div class="pg-peek">' +
      (g ? '<span>门禁 <span class="pg-pk">' + g.done + "/" + g.total + "</span></span>" : "") +
      (led.ok ? '<span>需求 <span class="pg-pk">' + led.done + "/" + led.denom + "</span></span>" : "") +
      (dl.daysLeft !== null && dl.daysLeft !== undefined
        ? '<span>距对表 <span class="pg-pk">' + dl.daysLeft + "</span> 天</span>" : "") +
      (tripped ? '<span class="pg-st bad">' + tripped + " 条踩线</span>" : '<span class="pg-st ok">无踩线</span>') +
      "<a href=\"#\" onclick=\"switchView('progress');return false\">看计划表 →</a></div>";
  }).catch(function () { host.innerHTML = ""; });   // 后端不在就整块不显示，不打扰今日页
}

/** 明确的用户手势才记——页面加载/恢复上次标签不算（ADR 0015 不采集"开着标签页"）。 */
export function trackProgressOpen() { track("progress_open"); }

// window 桥接：内联 onclick 用（宪章维度二——各模块只在文件末尾挂自己的处理器）
window.wbProgressDeviation = addDeviation;
window.wbProgressRisk = cycleRisk;
