---
name: tdd
description: Test-driven development, scaled to change size. Small/incremental changes route to minimal-test-first (最小测试先行); non-trivial changes (new module, new seam, new external dependency, multi-branch logic) run full red-green-refactor TDD. Use when the user wants to build a feature or fix a bug test-first, mentions "tdd"/"red-green-refactor"/"测试先行"/"最小测试", or wants integration tests.
---

# Test-Driven Development(按改动量分档)

本仓测试纪律分两档,先判档、再选路径——不是所有改动都值得上完整红绿循环,但也不是所有改动都能只跑最小验证就完事。

## Phase 0:判档

先判断这次改动属于哪一档,再决定往下走哪条路径:

**小改动 → 走「最小测试先行」**(成本最低,默认起点):
- 复用既有模块/接口的模式,不引入新 seam
- 外部依赖(LLM/向量库/HTTP 端点)没有变化
- 分支逻辑少(≤2~3 个可枚举分支),没有新状态机
- 修 bug/加字段/调参数这类局部改动

→ 直接按 `docs/开发测试规范.md` 的五级阶梯推进(静态门 → 纯逻辑单测 → 单点接口最小测试 → 单模块小样 → 全绿后全量),阶梯全绿即可提交,**不必**额外写红绿测试循环。该文档是这一档的单一来源,细节(已知坑点清单、反例)不在这里重复。

**复杂改动 → 走「完整 TDD 红绿循环」**(本文件下方章节):
- 新增模块/新领域概念,或接口/seam 本身还没定型
- 首次接入某个外部依赖(新 API、新向量库、新协议)
- 存在状态机或多分支的业务逻辑
- 这块代码历史上出过 bug、之前缺测试覆盖

**不确定归哪档时,默认从「最小测试先行」起步**——它成本低,如果第一级验证就暴露出复杂度(分支比预期多、seam 定不下来),再升级到下面的完整 TDD 循环,而不是一上来就大动干戈。

若任务是"报错了/坏了/变慢了"这种已存在的故障排查,不属于本 skill——改用 `diagnosing-bugs`。

---

## 以下适用于「复杂改动」

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

### What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines. (示例用 TS/jest 语法写,原理跨语言通用,本仓 Python/纯 JS 部分按同样原则套用即可。)

### Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?"

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "design-principles" for the vocabulary — this repo's equivalent of the module/interface/depth/seam reference.

### Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

### Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.
