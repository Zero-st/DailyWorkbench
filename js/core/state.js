// 共享应用状态（ES Module）：数据快照 __data 与当前视图 __view 的唯一真源。
// 原为 app.js 私有闭包变量，抽出后可被各视图模块 import 共享。
//
// window 镜像（C 步·修潜伏 bug）：schedule.js / kb.js / model-manager.js 是经典脚本
// 无法 import，沿用项目既有的 window.* 桥接（同 window.WB 工具桥）读状态——
//   · model-manager.js 改模型配置后 `if (window.__data && renderAI) renderAI(window.__data)`
//     需要 window.__data；配合 window.renderAI（见 ai.js）令 AI 视图真正随模型刷新；
//   · kb.js 的 30s 轮询用 window.__view 判断「仅在 kb 视图时重建树」。
// 故本模块是 window.__data/__view 的唯一写入方，setData/setView 负责镜像，保持一致。
/** @typedef {import("./net.js").WBData} WBData */

/** @type {WBData|null} */
var _data = null;
/** @type {string} */
var _view = "home";
window.__view = _view; // 初值镜像，供经典脚本守卫读取

/** @returns {WBData|null} 当前数据快照 */
export function getData() { return _data; }
/** @param {WBData} d @returns {WBData} 设置并镜像到 window.__data */
export function setData(d) { _data = d; window.__data = d; return d; }
/** @returns {string} 当前视图 id */
export function getView() { return _view; }
/** @param {string} v @returns {string} 设置并镜像到 window.__view */
export function setView(v) { _view = v; window.__view = v; return v; }
