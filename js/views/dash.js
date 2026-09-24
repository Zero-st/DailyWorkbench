// 视图：今日头部辅助（快捷启动台 + 今日复盘）。
// IA 重构后原「仪表盘」下线：速记/收藏/入口/快捷启动已并入「今日」；KPI 指标条与今日速览已删除，
// 「今日建议」按钮去重（保留于「能力速达」）。cmd 经 window 桥接（内联 onclick + data-cmd）。
import { esc, escAttr, ic } from "../core/util.js";
import { todosLoad } from "../features/todos.js";
import { track } from "../core/usage.js";
import { buildVideoQuickCmd } from "../core/distill-template.js";

// AI 指令台（今日视图卡片）：精选「需要外部 agent(Claude Code) 才能跑」的 prompt，
// 点击复制、粘进 Claude Code 执行。故意不用 data.json 的 quickActions——那里混着一堆
// 与侧边栏/页内卡片重复的伪需求（刷新/记待办/搜库/日报/看状态）；这里只留 3 个有独立价值的。
// 「拆解视频」不再自持字符串：原文写死了「用 creator-video-decoder …输出六维拆解报告」，
// 那个 skill 本机从未装过（2026-09-04 核实），且「六维拆解报告」是全仓唯一的术语孤岛。
// 现改为消费 core/distill-template.js 这个六维单一真源——它是该模块收敛时最后一个漏网的消费方。
var QUICK_CMDS = [
  { icon: "film", label: "拆解视频", cmd: buildVideoQuickCmd() },
  { icon: "zap", label: "给我灵感", cmd: "根据我的工作台现状生成今日灵感：列出今日待办、知识库概况、已装 skill，给我 1-2 个今天可动手的小任务 + 一条 AI agent 学习路径 + 一个值得关注的 AI 趋势" },
  { icon: "tool", label: "整理工作区", cmd: "整理并精简工作区的 skill 与笔记" }
];
export function renderQuick(d) {
  var box = document.getElementById("quickbar");
  if (!box) return;
  box.innerHTML = QUICK_CMDS.map(function (q) {
    // 走 data-cmd + cmd(this)（util.js:188 早就备好的机制），不走 cmdtext 的内联字符串写法：
    // 指令现在是多行的，而 jsStr 不转义换行，塞进 onclick='...' 会让 JS 串语法错、按钮整个失效。
    // 属性值里换行合法，escAttr 又把 & < > ' " 都转掉；cmd(el) 还会显式把按钮传给复制反馈。
    return '<button class="qb" data-cmd="' + escAttr(q.cmd) + '" onclick="cmd(this)">' + ic(q.icon) + " " + esc(q.label) + "</button>";
  }).join("");
}

// ---------- 今日复盘（主页聚焦模块：基于真实数据自动生成 + 本机手动复盘） ----------
var REVIEW_KEY = "wb_review_" + (function () {
  var n = new Date();
  return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2);
})();
function reviewLoad() { try { return localStorage.getItem(REVIEW_KEY) || ""; } catch (e) { return ""; } }
function saveReview() {
  var t = document.getElementById("reviewInput");
  var h = document.getElementById("reviewHint");
  if (!t) return;
  try {
    localStorage.setItem(REVIEW_KEY, t.value);
    if (h) h.textContent = "✓ 已保存（" + REVIEW_KEY.slice(10) + "）";
    track("review_save");
  }
  catch (e) { if (h) h.textContent = "保存失败"; }
}
export function renderTodayReview(d) {
  var done = document.getElementById("reviewDone");
  if (done) {
    var list = todosLoad();
    var dn = list.filter(function (t) { return t.done; }).length;
    var total = list.length;
    if (!total) {
      // 这里是「今日复盘」卡的代办完成度位，此前复读了待办卡的文案（走查 X5）。
      done.innerHTML = '<span class="empty">今天还没有代办可统计 · 直接写复盘也行</span>';
    } else {
      var pct = Math.round(dn / total * 100);
      done.innerHTML =
        '<span style="color:var(--sub);font-size:13px">今日代办完成度</span>' +
        '<span class="review-done-badge">✓ ' + dn + ' / ' + total + '</span>' +
        '<span class="review-progress"><span class="review-progress-fill" style="width:' + pct + '%"></span></span>' +
        '<span style="font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums">' + pct + '%</span>';
    }
  }
  var txt = document.getElementById("reviewInput");
  if (txt) { var saved = reviewLoad(); if (saved) txt.value = saved; }
}

window.saveReview = saveReview;
