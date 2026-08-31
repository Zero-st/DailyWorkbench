// 内联 SVG 图标库（Feather/Lucide 描边风，24 栅格，currentColor）。
// 为什么存在：OS 缺 emoji 字体时 emoji 渲染成豆腐块 ☒，图标不能依赖系统字体。
// 统一走已有的 .ic-svg（css/styles.css 已定义尺寸/对齐），供动态视图拼 HTML 字符串用。
// 侧边栏等静态图标直接在 index.html 内联，二者共用同一套描边风格。

// name -> 内部 path/line 片段（不含 <svg> 外壳）
var P = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  // 平台徽标
  tv: '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  beaker: '<path d="M10 2v7.31l-5.7 9.32A1 1 0 0 0 5.16 20h13.68a1 1 0 0 0 .86-1.37L14 9.31V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>'
};

/**
 * 返回一个内联 SVG 图标字符串。未知名返回空串（安全降级）。
 * @param {string} name 图标名（P 的键）
 * @param {string} [cls] 追加的 class
 * @returns {string}
 */
export function icon(name, cls) {
  var d = P[name];
  if (!d) return "";
  return '<svg class="ic-svg' + (cls ? " " + cls : "") +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
}
