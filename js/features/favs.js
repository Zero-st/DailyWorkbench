// 功能：我的收藏 / 稍后读（localStorage 纯前端）。跨 dash（renderFavs）、
// info（isFav/favToggle）、backup（favsLoad/favsSave）共用，故独立成 feature 模块。
// 从 app.js 剥出，行为不变。favToggle/delFav/clearFavs/renderFavs 挂 window 供内联 onclick。
import { esc, escAttr, undoSnack } from "../core/util.js";

var FAV_KEY = "wb_favs";
export function favsLoad() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch (e) { return []; } }
export function favsSave(list) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) {} }
export function isFav(url) { return favsLoad().some(function (f) { return f.url === url; }); }
function favToggle(btn, title, url, source) {
  var list = favsLoad();
  var idx = -1;
  list.forEach(function (f, i) { if (f.url === url) idx = i; });
  var added = idx < 0;
  if (added) {
    list.unshift({ title: title, url: url || "", source: source || "", at: Date.now() });
  } else {
    list.splice(idx, 1);
  }
  favsSave(list);
  if (btn) { btn.textContent = added ? "★" : "☆"; btn.classList.toggle("on", added); }
  renderFavs();
  var h = document.getElementById("favsHint");
  if (h) h.textContent = added ? "已收藏" : "已取消收藏";
}
function fmtFavDate(ts) {
  var d = new Date(ts);
  return (d.getMonth() + 1) + "-" + d.getDate();
}
export function renderFavs() {
  var box = document.getElementById("favList");
  if (!box) return;
  var list = favsLoad();
  var h2 = document.querySelector(".fav-card h2");
  if (h2) h2.innerHTML = '我的收藏 · 稍后读（' + list.length + '）';
  if (!list.length) { box.innerHTML = '<li class="empty" style="grid-column:1/-1">还没有收藏，去 AI 日报 / 每日新闻点 ☆ 收藏</li>'; return; }
  box.innerHTML = list.map(function (f, i) {
    var meta = [f.source, f.at ? fmtFavDate(f.at) : ""].filter(Boolean).join(" · ");
    return '<li class="wk"><span class="wk-ic"></span>' +
      '<div class="wk-b">' +
      (f.url ? '<a class="wk-name fav-a" href="' + escAttr(f.url) + '" target="_blank" rel="noopener">' + esc(f.title) + "</a>" : '<span class="wk-name">' + esc(f.title) + "</span>") +
      '<span class="wk-meta">' + esc(meta) + '</span></div>' +
      '<button class="nd" onclick="delFav(' + i + ')" title="移除">✕</button></li>';
  }).join("");
}
function delFav(i) {
  var list = favsLoad(); if (i < 0 || i >= list.length) return;
  var removed = list[i];
  list.splice(i, 1); favsSave(list); renderFavs();
  undoSnack("已移除收藏", function () {
    var l = favsLoad(); l.splice(Math.min(i, l.length), 0, removed); favsSave(l); renderFavs();
  });
}
function clearFavs() {
  if (!favsLoad().length) return;
  favsSave([]); renderFavs();
  var h = document.getElementById("favsHint"); if (h) h.textContent = "✓ 已清空";
}

window.favToggle = favToggle;
window.delFav = delFav;
window.clearFavs = clearFavs;
window.renderFavs = renderFavs;
