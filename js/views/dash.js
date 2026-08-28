// 视图：仪表盘/今日头部（KPI 卡 + 今日速览 + bento 小数据 + 快捷启动 + 今日复盘）。
// 从 app.js 剥出，行为不变。goKPI/cmdtext/aiAsk 经 window 桥接（内联 onclick）。
import { esc, ic, jsStr } from "../core/util.js";
import { getData } from "../core/state.js";
import { todosLoad } from "../features/todos.js";
import { notesLoad } from "../features/notes.js";
import { favsLoad } from "../features/favs.js";
import { aiAsk } from "./ai.js";

export function renderKPI(d) {
  var k = d.kpi, disk = (d.status && d.status.disk) || {};
  var items = [
    { c: "kpi-blue", i: ic("book"), v: k.knowledge, l: "知识库文件", tab: "ov", card: "card-kb" },
    { c: "kpi-green", i: ic("settings"), v: k.automations, l: "定时任务", tab: "ov", card: "card-auto" },
    { c: "kpi-purple", i: ic("hardDrive"), v: (disk.D ? disk.D.free + "G" : "-"), l: "磁盘可用 · 共 " + (disk.D ? disk.D.total + "G" : "-"), tab: "ov", card: "card-ov" },
    { c: "kpi-amber", i: ic("zap"), v: k.skills, l: "已装 Skills", tab: "cap", card: "card-skills" },
    { c: "kpi-blue", i: ic("messageSquare"), v: k.sessions, l: "近期会话", tab: "sess", card: "col-sess" },
    { c: "kpi-purple", i: ic("archive"), v: k.memory, l: "记忆库文件", tab: "ov", card: "card-ov" },
  ];
  document.getElementById("kpis").innerHTML = items.map(function (x) {
    return '<div class="kpi ' + x.c + '" onclick="goKPI(' + "'" + x.tab + "','" + x.card + "'" + ')" title="跳转到 ' + esc(x.l) + '"><div class="ki">' + x.i + '</div><div><div class="kv">' + x.v + '</div><div class="kl">' + x.l + "</div></div></div>";
  }).join("");
}

export function renderQuick(d) {
  document.getElementById("quickbar").innerHTML = (d.quickActions || []).map(function (q) {
    return '<button class="qb" onclick="cmdtext(' + "'" + jsStr(q.cmd) + "'" + ')">' + q.icon + " " + esc(q.label) + "</button>";
  }).join("");
}

export function renderOverview(d) {
  var a = d.aiDaily || {}, dn = d.dailyNews || {};
  var aCount = a.count || 0, dCount = dn.count || 0;
  var total = aCount + dCount;
  var aTime = String(a.fetchedAt || "").slice(11, 16) || "-";
  var dTime = String(dn.fetchedAt || "").slice(11, 16) || "-";
  var prompt = "帮我把今天工作台里的资讯划 3 条重点：AI 日报 " + aCount + " 条、每日新闻 " + dCount + " 条。请挑出 3 条对我（AI 工具重度玩家，正在搭建自媒体创作工具集与自动化工作流，关注开源项目和 AI 前沿动态）最值得关注的，每条用大白话说明：背景是什么；为什么重要；今天能动手试什么。";
  document.getElementById("overview").innerHTML =
    '<div class="ov-hero">' +
      '<div class="ov-hero-top"><div class="ov-ttl">今日速览</div>' +
      '<div class="ov-meta">共 ' + total + ' 条资讯 · 已加载 2 个网页来源</div></div>' +
      '<div class="ov-chips">' +
        '<span class="chip"><span class="ok">✓</span> AI 日报 · ' + aCount + ' 条 · ' + aTime + '</span>' +
        '<span class="chip"><span class="ok">✓</span> 每日新闻 · ' + dCount + ' 条 · ' + dTime + '</span>' +
        '<span class="chip"><span class="ok">✓</span> 技术热榜 · App 端实时</span>' +
      '</div>' +
      '<button class="btn-cy" onclick="aiAsk(' + "'" + jsStr(prompt) + "'" + ')">AI 帮你划 3 条重点</button>' +
    '</div>';
}

// 今日概览统计卡（bento 内：待做 / 速记 / 收藏 本机小数据，与 App 端口径一致）
export function renderOvCard(d) {
  var box = document.getElementById("ovStats");
  if (!box) return;
  var todos = todosLoad().filter(function (t) { return !t.done; }).length;
  var notes = notesLoad().length;
  var favs = favsLoad().length;
  box.innerHTML =
    '<div class="ov-metric"><span class="rk">✅ 待做</span><span class="rv">' + todos + '</span><span class="rn">条未完成</span></div>' +
    '<div class="ov-metric"><span class="rk">速记</span><span class="rv">' + notes + '</span><span class="rn">条记录</span></div>' +
    '<div class="ov-metric"><span class="rk">收藏</span><span class="rv">' + favs + '</span><span class="rn">条稍后读</span></div>';
}

// 今日建议：把工作台现状拼成 prompt 发给 AI 助手
function inspireToday() {
  var d = getData() || {};
  var k = d.kpi || {};
  var cmd = "根据我的工作台现状生成今日建议：已装 " + (k.skills || 0) + " 个 skill，知识库 " + (k.knowledge || 0) +
    " 个文件，模型 " + (k.models || 0) + " 个（本机 " + (((d.status || {}).localModels || []).length) + "）。请给我：1-2 个今天可以动手的小任务点子；一条 AI agent 学习路径（结合我已装的 skill）；一个值得关注的 AI 趋势。";
  aiAsk(cmd);
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
  try { localStorage.setItem(REVIEW_KEY, t.value); if (h) h.textContent = "✓ 已保存（" + REVIEW_KEY.slice(10) + "）"; }
  catch (e) { if (h) h.textContent = "保存失败"; }
}
export function renderTodayReview(d) {
  var done = document.getElementById("reviewDone");
  if (done) {
    var list = todosLoad();
    var dn = list.filter(function (t) { return t.done; }).length;
    var total = list.length;
    if (!total) {
      done.innerHTML = '<span class="empty">今日还没有待办，写一条吧～</span>';
    } else {
      var pct = Math.round(dn / total * 100);
      done.innerHTML =
        '<span style="color:var(--sub);font-size:13px">今日代办完成度</span>' +
        '<span class="review-done-badge">✓ ' + dn + ' / ' + total + '</span>' +
        '<span class="review-progress"><span class="review-progress-fill" style="width:' + pct + '%"></span></span>' +
        '<span style="font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums">' + pct + '%</span>';
    }
  }
  var sess = document.getElementById("revSessions");
  if (sess) {
    var rec = (d.sessions && d.sessions.recent) || [];
    sess.innerHTML = rec.length ? rec.slice(0, 3).map(function (s) {
      return "<li>" + esc(s.title || s.custom_title || "未命名会话") + "</li>";
    }).join("") : '<li class="empty">今天还没有会话记录</li>';
  }
  var txt = document.getElementById("reviewInput");
  if (txt) { var saved = reviewLoad(); if (saved) txt.value = saved; }
}

window.inspireToday = inspireToday;
window.saveReview = saveReview;
