// 核心网络层（ES Module）：带超时的 fetch，防止网络挂起导致页面一直"加载中"。
// 供 app.js（loadData/maybeReload/refresh）与 js/views/ai.js（/api/chat）共用。
export function fetchT(url, opts, ms) {
  ms = ms || 15000;
  var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
  var o = opts || {};
  if (ctrl) o.signal = ctrl.signal;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
  return fetch(url, o).then(
    function (r) { clearTimeout(timer); return r; },
    function (e) { clearTimeout(timer); throw e; }
  );
}
