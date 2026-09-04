# DailyWorkbench · 开工先读（只做指针，规则不在这里重复）

1. **文档归位**：`docs/README.md` 是单一真源——新文档按后缀词表落位，落位后补它的 §4 索引。
2. **工程红线**：`docs/TECH_CHARTER.md`——零构建 · 零依赖 · 离线可跑；禁 `|| true` 假绿；改 `data.json` 契约 = 单向门（写 ADR）。
3. **动前端必读**：`docs/design/界面设计准则.md` = 本仓的 DESIGN.md。
   - 新视觉语言 / 新组件类 / 新布局骨架 → **先按准则 §6.0 出一页 HTML 效果图过目，再写代码**；沿用现成类的小改不用。
   - 只用 token 变量，不硬编码颜色，不写裸像素；图标内联 SVG（准则 §4）。
4. **改了 `css/ js/ index.html` 任何资产** → 跑 `python bump_version.py`（CI `--check` 会红）。
5. **令牌门禁**：`python check_design_tokens.py`——引用未定义变量直接红；化石令牌只许降不许升。
6. **心法**：`docs/principles/开发心法-多维思维总纲.md`——每一步只戴一顶帽子，想法阶段别跳到写代码。
