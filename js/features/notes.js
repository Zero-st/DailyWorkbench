// 功能：我的速记（localStorage，纯前端）。从 app.js 剥出，行为不变。
// notesLoad/notesSave/renderNotes 供 app.js（boot/backup）与 dash 视图 import；
// addNote/delNote/editNote 挂 window 供内联 onclick。
import { esc, undoSnack, dialog } from "../core/util.js";

export function notesLoad() {
  try { return JSON.parse(localStorage.getItem("wb_notes") || "[]"); } catch (e) { return []; }
}
export function notesSave(list) { try { localStorage.setItem("wb_notes", JSON.stringify(list)); } catch (e) {} }

export function renderNotes() {
  var ul = document.getElementById("notesList");
  if (!ul) return;
  var list = notesLoad();
  if (!list.length) { ul.innerHTML = '<li class="empty">还没有速记，记一笔吧～</li>'; return; }
  ul.innerHTML = list.map(function (n, i) {
    return '<li class="note"><span class="nt">' + esc(n.text) + '</span>' +
      '<button class="nd" onclick="editNote(' + i + ')" title="编辑">✎</button>' +
      '<button class="nd" onclick="delNote(' + i + ')" title="删除">✕</button></li>';
  }).join("");
}
function addNote() {
  var ta = document.getElementById("noteInput");
  var t = (ta.value || "").trim();
  var h = document.getElementById("notesHint");
  if (!t) { if (h) h.textContent = "先写点内容"; return; }
  var list = notesLoad();
  list.unshift({ text: t, at: Date.now() });
  notesSave(list); ta.value = ""; if (h) h.textContent = "✓ 已添加";
  renderNotes();
}
function delNote(i) {
  var list = notesLoad();
  if (i < 0 || i >= list.length) return;
  var removed = list[i];
  list.splice(i, 1); notesSave(list); renderNotes();
  undoSnack("已删除速记", function () {
    var l = notesLoad(); l.splice(Math.min(i, l.length), 0, removed); notesSave(l); renderNotes();
  });
}
function editNote(i) {
  var list = notesLoad();
  if (i < 0 || i >= list.length) return;
  dialog.prompt("编辑这条速记", list[i].text || "", function (t) {
    if (t === null) return;
    t = (t || "").trim();
    if (!t) { delNote(i); return; }
    list[i].text = t; list[i].at = Date.now(); notesSave(list); renderNotes();
  });
}

window.addNote = addNote;
window.delNote = delNote;
window.editNote = editNote;
