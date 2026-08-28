// 共享应用状态（ES Module）：数据快照 __data 与当前视图 __view 的唯一真源。
// 原为 app.js 私有闭包变量，抽出后可被各视图模块 import 共享。
//
// 注（重要）：本步暂不镜像到 window.__data / window.__view，保持现状——
// model-manager.js / kb.js 里读 window.__data / window.__view 的守卫当前恒为
// undefined（空转），行为与重构前一致；这一潜伏 bug 留到 C 步（那两个文件转
// ES Module、直接 import 本模块）时一并修，避免在本步引入行为变化。
var _data = null;
var _view = "home";

export function getData() { return _data; }
export function setData(d) { _data = d; return d; }
export function getView() { return _view; }
export function setView(v) { _view = v; return v; }
