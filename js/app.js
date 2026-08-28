// 个人工作台 · 数据驱动渲染 + PWA（ES Modules 主模块）
// 工具/图标/弹窗/复制/撤销已抽到 js/core/util.js（详见该文件）。
// 本文件暂作主模块，后续按视图逐步剥离到 js/views/*。
import { esc, jsStr, ic } from "./core/util.js";
import { getData, setData, getView, setView } from "./core/state.js";
import { renderStats } from "./views/stats.js";
import { renderOv } from "./views/ov.js";
import { renderSessArchive, closeHeat } from "./views/sess.js";
import { renderWeekAll } from "./views/week.js";
import { favsLoad, favsSave, renderFavs } from "./features/favs.js";
import { renderInfo } from "./views/info.js";
import { renderCap } from "./views/cap.js";
import { fetchT } from "./core/net.js";
import { renderAI, aiAsk } from "./views/ai.js";
import { notesLoad, notesSave, renderNotes } from "./features/notes.js";
import { todosLoad, todosSave, renderTodos } from "./features/todos.js";
import { renderKPI, renderQuick, renderOverview, renderOvCard, renderTodayReview } from "./views/dash.js";

// WB 命名空间（dialog/esc/ic/jsStr）由 util.js 挂载到 window.WB；本模块内沿用 WB.dialog.*
var WB = window.WB;



  // ---------- 交互 ----------
  // filt/toggleCat 与 renderSkills/renderCap 已剥到 js/views/cap.js
  // 历史遗留：曾与 switchView 双路由并存。现统一委托 switchView（保留导出与全部调用者）。
  function switchTab(id) { switchView(id); }
  function goKPI(tab, cardId) {
    switchTab(tab);
    setTimeout(function () {
      var el = document.getElementById(cardId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
  // openHeat/closeHeat/renderHeat/sessFilter/sessStatus/renderSessArchive 已剥到 js/views/sess.js

  // 我的速记 已剥到 js/features/notes.js
  // 我的收藏/稍后读 已剥到 js/features/favs.js

  // ---------- 主题切换（三态：深色 / 浅色 / 跟随系统，与 App 端一致） ----------
  function syncThemeColor(light) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", light ? "#eaeef3" : "#0e1116");
  }
  // 读取主题模式：light / dark / system（默认浅色·钢蓝科技风）
  function _themeMode() {
    var v = localStorage.getItem("wb_theme");
    return (v === "light" || v === "dark" || v === "system") ? v : "light";
  }
  // 算出当前是否浅色：system 模式跟随系统配色偏好
  function _themeLight(mode) {
    if (mode === "light") return true;
    if (mode === "dark") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function applyTheme() {
    var mode = _themeMode();
    var light = _themeLight(mode);
    document.body.classList.toggle("light", light);
    var b = document.getElementById("themeBtn");
    if (b) {
      b.innerHTML = ic(light ? "sun" : "moon");
      b.title = "主题：" + (mode === "system" ? "跟随系统" : (light ? "浅色" : "深色")) + "（点此切换）";
    }
    syncThemeColor(light);
  }
  function toggleTheme() {
    // 循环：深色 → 浅色 → 跟随系统 → 深色
    var cur = _themeMode();
    var next = cur === "dark" ? "light" : (cur === "light" ? "system" : "dark");
    localStorage.setItem("wb_theme", next);
    applyTheme();
  }
  // 跟随系统模式下，系统主题变化实时响应
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (_themeMode() === "system") applyTheme();
    });
  }

  // toggleNS/toggleNews/renderNewsItem 与资讯(news)渲染 已剥到 js/views/info.js

  window.switchTab = switchTab; window.goKPI = goKPI; window.toggleTheme = toggleTheme;

  // 待办清单 已剥到 js/features/todos.js

  // ---------- 专注计时（番茄钟，纯前端） ----------
  var pomoTotal = 25 * 60;
  var pomoRemain = pomoTotal;
  var pomoRunning = false;
  var pomoTimer = null;
  function pomoRender() {
    var el = document.getElementById("pomoT");
    if (el) el.textContent = ("0" + Math.floor(pomoRemain / 60)).slice(-2) + ":" + ("0" + (pomoRemain % 60)).slice(-2);
    var bar = document.getElementById("pomoBar");
    if (bar) bar.style.width = Math.round(100 * pomoRemain / pomoTotal) + "%";
    var b = document.getElementById("pomoBtn");
    if (b) b.textContent = pomoRunning ? "⏸ 暂停" : "▶ 开始专注";
  }
  function pomoToggle() {
    if (pomoRunning) {
      clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
    } else {
      pomoRunning = true;
      pomoTimer = setInterval(function () {
        pomoRemain--;
        if (pomoRemain <= 0) {
          clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
          pomoRemain = pomoTotal;
          var h = document.getElementById("pomoHint");
          if (h) h.textContent = "专注结束！把完成的待办勾掉吧";
          pomoBeep();
        }
        pomoRender();
      }, 1000);
    }
    pomoRender();
  }
  function pomoReset() {
    clearInterval(pomoTimer); pomoTimer = null; pomoRunning = false;
    pomoRemain = pomoTotal;
    var h = document.getElementById("pomoHint"); if (h) h.textContent = "";
    pomoRender();
  }
  // 切换专注时长（未运行时同步重置倒计时；运行中保持当前进度，结束后按新时长）
  function pomoSetLen(min) {
    min = parseInt(min, 10) || 25;
    pomoTotal = min * 60;
    if (!pomoRunning) { pomoRemain = pomoTotal; }
    pomoRender();
  }
  function pomoBeep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  }
  window.pomoToggle = pomoToggle; window.pomoReset = pomoReset; window.pomoSetLen = pomoSetLen;

  // ---------- 渲染 ----------
  // renderKPI/renderQuick/renderOverview/renderOvCard/inspireToday/renderTodayReview 已剥到 js/views/dash.js
  // renderSkills/renderCap 见 js/views/cap.js


  // cronZh + renderOv 已剥到 js/views/ov.js

  // renderStats 已剥到 js/views/stats.js（renderActiveTab 通过 import 调用）

  // 会话档案(sess) 与 本周动态(week) 已剥到 js/views/sess.js 与 js/views/week.js

  // AI 助手全套 已剥到 js/views/ai.js

  // 课程表模块已拆到 schedule.js（独立 IIFE，window.WB.esc 依赖注入，加载顺序在 app.js 前）
  // 对外接口：window.renderSchedule / ghToken / scheduleLoad / schedulePullCloud / setGhToken / GH_REPO

  // 头部条（KPI/同步/快捷启动/本周动态）+ tab 内容拆分渲染：省 CPU、按需
  function renderHeaderStrip(d) {
    document.getElementById("snap").textContent = "快照 · " + (d.generatedAt || "-");
    renderSync(d);
    renderFreshness(d);
    renderKPI(d);
    renderOverview(d);
    renderOvCard(d);
    renderQuick(d);
  }
  function renderActiveTab(d) {
    if (!d) return;
    // 用 __view 路由（P0 后 DOM 已无 .tab 按钮，不能再依赖 .tab.active）
    var id = getView() || "cap";
    if (id === "cap") renderCap(d);
    else if (id === "ai") renderAI(d);
    else if (id === "models") renderModels();
    else if (id === "info") renderInfo(d);
    else if (id === "ov") renderOv(d);
    else if (id === "stats") renderStats(d);
    else if (id === "sess") renderSessArchive(d);
    else if (id === "week") renderWeekAll(d);
    else if (id === "kb") { if (typeof renderKb === "function") renderKb(); }
    // schedule 是纯 localStorage，启动时已渲染，无需数据
  }
  // ---------- 数据规范化（兜底缺字段，避免 data.json 部分缺失/损坏导致白屏） ----------
  function normalizeData(d) {
    d = d || {};
    d.kpi = d.kpi || {};
    d.status = d.status || {};
    d.status.disk = d.status.disk || {};
    d.skills = Array.isArray(d.skills) ? d.skills : [];
    d.sessions = d.sessions || {};
    d.sessions.recent = Array.isArray(d.sessions.recent) ? d.sessions.recent : [];
    d.sessions.heatmap = Array.isArray(d.sessions.heatmap) ? d.sessions.heatmap : [];
    d.aiDaily = d.aiDaily || {};
    d.aiDaily.sections = Array.isArray(d.aiDaily.sections) ? d.aiDaily.sections : [];
    d.aiDaily.history = Array.isArray(d.aiDaily.history) ? d.aiDaily.history : [];
    d.dailyNews = d.dailyNews || {};
    d.dailyNews.items = Array.isArray(d.dailyNews.items) ? d.dailyNews.items : [];
    d.dailyNews.history = Array.isArray(d.dailyNews.history) ? d.dailyNews.history : [];
    d.weekly = Array.isArray(d.weekly) ? d.weekly : [];
    d.guide = Array.isArray(d.guide) ? d.guide : [];
    d.quickActions = Array.isArray(d.quickActions) ? d.quickActions : [];
    d.knowledge = d.knowledge || {};
    d.knowledge.types = d.knowledge.types || {};
    d.knowledge.files = Array.isArray(d.knowledge.files) ? d.knowledge.files : [];
    return d;
  }
  // 今日复盘（renderTodayReview/saveReview/reviewLoad）已剥到 js/views/dash.js
  function render(d) {
    try {
      d = normalizeData(d);
      setData(d);
      renderHeaderStrip(d);
      renderActiveTab(d);
      renderTodayReview(d);
      if (!__inited) { __inited = true; switchView("home"); }
    } catch (err) {
      console.error("render 出错", err);
      var box = document.getElementById("col-cap");
      if (box && !box.innerHTML) {
        box.innerHTML = '<div class="card"><h2>⚠️ 渲染异常</h2><div class="empty">页面渲染遇到问题：' +
          esc(String((err && err.message) || err)) +
          '。其余内容已尽量保留，可点「立即刷新」重试。</div></div>';
      }
    }
  }

  // ---------- 侧边栏多视图切换（首页只留今日，其余模块侧边栏切换） ----------
  var __inited = false;
  function switchView(v) {
    setView(v);
    document.querySelectorAll(".side-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === v);
    });
    var titles = {
      home: ["今日", "WorkBuddy 本地面板 · 聚焦今日代办与复盘"],
      dash: ["仪表盘", "本机 Skills / 会话 / 收藏 / 入口总览"],
      cap: ["能力速达", "本机 Skills 速查与一键启动"],
      ai: ["AI 助手", "用大白话回答你的问题"],
      models: ["模型管理", "AI 平台与模型配置"],
      info: ["资讯", "AI 日报与每日新闻"],
      ov: ["系统状态", "本机运行环境与服务健康度"],
      stats: ["Skill 统计", "Skills 数量与分类分布"],
      sess: ["会话档案", "本机会话记录与活跃热力图"],
      week: ["本周动态", "近期变化与里程碑"],
      schedule: ["课程表", "本地课程表管理"],
      kb: ["知识库", "Obsidian vault 浏览 / 检索 / 双链 / 沉淀"]
    };
    var t = titles[v] || ["", ""];
    var h = document.getElementById("viewTitle"); if (h) h.textContent = t[0];
    var s = document.getElementById("viewSub"); if (s) s.textContent = t[1];
    // 统一容器体系：隐藏所有 .view，显示 #view-<v>（home/dash 与其余 10 个已收敛为同一套）
    document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
    var target = document.getElementById("view-" + v);
    if (target) target.classList.add("active");
    try { localStorage.setItem("wb_tab", v); } catch (e) {}
    if (getData()) renderActiveTab(getData());
  }
  window.switchView = switchView;

  // ---------- 同步健康度（数据新鲜度 + 失败/陈旧告警） ----------
  function renderFreshness(d) {
    var el = document.getElementById("freshness");
    if (!el) return;
    var st = (d && d.status) || {};
    var parts = [];
    var since = function (ds) {
      if (!ds) return "未知";
      var t = new Date(String(ds).slice(0, 10) + "T00:00:00").getTime();
      var days = Math.max(0, Math.round((Date.now() - t) / 86400000));
      if (days === 0) return "今天";
      if (days === 1) return "昨天";
      return days + " 天前";
    };
    if (st.skillsLastUpdate) parts.push("skills 数据 " + since(st.skillsLastUpdate));
    if (st.memoryLastUpdate) parts.push("记忆库 " + since(st.memoryLastUpdate));
    el.textContent = parts.length ? parts.join(" · ") + " · " : "";
  }
  function renderSync(d) {
    var el = document.getElementById("syncStatus");
    if (!el) return;
    var s = d.sync;
    if (!s || !s.lastRun) {
      el.className = "sync-status warn";
      el.textContent = "⚠️ 暂无同步记录，定时任务可能未运行";
      return;
    }
    var last = new Date(s.lastRun.replace(" ", "T"));
    var stale = (s.staleHours != null) ? s.staleHours : 2;
    var diffMs = Date.now() - last.getTime();
    var diffH = diffMs / 3600000;
    var hhmm = (last.getMonth() + 1) + "-" + last.getDate() + " " +
      ("0" + last.getHours()).slice(-2) + ":" + ("0" + last.getMinutes()).slice(-2);

    if (s.status === "fail" || diffH > stale) {
      el.className = "sync-status warn";
      var overdue = diffH > 0 ? "，已超时约 " + (diffH >= 1 ? diffH.toFixed(1) + " 小时" : Math.round(diffMs / 60000) + " 分钟") : "";
      el.textContent = "⚠️ 同步可能已停止（上次 " + hhmm + overdue + "）· 定时任务或网络异常";
    } else {
      el.className = "sync-status ok";
      var next = s.nextRun ? new Date(s.nextRun.replace(" ", "T")) : null;
      var nextStr = next ? (" · 下次约 " + ("0" + next.getHours()).slice(-2) + ":" + ("0" + next.getMinutes()).slice(-2)) : "";
      el.textContent = "✅ 同步正常（上次 " + hhmm + nextStr + "）";
    }
  }

  // ---------- 启动 ----------
  var __lastGen = "";
  var __lastMod = "";
  // fetchT 已抽到 js/core/net.js
  function loadData() {
    return fetchT("data.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (r.ok) __lastMod = r.headers.get("Last-Modified") || ""; return r.json(); })
      .then(function (d) { render(d); __lastGen = d.generatedAt || ""; return d; });
  }
  // 数据变化时自动重渲染（覆盖自动/手动同步），免去手动刷新浏览器
  // HEAD 优先：先取文件头对比 Last-Modified，没变就跳过正文下载，省 99% 流量
  function maybeReload() {
    // 加 cache-buster 穿透 GitHub Pages 边缘缓存，确保拿到最新 Last-Modified（否则旧缓存让误判"没变"→ 顶部同步状态卡在旧快照）
    return fetchT("data.json?t=" + Date.now(), { method: "HEAD", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) return false;
        var lm = r.headers.get("Last-Modified") || "";
        if (lm && lm === __lastMod) return false;
        return fetchT("data.json?t=" + Date.now(), { cache: "no-store" })
          .then(function (rr) { return rr.json(); })
          .then(function (d) {
            d = normalizeData(d);
            setData(d);
            renderHeaderStrip(d);
            renderActiveTab(d);
            __lastGen = d.generatedAt || "";
            __lastMod = lm;
            return true;
          });
      })
      .catch(function () { return false; });
  }
  // ---------- 立即刷新：路线 A（本地）触发本机 local_refresh.py ----------
  // 保留下方 GitHub Actions 相关函数（pollUntilSynced 等），供路线 B（云同步）启用
  function refreshData() {
    var btn = document.getElementById("refreshBtn");
    var old = btn ? btn.textContent : "同步数据";
    if (btn) { btn.disabled = true; btn.textContent = "⏳ 本机刷新中…"; }
    WB.dialog.toast("已开始同步（后台跑约 5–30 秒）", "info", 1800);
    fetchT("/api/refresh", { method: "POST" }, 8000).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      if (btn) btn.textContent = "⏳ 抓取资讯与数据…";
      // 看看 server 是否告知「已在跑」：200 OK 但 running=true 表示这是重复点击，复用已有任务
      try {
        r.clone().json().then(function (j) {
          if (j && j.running) WB.dialog.toast("刷新任务正在执行中，请稍候", "info", 2200);
        });
      } catch (e) {}
      localReloadWait(btn, old, 0);
    }).catch(function () {
      // 本地刷新服务不可达（静态服务器 / file:// 打开）：退化为重读磁盘上的数据
      if (btn) { btn.disabled = false; btn.textContent = old; }
      loadData().then(function () {
        WB.dialog.toast("⚠️ 当前打开方式不支持触发刷新（需用 server.py 启动工作台）。\n已重新加载磁盘上的最新数据；计划任务每小时会自动刷新。", "warn", 4500);
      }).catch(function () {
        WB.dialog.toast("刷新失败：无法访问 data.json。", "err", 3500);
      });
    });
  }
  // 轮询本地数据直到 generatedAt 变化（本地刷新全程约 5-30 秒）
  // 优化：第 1 次 2s 后立刻查（让"开始"反馈更明确）；之后按 5s 节流
  function localReloadWait(btn, old, tries) {
    var MAX = 12; // 12 × 5s = 1 分钟
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.toast("数据可能没变化（已轮询 1 分钟）。下次每小时自动任务或再点一次试试。", "warn", 4000);
      loadData().catch(function () {});
      return;
    }
    if (btn) btn.textContent = "⏳ 等待新数据 (" + (tries + 1) + "/" + MAX + ")";
    setTimeout(function () {
      maybeReload().then(function (reloaded) {
        if (reloaded) {
          if (btn) { btn.disabled = false; btn.textContent = old; }
          WB.dialog.toast("✅ 同步完成，数据已更新", "ok", 2400);
        }
        else localReloadWait(btn, old, tries + 1);
      });
    }, tries === 0 ? 2000 : 5000);
  }

  // 轮询本次触发的运行，完成后等 Pages 重新部署再刷新页面
  function pollUntilSynced(btn, old, tries, afterTs) {
    var MAX = 24; // 24 × 10s ≈ 4 分钟
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.alert("同步任务已提交，但本机 Runner 似乎没在运行（任务一直排队）。\n请确认本机 Runner 进程已启动，或稍后手动刷新浏览器。");
      loadData().catch(function () {});
      return;
    }
    var runsApi = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/runs?per_page=10";
    fetch(runsApi, {
      headers: {
        "Authorization": "Bearer " + ghToken(),
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then(function (r) { return r.json(); }).then(function (j) {
      // 取 created_at >= afterTs 的最新一次运行
      var runs = (j.workflow_runs || []).filter(function (x) {
        return new Date(x.created_at).getTime() >= afterTs;
      }).sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      var run = runs[0] || null;
      if (run && run.status === "completed") {
        if (run.conclusion === "success") {
          if (btn) btn.textContent = "✅ 同步完成，刷新中…";
          tightReload(btn, old, 0);
        } else {
          if (btn) { btn.disabled = false; btn.textContent = old; }
          WB.dialog.alert("本次同步运行失败（" + (run.conclusion || "unknown") + "），请到 GitHub Actions 看日志。");
          loadData().catch(function () {});
        }
      } else if (run && (run.status === "in_progress" || run.status === "queued" || run.status === "waiting")) {
        if (btn) btn.textContent = "本机 Runner 执行中… (" + (tries + 1) + "/" + MAX + ")";
        setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
      } else {
        // 列表里还没出现本次触发，继续等
        setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
      }
    }).catch(function () {
      setTimeout(function () { pollUntilSynced(btn, old, tries + 1, afterTs); }, 10000);
    });
  }
  // 同步完成后紧轮询：每 10s 看一次数据，直到 generatedAt 变化（新数据已上线）再复位按钮
  function tightReload(btn, old, tries) {
    if (tries >= 30) { // 30 × 10s ≈ 5 分钟，给 GitHub Pages 部署留足时间
      if (btn) { btn.disabled = false; btn.textContent = old; }
      WB.dialog.alert("本机同步已完成，但 GitHub Pages 上线略有延迟。\n页面会在后台继续检测，30 秒内若数据上线会自动刷新；也可稍后手动刷新浏览器。");
      return;
    }
    if (btn) btn.textContent = "✅ 同步完成，刷新中… (" + (tries + 1) + "/30)";
    maybeReload().then(function (reloaded) {
      if (reloaded) { if (btn) { btn.disabled = false; btn.textContent = old; } }
      else setTimeout(function () { tightReload(btn, old, tries + 1); }, 10000);
    });
  }
  window.refreshData = refreshData;

  // ---------- 功能自检：一键验证「触发 → 同步 → 自动刷新」全链路 ----------
  function setSelfCheck(cls, msg) {
    var box = document.getElementById("selfCheckResult");
    if (!box) return;
    box.className = "selfcheck" + (cls ? " " + cls : "");
    box.style.display = "block";
    box.textContent = msg;
  }
  function selfCheck() {
    var btn = document.getElementById("selfCheckBtn");
    var token = ghToken();
    if (!token) {
      setSelfCheck("warn", "⚠️ 需先填 GitHub Token（点「🌙」旁的 或首次点「立即刷新」会提示）");
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = "🔍 自检中…"; }
    setSelfCheck("run", "步骤 1/4 · 正在触发同步…");

    var api = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/dispatches";
    var afterTs = Date.now() - 3000;
    fetch(api, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ ref: "main" })
    }).then(function (r) {
      if (r.ok) return;
      if (r.status === 401 || r.status === 403) throw new Error("Token 无效或权限不足（HTTP " + r.status + "）");
      if (r.status === 404) throw new Error("找不到同步工作流（404）");
      throw new Error("触发失败：HTTP " + r.status);
    }).then(function () {
      pollSelfCheck(btn, afterTs, 0);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "❌ 自检中断：" + err.message);
    });
  }
  function pollSelfCheck(btn, afterTs, tries) {
    var MAX = 24;
    if (tries >= MAX) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "❌ 超时：本机 Runner 一直没响应，请确认 Runner 服务在运行");
      return;
    }
    var runsApi = "https://api.github.com/repos/" + GH_REPO + "/actions/workflows/sync.yml/runs?per_page=10";
    fetch(runsApi, {
      headers: {
        "Authorization": "Bearer " + ghToken(),
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then(function (r) { return r.json(); }).then(function (j) {
      var runs = (j.workflow_runs || []).filter(function (x) {
        return new Date(x.created_at).getTime() >= afterTs;
      }).sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      var run = runs[0] || null;
      if (run && run.status === "completed") {
        if (run.conclusion === "success") {
          setSelfCheck("run", "步骤 3/4 · 同步成功 (run " + run.id + ")，等待数据上线…");
          tightReloadSelfCheck(btn, 0);
        } else {
          if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
          setSelfCheck("warn", "❌ 同步运行失败（" + (run.conclusion || "unknown") + "），请到 GitHub Actions 看日志");
        }
      } else if (run && (run.status === "in_progress" || run.status === "queued" || run.status === "waiting")) {
        setSelfCheck("run", "步骤 2/4 · Runner 执行中（" + run.status + "）…");
        setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
      } else {
        setSelfCheck("run", "步骤 2/4 · 等待 Runner 接收任务…");
        setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
      }
    }).catch(function () {
      setTimeout(function () { pollSelfCheck(btn, afterTs, tries + 1); }, 10000);
    });
  }
  function tightReloadSelfCheck(btn, tries) {
    if (tries >= 30) {
      if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
      setSelfCheck("warn", "⚠️ 同步已完成，但数据上线略有延迟，页面会在后台自动刷新");
      return;
    }
    maybeReload().then(function (reloaded) {
      if (reloaded) {
        if (btn) { btn.disabled = false; btn.textContent = "🔍 功能自检"; }
        setSelfCheck("ok", "✅ 自检通过：触发 → 同步 → 自动刷新 全链路正常");
      } else {
        setTimeout(function () { tightReloadSelfCheck(btn, tries + 1); }, 10000);
      }
    });
  }
  // ---------- 常用入口（纯前端，本机 localStorage 存，不依赖 data.json） ----------
  var LINKS_KEY = "wb_links";
  var DEFAULT_LINKS = [
    {"label": "GitHub", "url": "https://github.com"},
    {"label": "哔哩哔哩", "url": "https://www.bilibili.com"},
    {"label": "小宇宙播客", "url": "https://www.xiaoyuzhoufm.com"},
    {"label": "飞书", "url": "https://www.feishu.cn"},
    {"label": "WorkBuddy 文档", "url": "https://www.workbuddy.cn/docs/"},
    {"label": "AI 日报源", "url": "https://aihot.virxact.com/daily"},
    {"label": "每日新闻源", "url": "https://github.com/vikiboss/60s"}
  ];
  function getLinks() {
    try { var v = localStorage.getItem(LINKS_KEY); if (v) return JSON.parse(v); } catch (e) {}
    return DEFAULT_LINKS.slice();
  }
  function saveLinks(a) { try { localStorage.setItem(LINKS_KEY, JSON.stringify(a)); } catch (e) {} }
  function renderLinks() {
    var g = document.getElementById("linksGrid");
    if (!g) return;
    var links = getLinks();
    if (!links.length) { g.innerHTML = '<div class="empty">还没有入口，点“加一个”添加常用链接</div>'; return; }
    g.innerHTML = links.map(function (l, i) {
      return '<a class="link-item" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
        '<span class="li-ic"></span><span class="li-label">' + esc(l.label) + '</span>' +
        '<span class="li-del" data-i="' + i + '" title="删除">✕</span></a>';
    }).join("");
    Array.prototype.forEach.call(g.querySelectorAll(".li-del"), function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        delLink(parseInt(b.getAttribute("data-i"), 10));
      });
    });
  }
  function addLink() {
    WB.dialog.prompt("入口名称", "", function (label) {
      if (!label) return;
      label = label.trim();
      if (!label) return;
      WB.dialog.prompt("链接地址", "https://", function (url) {
        if (url === null) return;
        url = (url || "").trim();
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        var links = getLinks(); links.push({ label: label, url: url }); saveLinks(links); renderLinks();
        var h = document.getElementById("linksHint"); if (h) h.textContent = "✓ 已添加（仅存本浏览器）";
      }, null, "以 http 开头，可留空自动补 https://");
    }, null, "如：抖音");
  }
  function delLink(i) {
    var links = getLinks(); if (i < 0 || i >= links.length) return;
    links.splice(i, 1); saveLinks(links); renderLinks();
  }

  // ---------- 一键导出（速记/待办/收藏/入口 → Markdown） ----------
  // ---------- 今日概览（KPI + 头条 + 引导 → 一键发给 AI 助手） ----------
  function copyToday() {
    var d = getData();
    if (!d) { aiAsk("今日数据还没加载完，请稍等几秒再点。"); return; }
    var lines = [];
    var k = d.kpi || {};
    lines.push("今天是 " + (d.generatedAt ? String(d.generatedAt).slice(0, 10) : "") + "，我的工作台现状：");
    lines.push("- 已装 " + (k.skills || 0) + " 个 skills，知识库 " + (k.knowledge || 0) + " 个文件，定时任务 " + (k.automations || 0) + " 个，记忆库 " + (k.memory || 0) + " 个文件");
    var disk = (d.status && d.status.disk) || {};
    if (disk.D) lines.push("- D 盘可用 " + disk.D.free + "G（共 " + disk.D.total + "G）");
    var news = (d.dailyNews && d.dailyNews.items) || [];
    if (news.length) {
      lines.push("- 今日新闻 Top3：");
      news.slice(0, 3).forEach(function (n, i) { lines.push((i + 1) + ". " + n.title); });
    }
    var ai = (d.aiDaily && d.aiDaily.count) || 0;
    if (ai) lines.push("- AI 日报已抓取 " + ai + " 条");
    var guide = d.guide || [];
    if (guide.length) {
      lines.push("- 今日引导：" + guide.slice(0, 2).join("；"));
    }
    lines.push("");
    lines.push("请基于以上信息，给我今天最值得做的 3 件事（结合我的 skill 和知识库）。");
    aiAsk(lines.join("\n"));
  }
  function exportAll() {
    var now = new Date();
    var p2 = function (n) { return ("0" + n).slice(-2); };
    var ds = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate());
    var lines = ["# 个人工作台导出 · " + ds, ""];
    var todos = todosLoad();
    if (todos.length) {
      lines.push("## 待办清单（" + todos.filter(function (t) { return t.done; }).length + "/" + todos.length + "）");
      todos.forEach(function (t) { lines.push("- [" + (t.done ? "x" : " ") + "] " + t.text); });
      lines.push("");
    }
    var notes = notesLoad();
    if (notes.length) {
      lines.push("## 我的速记");
      notes.forEach(function (n) { lines.push("- " + n.text); });
      lines.push("");
    }
    var favs = favsLoad();
    if (favs.length) {
      lines.push("## 我的收藏（稍后读）");
      favs.forEach(function (f) { lines.push("- [" + f.title + "](" + (f.url || "") + ")" + (f.source ? " · " + f.source : "")); });
      lines.push("");
    }
    var links = getLinks();
    if (links.length) {
      lines.push("## 常用入口");
      links.forEach(function (l) { lines.push("- [" + l.label + "](" + l.url + ")"); });
      lines.push("");
    }
    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "工作台导出_" + ds + ".md";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- 数据备份 / 恢复（JSON，可完整还原） ----------
  function backupExport() {
    var data = { notes: notesLoad(), todos: todosLoad(), favs: favsLoad(), links: getLinks() };
    var payload = { app: "lite_workbench_web", version: 1, exportedAt: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var p2 = function (n) { return ("0" + n).slice(-2); };
    var d = new Date();
    a.download = "工作台备份_" + d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function doImportBackup(m) {
    if (!m || !m.data || typeof m.data !== "object") { WB.dialog.alert("不是有效的工作台备份文件"); return; }
    WB.dialog.confirm("导入将用备份覆盖当前的 速记 / 待办 / 收藏 / 常用入口。\n确定继续吗？（建议先点“备份”存一份当前数据）", function () {
      var d = m.data;
      if (d.notes) notesSave(d.notes);
      if (d.todos) todosSave(d.todos);
      if (d.favs) favsSave(d.favs);
      if (d.links) saveLinks(d.links);
      renderNotes(); renderTodos(); renderFavs(); renderLinks();
      WB.dialog.alert("✓ 已恢复备份（速记 / 待办 / 收藏 / 常用入口）");
    });
  }
  function backupImportFromFile(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (e) {
      try { doImportBackup(JSON.parse(String(e.target.result))); }
      catch (err) { WB.dialog.alert("备份文件解析失败：" + err.message); }
    };
    r.onerror = function () { WB.dialog.alert("读取文件失败"); };
    r.readAsText(f, "utf-8");
    input.value = "";
  }
  function backupImport() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () { backupImportFromFile(inp); };
    inp.click();
  }
  window.backupExport = backupExport; window.backupImport = backupImport;

  // ---------- 头部实时时钟 ----------
  function updateClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    var now = new Date();
    var wd = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    var p2 = function (n) { return ("0" + n).slice(-2); };
    el.textContent = "🕐 " + (now.getMonth() + 1) + "-" + p2(now.getDate()) + " 周" + wd + " " + p2(now.getHours()) + ":" + p2(now.getMinutes()) + ":" + p2(now.getSeconds());
  }
  window.exportAll = exportAll; window.updateClock = updateClock; window.copyToday = copyToday; window.backupExport = backupExport; window.backupImport = backupImport;
  window.addLink = addLink; window.delLink = delLink; window.renderLinks = renderLinks;

  window.selfCheck = selfCheck;
  applyTheme();
  renderNotes();
  renderSchedule();
  renderLinks();
  renderTodos();
  renderFavs();
  updateClock();
  setInterval(updateClock, 1000);
  pomoRender();
  // 本地无课程表时，自动从云端拉取一次（换设备也能看到）
  if (!scheduleLoad().length) schedulePullCloud(true);
  var ni = document.getElementById("noteInput");
  if (ni) ni.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } });
  var ti = document.getElementById("todoInput");
  if (ti) ti.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); } });
  loadData().catch(function (e) {
    document.getElementById("col-cap").innerHTML = '<div class="card"><h2>⚠️ 数据加载失败</h2><div class="empty">无法读取 data.json：' + esc(e) + "。10 秒后自动重试。</div></div>";
    // 网络抖动恢复：10 秒后自动重试一次
    setTimeout(function () { loadData().catch(function () {}); }, 10000);
  });
  // 恢复上次停留的标签页
  var lastTab = "";
  try { lastTab = localStorage.getItem("wb_tab") || ""; } catch (e) {}
  if (lastTab === "news" || lastTab === "dnews") lastTab = "info"; // 资讯 Tab 合并兼容
  if (lastTab && lastTab !== "cap") switchView(lastTab);

  // 后台自动刷新：每 30s 检测数据是否更新，有变化就自动重渲染（覆盖每小时自动同步）
  // 页面不可见（切后台标签页）时暂停轮询省流量/电量，回到前台立即补查一次
  var pollTimer = setInterval(maybeReload, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    } else {
      if (!pollTimer) pollTimer = setInterval(maybeReload, 30000);
      maybeReload();
    }
  });

  // 全局键盘增强：按 / 聚焦搜索（不在输入框时）；按 Esc 关闭热力图弹窗
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var hm = document.getElementById("heat-detail");
      if (hm && hm.style.display === "flex") { closeHeat(); return; }
    }
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) {
      var q = document.getElementById("q");
      if (q) { e.preventDefault(); q.focus(); q.select(); }
    }
  });

  // 离线提示：断网时顶部出现提示条，恢复后自动消失（复用已有 Service Worker 离线缓存能力）
  var offlineEl = null;
  function showOffline(on) {
    if (on && !offlineEl) {
      offlineEl = document.createElement("div");
      offlineEl.className = "offline-bar";
      offlineEl.textContent = "当前离线 · 正在显示已缓存的数据";
      var hd = document.querySelector(".header");
      if (hd && hd.parentNode) hd.parentNode.insertBefore(offlineEl, hd);
    } else if (!on && offlineEl) {
      if (offlineEl.parentNode) offlineEl.parentNode.removeChild(offlineEl);
      offlineEl = null;
    }
  }
  window.addEventListener("offline", function () { showOffline(true); });
  window.addEventListener("online", function () { showOffline(false); });
  if (!navigator.onLine) showOffline(true);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ---------- PWA 安装引导（Android/Chrome 一键装，iOS 给说明） ----------
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installEvt = e;
    var b = document.getElementById("installBtn");
    if (b) b.style.display = "";
  });
  window.addEventListener("appinstalled", function () {
    installEvt = null;
    var b = document.getElementById("installBtn");
    if (b) b.style.display = "none";
  });
  window.promptInstall = function () {
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      WB.dialog.alert("iPhone / iPad 安装方法：点浏览器底部「分享」按钮 → 「添加到主屏幕」，之后就能像 App 一样从桌面打开。");
      return;
    }
    if (!installEvt) {
      WB.dialog.alert("当前浏览器不支持一键安装。可以打开浏览器菜单 →「添加到主屏幕 / 安装应用」，效果一样。");
      return;
    }
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; });
  };
