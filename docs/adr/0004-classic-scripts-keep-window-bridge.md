# 0004 经典脚本不转 ES Module，沿用 window 桥接修潜伏 bug
- 背景：`schedule.js`/`kb.js`/`model-manager.js` 是经典脚本，读 `window.__data/__view` 的守卫长期空转（潜伏 bug）。
- 决策：不把三者转成 ES Module；改由 `state.js` 的 setData/setView 唯一镜像 `window.__data/__view`、`ai.js` 暴露 `window.renderAI`，让既有守卫真正生效。
- 理由：转模块要为每个内联 `onclick` 重挂 window、回归面大、收益低（YAGNI）；沿用项目既有的 window 桥接（同 `window.WB` 工具桥）是最低风险的正确修法。
- 代价：保留了 window 全局桥接面（但集中在少数写入方）；何时重估——这些脚本需被模块 import 复用时。
