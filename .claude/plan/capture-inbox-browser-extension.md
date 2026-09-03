# 实施计划 · 捕获收件箱 + 浏览器扩展（已完成 2026-09-03）

> 设计与取舍：`docs/design/捕获收件箱-浏览器扩展-设计.md`、`docs/adr/0006`
> 版本：CHANGELOG `v0.10.0`；路线图 v1.6（Phase 2 捕获侧落地）

## 背景一句话
刷小红书/B站/微博/即刻看到好帖子好想法没有低摩擦落点。原收件箱要"离开帖子、回工作台粘链接"，
本轮把捕获前移到**读帖现场**：选中一段 + 写感悟 → 一次点击进收件箱 → 之后一键升级成六维经验卡。

## 四步（全部完成）

### A · 后端 API ✅
- 新增 `backend/clients/inbox.py`：真源 `inbox.local.json`（gitignore），tmp+`os.replace` 原子写，
  损坏备份 `.bak` 空启动；去重（url+摘录+**感悟** 三者全同，60s 窗口）；`update` 字段白名单
  （只允许 status/note/tags）；`excerpt` 截 5000 字。
- `backend/core/config.py` 加 `inbox_path()`（env `WB_INBOX_PATH` > `workbench.local.json` 的 `inbox.path` > 仓根默认）。
- `backend/server.py` 加五路由 + **Origin 允许列表**（放行无 Origin / 本机 / `chrome-extension://`，其余 403）。

### B · 工作台侧 ✅
- `js/features/inbox.js` 重写为 **API 优先 + 离线队列**（后端挂了写 localStorage 标 `pending`，
  恢复后 `_flush()` 自动补推）；渲染摘录引用块 + 感悟 + 来源角标；拖拽即存。
- `js/views/distill.js`：`_distillCmd(plat,url,extra)` 带摘录时改为「据此提炼、无需抓取」；
  `distillNew(prefill)` 预填 url/平台/摘录；修 `distillPickPlat` 读 `p.emoji` 的旧 bug。
- `js/core/platforms.js` 扩微博/即刻；**平台兜底**：后端不存 platform，前端按 url 现算。
- `css/styles.css` 加收件箱 v2 样式。

### C · 浏览器扩展 ✅
`extension/`（MV3，无需构建）：`manifest.json` · `background.js`（右键菜单 + 唯一 fetch 出口 +
非四站 `scripting` 临时注入）· `content.js`（浮按钮 + shadow DOM 面板，**零站点解析**）·
`popup.html/.js`（快速存 + 端口/浮按钮设置 + 连接状态）· `icons/`（PIL 生成四尺寸）。

### D · 文档与门禁 ✅
设计文档 + ADR 0006 + `docs/README.md` 索引 + CHANGELOG v0.10.0 + 路线图 v1.6 +
README 场景 E（安装两步）与配置表 + `workbench.local.json.example` 加 `inbox` 段。

## 测试与门禁结果
- `pytest`：**29 passed**（新增收件箱回归 14 条，覆盖去重/白名单/状态枚举/截断/损坏恢复/无 tmp 残留）。
- `bump_version.py --check`：✓ 已同步（24 资产，CACHE=workbench-6f486d31）。
- JS 语法门禁：inbox/distill/platforms/app + 扩展三个 JS + manifest 全 OK。
- 端到端：扩展 Origin 存条目、恶意 Origin 403、两条不同想法不误去重、离线队列补推、
  蒸馏指令内嵌摘录输出正确、启动横幅含收件箱路径。

## 过程中发现并修掉的两个真 bug
1. **去重会静默丢想法**：原去重只比 url+摘录，两条纯想法（二者皆空）被误判重复 →
   已把 `note` 纳入去重身份，并加两条回归测试锁住。
2. **扩展条目显示"未标注"**：设计上 Python 侧不复制域名表，故后端不存 `platform`，
   但前端渲染直接读该字段 → 加 `_plat(it)` 用 `detectPlatform(url)` 兜底（渲染/蒸馏/归档三处）。

另记：`node --check` 对本项目 ES module 会**假阴性**（漏报未闭合字符串）。
已改用"区分 SyntaxError 与运行时错误"的 `import()` 门禁，脚本见会话 scratchpad。

## 仍未做（有意留白）
- **不上云**：Supabase `capture_inbox` 与多端同步仍属路线图 Phase 3（单向门，需另写 ADR）。
- **不做后端自动抓正文**：反爬+需登录，且人工摘录已解决；引 playwright 会碰"零依赖"北极星。
- 扩展未做快捷键、角标计数、多段高亮；`/api/kb/save` 的同类 Origin 加固留作可选项。

## 下一步建议
先 dogfood 一周：真装扩展、真刷平台、真存卡，看「摘录+感悟」是否确实让蒸馏更省力，
再决定要不要补多段高亮或上云。
