# prompt-refine：吸收生态同类的两条经验 + 迁一份到项目级

## Context

用户问「生态里有没有和我的 `prompt-refine` 类似的 skill」。搜索 + **逐个拉原文核对**（遵循"装前核对原文"纪律，不用二手摘要）后的结论是：

**没有可替代品，但有两条值得吸收的具体经验。**

核对过的候选（均已读到真实 SKILL.md）：

| 候选 | 装机/★ | 判定 |
|---|---|---|
| `affaan-m/ecc@prompt-optimizer` | 10.8K / ★263K | 契约几乎相同（"never executes the task itself"），连中文触发词都有；**但绑定 ECC 框架**，用户不用 ECC → 不装 |
| `nidhinjs/prompt-master` | 2.8K / ★13.4K | 最直接的通用同类，多目标工具；**但"必须先确认目标工具、不确定就问"与 prompt-refine"不打断"设计冲突** → 不装 |
| `getsentry/skills@prompt-optimizer` | 1.6K / ★1.0K | 互补而非同类（生产 system prompt + eval + 跨模型移植）→ 本次不装 |
| `google-labs-code@enhance-prompt` | **56.3K** / ★8.3K | ❌ Google Stitch 专用 UI 提示词，装机量第一但不适用 |
| `github/awesome-copilot@boost-prompt` | 9.8K / ★39K | ❌ 硬依赖 Joyride（VS Code Clojure 插件）+ 追问式交互，与设计相反 |
| `github/awesome-copilot@prompt-builder` | 9.5K | ❌ 该 skill 名在仓库中**不存在**，搜索结果是死目录 |

本地也无重复：`harvest-prompts` 是下游（收尾沉淀入库），`brainstorming`/`grilling` 是需求探索与追问。

用户决定：**只借鉴不装**，并**顺便把 prompt-refine 迁一份到项目级**。

预期结果：`prompt-refine` 补上两个真实缺口（中文"优化"歧义误触发、单条 prompt 里的高编造风险框架），并在本仓可用。

---

## 改动 1：补负向触发排除（借鉴 ECC prompt-optimizer）

**缺口**：现 `description` 的边界只说了"用户要直接做那件事就别用"，**没排除中文"优化"本身的歧义**。「优化代码」「优化性能」「优化这个 SQL」里的"优化"极易误触发一个提示词打磨 skill。ECC 那份专门写了这条排除，是实战打磨出来的。

**改哪里**：`~/.claude/skills/prompt-refine/SKILL.md` 的 frontmatter `description` 末尾，在现有「**边界**：…」之后追加一句，形如：

> 尤其**不要**因为出现"优化"二字就触发——「优化代码」「优化性能」「优化这条 SQL」「优化这个查询」是重构/调优任务，不是优化提示词。

**注意**：`description` 是单行 YAML 值，追加时保持在同一行，不要引入换行破坏 frontmatter。改完确认 `name:` / `description:` 仍能被解析（前 4 行结构完好）。

## 改动 2：把"高编造风险框架"写进第 7 条（借鉴 prompt-master）

**缺口**：现 §三-7 已说"Opus 4.x 等强模型不必默认套 CoT 脚手架"，方向对但**只点了 CoT**。prompt-master 的硬规则更具体，且给出了**为什么**：

原文要点（已核对）——在**单条 prompt** 语境里优先用简单技法（角色设定、few-shot、grounding anchors、显式验收标准）；下列元推理框架**编造风险更高**，只在用户明确要求且目标工具支持时才用：

- **Mixture of Experts** — 单次前向传播里"模拟"多角色路由
- **Tree of Thought** — 模拟分支，但没有真正的并行执行
- **Graph of Thought** — 需要外部图引擎，多数工具没有
- **Universal Self-Consistency** — 需要独立多次采样

**共同机理**：这些技法**要求 prompt 之外的执行机制**（多次采样 / 并行分支 / 外部引擎）。在单条 prompt 里只能让模型"假装"执行，于是产出看似有推理过程、实则编造的内容。这正好接上 prompt-refine 已有的论证方式（它在第 3 条里也用"单个 user turn 不是 API system-role"这种机制层面的理由解释角色为何弱）。

**改哪里**：`SKILL.md` §「第三步」第 7 条，在现有 CoT 说明后并入上述清单与机理。保持该文件既有风格：**给机制理由，不只给结论**。

**不借鉴的**（明确记录，避免日后反复）：prompt-master 的「不确认目标工具就不出稿、不确定就问」与 prompt-refine §二「默认不打断、缺口写 `〔待补：…〕`」直接冲突。若想覆盖图像/视频生成等目标差异大的场景，正确做法是**在优化稿里加 `〔待补：目标模型/工具〕` 占位符**，而不是引入一次打断。

## 改动 3：迁一份到项目级

把 `~/.claude/skills/prompt-refine/`（`SKILL.md` + `evals/evals.json`，共约 2 文件）**复制**到 `/home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine/`。

- 用 `cp -a`，用户级原件保留（与上轮四个 skill 的处理一致）。
- **先改后迁**：两处内容改动先落在用户级，再复制，避免两边一出生就不一致。
- 不复制 `prompt-refine-workspace/`（那是评测工作区，非 skill，无 `SKILL.md`）。
- **无需新 ADR**：ADR 0014 的单向门是 `node_modules` 入 git；本次是约 100KB 纯文本，无不可逆代价。但 ADR 0014 已记载的「同名并存会静默漂移」风险**适用于本次**——迁移后 `prompt-refine` 也成为用户级/项目级各一份。
- 前端资产未动，**不需要** `bump_version.py`；`check_design_tokens.py` 不扫 `.claude/`，不受影响。

## 收尾：按用户 CLAUDE.md 规则归位本计划

本文件由 harness 固定写在 `~/.claude/plans/`。执行完后复制一份到项目内长期留存：
`/home/dev_st/mtools/DailyWorkbench/.claude/plan/prompt-refine-借鉴生态同类.md`

---

## 验证

1. **frontmatter 未破坏**（改动 1 的主要风险）：
   ```bash
   head -4 ~/.claude/skills/prompt-refine/SKILL.md
   python -c "import sys;t=open('/home/dev_st/.claude/skills/prompt-refine/SKILL.md',encoding='utf-8').read().split('---')[1];print('YAML 段行数:',len(t.strip().splitlines()))"
   ```
   期望：`---` / `name: prompt-refine` / `description: …`（单行）/ `---`，YAML 段恰好 2 行。

2. **两份一致**：
   ```bash
   diff -r ~/.claude/skills/prompt-refine /home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine && echo "✅ 两级内容一致"
   ```

3. **git 范围可控**：
   ```bash
   cd /home/dev_st/mtools/DailyWorkbench && git status --porcelain -uall | grep prompt-refine | wc -l
   ```
   期望 2（`SKILL.md` + `evals/evals.json`），**不应**出现 workspace 文件。

4. **真正的行为验证**（只有新会话能做，本轮会话不会重新加载 skill）：新开一个会话，分别说
   - 「帮我优化这段提示词：<随便一句>」→ 应触发 prompt-refine，交还成稿、**不执行**
   - 「帮我优化下这段代码的性能」→ **不应**触发（验证改动 1）

   改动 2 的效果不易黑盒验证，以 `SKILL.md` 中该段落存在且论证完整为准。
