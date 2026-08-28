// 核心网络层（ES Module）：带超时的 fetch，防止网络挂起导致页面一直"加载中"。
// 供 app.js（loadData/maybeReload/refresh）与 js/views/ai.js（/api/chat）共用。

/**
 * data.json 的前端契约（单一真源）。后端 export_data.py 聚合产出，前端各视图消费。
 * app.js 的 normalizeData() 会兜底缺字段，故这里字段多为可选；新增字段请同步此处。
 * @typedef {Object} WBData
 * @property {string} [generatedAt] 快照生成时间
 * @property {{knowledge?:number, automations?:number, skills?:number, sessions?:number, memory?:number, models?:number}} [kpi] 顶部 KPI 计数
 * @property {{disk?:Object.<string,{free:number,total:number}>, localModels?:Array, skillsLastUpdate?:string, memoryLastUpdate?:string}} [status] 本机运行状态
 * @property {Array<{name:string, category:string, cmd:string, desc:string, usage?:number}>} [skills] 已装 Skills
 * @property {{recent?:Array, heatmap?:Array}} [sessions] 会话档案与热力图
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, sections?:Array, history?:Array}} [aiDaily] AI 日报
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, cover?:string, tip?:string, items?:Array, history?:Array}} [dailyNews] 每日新闻
 * @property {Array} [weekly] 本周动态
 * @property {string[]} [guide] 今日引导
 * @property {Array<{icon:string, label:string, cmd:string}>} [quickActions] 快捷启动
 * @property {{types?:Object, files?:Array}} [knowledge] 知识库
 * @property {{lastRun?:string, nextRun?:string, status?:string, staleHours?:number}} [sync] 同步健康度
 */

/**
 * 带超时的 fetch。超时后 abort，reject 抛错，供调用方 .catch 兜底。
 * @param {string} url 请求地址
 * @param {RequestInit} [opts] fetch 选项（会注入 AbortController.signal）
 * @param {number} [ms=15000] 超时毫秒
 * @returns {Promise<Response>}
 */
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
