// 核心工具层（ES Module）：纯工具函数 + 自定义弹窗 + 复制/撤销。
// 从原 app.js 抽出，行为完全一致。
// 经典子脚本（schedule.js/kb.js/model-manager.js）仍通过 window.WB.* 惰性取用，
// 内联 onclick 仍靠 window.cmd/cmdtext/... 找人；故本模块求值时把常用工具挂到
// window.WB 与 window.*（见文件末尾「兼容桥接」）。

// ---------- 线条图标库（Feather Icons，MIT，统一 stroke 风格） ----------
export var ICONS = {
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  checkSquare: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  edit2: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  barChart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  barChart2: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  trendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  messageCircle: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  refreshCw: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  hardDrive: '<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
};
// 渲染一个线条图标（颜色跟随 currentColor，尺寸由 CSS 控制）
export function ic(name, extra) {
  var p = ICONS[name] || ICONS.grid;
  return '<svg class="ic-svg' + (extra ? " " + extra : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
}

// 分类中英文映射（上游英文 kebab-case，未命中回退原值）
export var CAT_ZH = {
  "academic-writing": "学术写作",
  "content": "内容创作",
  "document-generation": "文档生成",
  "通用能力": "通用能力"
};
export function catLabel(c) { return CAT_ZH[c] || c; }

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function escAttr(s) {
  return esc(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}
// 内联 JS 字符串安全转义：HTML 实体转义会在 onclick 里被浏览器解码成 ' 反而炸掉 JS 串，
// 这里转成 '（JS 里不冲突、不会被实体解码）
export function jsStr(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\u0027");
}

// ---------- 自定义弹窗（替代原生 alert/prompt/confirm，风格统一） ----------
export var dialog = (function () {
  function close() {
    var m = document.querySelector(".wb-mask");
    if (m) m.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "Enter") {
      var ok = document.querySelector('.wb-dlg [data-role="ok"]');
      if (ok) ok.click();
    }
  }
  function open(opts) {
    close();
    var mask = document.createElement("div");
    mask.className = "wb-mask";
    var dlg = document.createElement("div");
    dlg.className = "wb-dlg";
    var h = "<h3>" + esc(opts.title || "提示") + "</h3>";
    if (opts.msg) h += '<div class="wb-dlg-msg">' + esc(opts.msg) + "</div>";
    var inp = opts.input === undefined
      ? ""
      : '<input class="wb-dlg-in" value="' + escAttr(String(opts.input)) + '"' +
        (opts.placeholder ? ' placeholder="' + escAttr(opts.placeholder) + '"' : "") + ">";
    h += inp +
      '<div class="wb-dlg-acts">' +
      (opts.hideCancel ? "" : '<button class="btn-sm" data-role="cancel">取消</button>') +
      '<button class="btn" data-role="ok">' + esc(opts.okText || "确定") + "</button>" +
      "</div>";
    dlg.innerHTML = h;
    mask.appendChild(dlg);
    document.body.appendChild(mask);
    var okBtn = dlg.querySelector('[data-role="ok"]');
    var cancelBtn = dlg.querySelector('[data-role="cancel"]');
    var inputEl = dlg.querySelector(".wb-dlg-in");
    okBtn.onclick = function () {
      var v = inputEl ? inputEl.value : null;
      close();
      if (opts.onOk) opts.onOk(v);
    };
    if (cancelBtn) cancelBtn.onclick = function () { close(); if (opts.onCancel) opts.onCancel(); };
    if (inputEl) { inputEl.focus(); inputEl.select(); }
    document.addEventListener("keydown", onKey, true);
  }
  return {
    alert: function (msg, onOk) { open({ title: "提示", msg: msg, hideCancel: true, onOk: onOk }); },
    confirm: function (msg, onOk, onCancel) { open({ title: "确认", msg: msg, okText: "确定", onOk: onOk, onCancel: onCancel }); },
    prompt: function (title, defVal, onOk, onCancel, placeholder) {
      open({ title: title, input: defVal || "", okText: "保存", onOk: onOk, onCancel: onCancel, placeholder: placeholder });
    },
    // 轻量顶部提示：进度/成功/失败场景替代 alert，避免被浏览器策略吞掉
    // kind: 'info' | 'ok' | 'warn' | 'err'；ms 默认 2400（成功/失败延后 3s）
    toast: function (msg, kind, ms) {
      var k = kind || "info";
      var life = ms || (k === "ok" || k === "warn" || k === "err" ? 3200 : 2400);
      var box = document.getElementById("wb-toast-host");
      if (!box) {
        box = document.createElement("div");
        box.id = "wb-toast-host";
        document.body.appendChild(box);
      }
      var t = document.createElement("div");
      t.className = "wb-toast wb-toast-" + k;
      t.textContent = msg;
      box.appendChild(t);
      // 强制 reflow + 加 show 类，CSS 触发入场动画
      void t.offsetWidth;
      requestAnimationFrame(function () { t.classList.add("show"); });
      setTimeout(function () {
        t.classList.remove("show");
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
      }, life);
    }
  };
})();

// ---------- 复制指令（降级 + 按钮即时反馈） ----------
function flashCopied(btn, ok) {
  if (!btn) return;
  if (!btn.dataset.origText) btn.dataset.origText = btn.textContent;
  btn.textContent = ok ? "✓ 已复制" : "❗ 请手动复制";
  btn.classList.toggle("flashed", ok);
  btn.classList.toggle("flashed-fail", !ok);
  clearTimeout(btn._flashT);
  btn._flashT = setTimeout(function () {
    btn.textContent = btn.dataset.origText;
    btn.classList.remove("flashed", "flashed-fail");
  }, 1800);
}
export function robustCopy(t, hintId, okMsg, failMsg, btn) {
  var set = function (ok) {
    var h = document.getElementById(hintId);
    if (h) h.textContent = ok ? ("✓ " + okMsg) : ("⚠ " + failMsg);
    flashCopied(btn, ok);
  };
  var fb = function () {
    try {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy"); document.body.removeChild(ta); set(ok);
    } catch (e) { set(false); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () { set(true); }).catch(function () { fb(); });
  } else { fb(); }
}
export function cmd(el) {
  var c = el.getAttribute("data-cmd");
  safeFillCmdbox(c);
  robustCopy(c, "hint", "已复制，到对话框 Ctrl+V 粘贴并发送", "复制被拦截，请手动选中上方框 Ctrl+C", el);
}
// 安全填入 cmdbox 并聚焦；textarea 隐藏时 focus() 会抛错，用 try/catch 兜底
function safeFillCmdbox(t) {
  try {
    var box = document.getElementById("cmdbox");
    if (!box) return;
    box.value = t || "";
    try { box.focus(); box.select(); } catch (e) {}
  } catch (e) { /* 静默，复制是主功能 */ }
}
export function cmdtext(t) {
  safeFillCmdbox(t);
  // 反推调用源按钮：内联 onclick 会先把按钮 focus，所以 document.activeElement 就是按钮
  var btn = document.activeElement;
  if (!btn || btn.tagName !== "BUTTON") btn = null;
  robustCopy(t, "hint", "已复制，到对话框 Ctrl+V 粘贴并发送", "复制被拦截，请手动选中上方框 Ctrl+C", btn);
}

// ---------- 通用删除撤销（底部 toast，4 秒可撤销） ----------
export function undoSnack(msg, undoFn) {
  var old = document.querySelector(".undo-toast"); if (old && old.parentNode) old.parentNode.removeChild(old);
  var el = document.createElement("div");
  el.className = "undo-toast";
  var span = document.createElement("span");
  span.textContent = msg;
  var btn = document.createElement("button");
  btn.className = "undo-btn";
  btn.textContent = "撤销";
  var done = false;
  var timer = setTimeout(function () {
    if (done) return;
    el.classList.add("hide");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
  }, 4000);
  btn.onclick = function () {
    if (done) return; done = true; clearTimeout(timer);
    try { undoFn(); } catch (e) {}
    el.classList.add("hide");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
  };
  el.appendChild(span); el.appendChild(btn);
  document.body.appendChild(el);
}

// ---------- 兼容桥接：经典子脚本（window.WB.*）与内联 onclick（window.*） ----------
// 共享工具命名空间：schedule.js 等子模块通过 window.WB.esc 惰性取用（加载顺序无关）。
var WB = window.WB = window.WB || {};
WB.esc = esc;
WB.ic = ic;
WB.jsStr = jsStr;
WB.dialog = dialog;
window.cmd = cmd;
window.cmdtext = cmdtext;
window.robustCopy = robustCopy;
window.undoSnack = undoSnack;
