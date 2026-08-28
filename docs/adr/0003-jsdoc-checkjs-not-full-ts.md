# 0003 类型化用 JSDoc + checkJs，不换全量 TypeScript
- 背景：想要类型安全，但 `.ts` 必须经 tsc 编译，浏览器不认。
- 决策：普通 `.js` 里用 JSDoc 标类型 + `jsconfig.json` 开 `checkJs`，只覆盖干净模块边界（`state.js`/`net.js`）。
- 理由：全量 TS 违背零构建立身之本（[0001](0001-zero-build-north-star.md)）；且 TS 最大收益（多人契约/大规模重构）对单人打折，视图层字符串拼接 TS 也基本管不到。
- 代价：JSDoc 比 TS 语法啰嗦、只标边界不追全覆盖；何时重估——已因别的原因引入构建，或有第二人长期维护。
