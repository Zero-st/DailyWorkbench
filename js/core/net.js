// 核心网络层（ES Module）：带超时的 fetch，防止网络挂起导致页面一直"加载中"。
// 供 app.js（loadData/maybeReload/refresh）与 js/views/ai.js（/api/chat）共用。

/**
 * data.json 的前端契约（单一真源）。后端 export_data.py 聚合产出，前端各视图消费。
 * app.js 的 normalizeData() 会兜底缺字段，故这里字段多为可选；新增字段请同步此处。
 * 2026-09-20 起契约收窄为 9 个顶层键：本机遥测八键（kpi/skills/status/sessions/knowledge/
 * weekly/guide/quickActions）随其消费视图一并切除，见 docs/adr/0013-drop-workbuddy-telemetry.md。
 * @typedef {Object} WBData
 * @property {string} [generatedAt] 快照生成时间
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, sections?:Array, history?:Array}} [aiDaily] AI 日报
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, cover?:string, tip?:string, items?:Array, history?:Array}} [dailyNews] 每日新闻
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, items?:Array, history?:Array}} [hackerNews] Hacker News 热帖（经 OpenCLI 取数层）
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, items?:Array, history?:Array}} [githubTrending] GitHub Trending 今日热门（经 OpenCLI 取数层）
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, items?:Array, history?:Array}} [productHunt] Product Hunt 每日新品（stdlib Atom 取数）
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, items?:Array, history?:Array}} [sspai] 少数派上新（stdlib RSS 取数）
 * @property {{count?:number, date?:string, source?:string, fetchedAt?:string, canonical?:string, items?:Array, history?:Array}} [x] X/推特热议（经 grok-cli 取数层，见 ADR 0012）
 * @property {{lastRun?:string, nextRun?:string, status?:string, staleHours?:number}} [sync] 同步健康度
 *
 * 资讯各源的单条 item 形如 {title, url, summary, source}；enrich 步骤（backend/pipeline/enrich.py）
 * 会额外注入 aiSummary(string, 统一质量一句话摘要) 与 aiTags(string[], 标签)——前端优先展示、
 * 缺失则回退原始 summary。此为 data.json 契约扩字段（单向门，见 ADR 0011）。
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
