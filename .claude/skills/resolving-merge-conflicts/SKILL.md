---
name: resolving-merge-conflicts
description: "在需要解决进行中的 git merge/rebase 冲突时使用。"
---

1. **查看当前状态**:确认 merge/rebase 进行到哪一步,检查 git 历史和冲突文件。

2. **为每处冲突找一手信息源。** 深入理解每处改动当初为什么这么改、原始意图是什么。读 commit message,查 PR,查原始 issue/工单。

3. **逐个 hunk 解决冲突。** 尽量保留双方意图;确实不兼容时,选与本次 merge 目标一致的一边,并记下这次取舍。**不要**臆造新行为。始终解决冲突;绝不 `--abort`。

4. 找出项目已有的**自动化检查**并跑一遍——通常顺序是先 typecheck,再测试,再格式化。修掉 merge 过程中弄坏的东西。

5. **完成 merge/rebase。** 把所有改动 `git add` 后提交。如果是 rebase,持续 continue 直到所有提交都 rebase 完。
