// 功能：待办清单（可勾选，localStorage 纯前端）。从 app.js 剥出，行为不变。
// todosLoad/todosSave/renderTodos 供 app.js（boot/backup）与 dash 视图 import；
// addTodo/toggleTodo/delTodo/clearDone 挂 window 供内联 onclick。
import { esc, undoSnack } from "../core/util.js";

var TODO_KEY = "wb_todos";
export function todosLoad() {
  try { return JSON.parse(localStorage.getItem(TODO_KEY) || "[]"); } catch (e) { return []; }
}
export function todosSave(list) { try { localStorage.setItem(TODO_KEY, JSON.stringify(list)); } catch (e) {} }
export function renderTodos() {
  var ul = document.getElementById("todosList");
  if (!ul) return;
  var list = todosLoad();
  var done = list.filter(function (t) { return t.done; }).length;
  var prog = document.getElementById("todoProg");
  if (prog) {
    if (!list.length) {
      prog.innerHTML = '<span class="empty">还没有待办，写一条吧～</span>';
    } else {
      var pct = Math.round(done / list.length * 100);
      prog.innerHTML =
        '<span class="todo-badge">✓ ' + done + ' / ' + list.length + '</span>' +
        '<span class="todo-progress-bar"><span class="todo-progress-fill" style="width:' + pct + '%"></span></span>' +
        '<span style="font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums">' + pct + '%</span>';
    }
  }
  if (!list.length) { ul.innerHTML = '<li class="empty">还没有待办，写一条吧～</li>'; return; }
  ul.innerHTML = list.map(function (t, i) {
    return '<li class="todo' + (t.done ? " done" : "") + '">' +
      '<input type="checkbox" class="tc" ' + (t.done ? "checked" : "") + ' onchange="toggleTodo(' + i + ')">' +
      '<span class="tt">' + esc(t.text) + '</span>' +
      '<button class="nd" onclick="delTodo(' + i + ')" title="删除">✕</button></li>';
  }).join("");
}
function addTodo() {
  var ta = document.getElementById("todoInput");
  var t = (ta.value || "").trim();
  var h = document.getElementById("todosHint");
  if (!t) { if (h) h.textContent = "先写点内容"; return; }
  var list = todosLoad();
  list.unshift({ text: t, done: false, at: Date.now() });
  todosSave(list); ta.value = ""; if (h) h.textContent = "✓ 已添加";
  renderTodos();
}
function toggleTodo(i) {
  var list = todosLoad();
  if (i < 0 || i >= list.length) return;
  list[i].done = !list[i].done;
  todosSave(list); renderTodos();
}
function delTodo(i) {
  var list = todosLoad();
  if (i < 0 || i >= list.length) return;
  var removed = list[i];
  list.splice(i, 1); todosSave(list); renderTodos();
  undoSnack("已删除待办", function () {
    var l = todosLoad(); l.splice(Math.min(i, l.length), 0, removed); todosSave(l); renderTodos();
  });
}
function clearDone() {
  var list = todosLoad().filter(function (t) { return !t.done; });
  todosSave(list); renderTodos();
  var h = document.getElementById("todosHint");
  if (h) h.textContent = "✓ 已清除已完成";
}

window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.delTodo = delTodo;
window.clearDone = clearDone;
