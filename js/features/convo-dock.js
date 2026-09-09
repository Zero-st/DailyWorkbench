// 右侧全局「AI 副驾 dock」：浮遊 · 可调宽高 · 记忆尺寸/开合。取代原「AI 助手」整页视图。
// 宿主 = 现成 AI 聊天引擎（js/views/ai.js 的 renderAI/aiSend/agentStream）——dock 只提供
// 浮遊可缩放外壳 + 收起 launcher，不重造聊天。挂载点唯一：dock body 即 #col-ai（renderAI
// 目标不变），故 aiChat/aiBox id 唯一、wb_ai_history 不分叉。
// 讲讲/提炼/存库 经 window.dockAsk（ai.js）喂进来开讲；空手点 launcher 也可直接聊。
// 显隐用 .open 类而非 [hidden]：CSS 里 .convo-dock{display:flex} 会盖过 [hidden]（踩过的坑）。
import { renderAI } from "../views/ai.js";
import { ic } from "../core/util.js";

var OPEN_KEY = "wb_dock_open";
var RECT_KEY = "wb_dock_rect";
var MIN_W = 300, MAX_W = 760, MIN_H = 320;
var TOP = 74, GAP = 14;   // 距顶（避开头部）/ 距右边缘

var dock = null, launcher = null, rendered = false;

function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function maxW() { return Math.min(MAX_W, window.innerWidth - 40); }
function maxH() { return window.innerHeight - TOP - GAP; }

function loadRect() {
  try { var r = JSON.parse(ls(RECT_KEY) || "null"); if (r && r.w && r.h) return r; } catch (e) {}
  return { w: 400, h: Math.min(640, Math.max(MIN_H, window.innerHeight - TOP - GAP)) };
}
function applyRect() {
  if (!dock) return;
  var r = loadRect();
  dock.style.width = Math.max(MIN_W, Math.min(maxW(), r.w)) + "px";
  dock.style.height = Math.max(MIN_H, Math.min(maxH(), r.h)) + "px";
}
function saveRect() {
  if (dock) lsSet(RECT_KEY, JSON.stringify({ w: dock.offsetWidth, h: dock.offsetHeight }));
}
function ensureRendered() {
  if (rendered) return;
  try { renderAI(); rendered = true; } catch (e) {}
}

function open() {
  if (!dock) return;
  dock.classList.add("open");
  if (launcher) launcher.classList.add("hide");
  applyRect();
  ensureRendered();
  lsSet(OPEN_KEY, "1");
  var box = document.getElementById("aiBox");
  if (box) { try { box.focus(); } catch (e) {} }
}
function close() {
  if (!dock) return;
  dock.classList.remove("open");
  if (launcher) launcher.classList.remove("hide");
  lsSet(OPEN_KEY, "0");
}
function toggle() { if (dock && dock.classList.contains("open")) close(); else open(); }

function wireResize() {
  var sx, sy, sw, sh, mode;
  function move(e) {
    if (mode.indexOf("w") >= 0) dock.style.width = Math.max(MIN_W, Math.min(maxW(), sw + (sx - e.clientX))) + "px";
    if (mode.indexOf("h") >= 0) dock.style.height = Math.max(MIN_H, Math.min(maxH(), sh + (e.clientY - sy))) + "px";
  }
  function up() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.body.style.userSelect = "";
    saveRect();
  }
  function start(m) {
    return function (e) {
      e.preventDefault();
      mode = m; sx = e.clientX; sy = e.clientY; sw = dock.offsetWidth; sh = dock.offsetHeight;
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    };
  }
  dock.querySelector(".dock-rz-l").addEventListener("pointerdown", start("w"));
  dock.querySelector(".dock-rz-b").addEventListener("pointerdown", start("h"));
  dock.querySelector(".dock-rz-c").addEventListener("pointerdown", start("wh"));
}

export function initConvoDock() {
  if (dock) return;
  dock = document.createElement("aside");
  dock.className = "convo-dock";
  dock.id = "convoDock";
  dock.style.top = TOP + "px";
  dock.style.right = GAP + "px";
  dock.innerHTML =
    '<div class="dock-rz-l" title="拖动调整宽度"><span class="grip"></span></div>' +
    '<div class="dock-rz-b" title="拖动调整高度"></div>' +
    '<div class="dock-rz-c" title="拖动调整大小"></div>' +
    '<div class="dock-head">' +
      '<span class="dock-title">' + ic("messageCircle") + ' AI 副驾</span>' +
      '<span class="dock-sp"></span>' +
      '<button class="dock-ico" type="button" data-act="close" title="收起为侧边标签" aria-label="收起副驾">' + ic("x") + '</button>' +
    '</div>' +
    '<div class="dock-body" id="col-ai"></div>';
  document.body.appendChild(dock);

  launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "dock-launcher";
  launcher.id = "dockLauncher";
  launcher.setAttribute("aria-label", "打开 AI 副驾");
  launcher.innerHTML = ic("messageCircle") + '<span class="dl-t">AI 副驾</span>';
  document.body.appendChild(launcher);

  launcher.addEventListener("click", open);
  dock.querySelector('[data-act="close"]').addEventListener("click", close);
  wireResize();
  applyRect();

  window.dockOpen = open;
  window.dockClose = close;
  window.dockToggle = toggle;

  if (ls(OPEN_KEY) === "1") open();
}
