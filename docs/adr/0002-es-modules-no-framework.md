# 0002 前端用原生 ES Modules，不上 React/Vue、不引构建
- 背景：`app.js` 曾长成 2139 行单 IIFE，痛点是"没有模块"，不是"没有框架"。
- 决策：用浏览器原生 ES Modules（`import`/`export` + `<script type="module">`）拆分，保留原生 JS。
- 理由：ES Modules 直接拿到高内聚低耦合，零 webpack/vite、零 node_modules 腐烂风险，契合北极星（[0001](0001-zero-build-north-star.md)）。
- 代价：需经 http 加载（`file://` 双击受限，但项目本有 `server.py`/`http.server`）；何时重估——引入构建或多人维护时再议框架。
