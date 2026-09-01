---
name: doc-filing
description: 在 DailyWorkbench 仓内新建/移动「项目文档」时用它决定放哪个目录、怎么命名。触发场景：要生成 docs 下的设计/评审/指南/选型/路线图/复盘/方案等 .md，或整理归位已有文档。不含实施计划（那走 .claude/plan）。
---

# doc-filing · 文档归位与命名

**唯一真源是 [`docs/README.md`](../../../docs/README.md)**（分类树 + 命名后缀词表 + 决策表）。本 skill 只是「开工前先读它、按它落位」的强制入口，规则不在这里重复维护——**先读 `docs/README.md`，再动手**。

## 何时用
- 要在 `docs/` 下新建一篇 md（设计说明 / 评审 / 操作指南 / 选型调研 / 路线图 / 复盘 / 方案 …）。
- 要整理、移动、重命名已有项目文档。

## 三步归位
1. **判性质**（照 `docs/README.md` §3 决策表）：
   - 单向门决策 → `docs/adr/NNNN-<kebab>.md`
   - 实施计划/待办规划 → **不进 docs/**，放 `.claude/plan/<task>.md`
   - 版本变更 → 仓根 `CHANGELOG.md`，不新开文件
   - 否则 → 进 `docs/<分类>/`
2. **选目录 + 定后缀**（照 §2 后缀词表）：`-指南`→guides／`-设计`·`-评审`·`-方案`→design／`-选型`·`-地图`·`-账本`→research／`-路线图`·`-总览`·`-复盘`→planning／`-规范`·宪章→docs 根／`*.sql`·生成 html→reference。文件夹用小写英文 kebab；文件用中文语义名 + 上述后缀（跨社区标准名如 TECH_CHARTER/README/CHANGELOG 保留英文）。
3. **落位后**：把新文档补进 `docs/README.md` §4 索引表；若被别的文档/代码引用，确认相对链接可解析。

## 红线
- 不在 `docs/` 根随手堆平铺文件——除治理两篇（TECH_CHARTER / 版本管理规范）外，都要进对应子目录。
- 不把实施计划塞进 docs/（反之亦然）。
- 改了归属或命名规则，**先改 `docs/README.md`**，本 skill 不留副本。
