# prompt-refine 增量二：按需查权威来源 + 去掉写死的模型型号

> 上一轮（同一 skill 的增量一）已执行完毕并验证：`description` 补负向触发排除、第 7 条并入高编造风险框架、复制一份到项目级。
> 留档：`.claude/plan/prompt-refine-借鉴生态同类.md`。本轮是下一个增量。

## Context

用户问：能不能给 `prompt-refine` 加"从提示词网站搜索好的提示模板"，怎么判可信度，值不值得。

**核查后的结论是：值得加，但加的不是"搜提示词网站"。** 依据（均已实地抓取核实，非凭印象）：

1. **社区模板站是反面教材，不能作为来源。** `prompts.chat`（原 `f/awesome-chatgpt-prompts`）的 `prompts.csv` 抽样：`I want you to act as a linux terminal`、`I want you to act as an English translator`、`Imagine you are an experienced Ethereum developer`……绝大多数是空头衔套壳，**正是本 skill §3 与「关键原则」明令反对的写法**（"✗ 别给每条都套「你是资深X」"）。让 skill 去那里取材，等于让它抄自己禁止的东西。FlowGPT / PromptBase 同类，且带变现动机。
2. **真正有价值的是厂商官方的分模型指南。** Anthropic 旧的 prompt-library 已下架，`docs.anthropic.com/en/resources/prompt-library/library` 现 301 到
   `platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`；
   同目录下有**按模型分版**的页面（从 overview 页导航抽出，已验证存在）：
   `prompting-claude-opus-5`、`prompting-claude-fable-5-1`、`prompting-claude-sonnet-5`、`prompting-claude-opus-4-8`、`prompting-claude-fable-5`。
   已读 `prompting-claude-opus-5` 正文，覆盖 verbosity、任务切分、子 agent 委派、自我纠错、**thinking 默认开启**等。
3. **本 skill 已经过时了一处。** §第三步第 7 条写死"Opus 4.x 等强模型自身推理已稳"——当前是 Opus 5 / Fable 5.1，且 thinking 多为默认开启。这正是联网能解决的真问题，而"搜模板"解决不了。

用户决定：**按需触发 + 白名单**（不默认每次联网，保住"一步出稿"体验）；**型号不写死**。

预期结果：`prompt-refine` 在少数真正需要时能查到权威、当期的提示工程依据，同时明确挡住会污染输出的模板农场；文案不再随模型换代过期。

---

## 改动 1：新增章节「可选一步：按需查权威来源（默认不查）」

**放哪**：`~/.claude/skills/prompt-refine/SKILL.md`，插在 §「第二步：缺信息怎么办」之后、§「第三步：按这份清单优化」之前——它属于"出稿前的取材"，位置上承接第二步。

**章节内容要点**（按该文件既有风格写：给机制理由，不只给结论）：

**A. 默认不查。** 只在下列三种情况才联网，其余一律直接出稿：
1. 用户指明的目标**不是 Claude**，且该目标有独特的提示格式（Midjourney / 图像 / 视频生成 / 特定 API 的 prompt 结构）；
2. 用户**明确要求**参考现成模板或最佳实践；
3. 目标模型是本文未覆盖的**新型号**，且任务对模型特性敏感（长程 agent、thinking 开关、输出冗长度）。

**B. 来源白名单（分级）**
- **A 级·可直接采信**：模型厂商官方文档。Claude 走
  `platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview`，
  并从该页导航取**当前存在的**分模型页（不写死 slug，页面会随版本增删）。其他厂商同理走各自官方文档。
- **B 级·可参考但需交叉验证**：有署名、引用论文的教育性项目，如 `promptingguide.ai`（DAIR.AI）。用它认技法名称与出处，**不照抄模板**。
- **C 级·明令排除**：`prompts.chat` / `awesome-chatgpt-prompts`、FlowGPT、PromptBase 等社区模板库与模板商店。理由写进文档：**它们的主流写法与本 skill §3 直接冲突**（详见 Context 第 1 条的抽样）。

**C. 可信度判据**（用户要的"判断可信性"，写成可操作的自检，任一条不过就降级或弃用）
1. **谁维护**：模型厂商官方 > 有署名的研究/教育项目 > 匿名社区 > 卖模板的商店。
2. **是否随模型版本更新**：有没有分模型或带日期的页面？**过时的提示工程建议比没有更糟**——它会让你把已被模型内化的脚手架又塞回去。
3. **有没有出处**：给论文/官方文档引用，还是只甩一段"照抄这个"。
4. **有没有变现动机**：卖 prompt、强制注册、满屏广告 → 直接降级。
5. **自洽性抽检**（最快的一条）：抽几条样例，若大量是 `I want you to act as …` 这类空头衔开场，**直接排除**——它与本 skill §3、§关键原则相悖。

**D. 硬护栏**（防止联网反而让输出变差）
- 查到的东西**只是素材，不是模板**：绝不整段套用，只取"该模型/该工具特有的、本文没有的"那部分。
- **用户原意优先**：检索结果不得替用户发明需求，不得改变他的目标；与本 skill 原则冲突时**以本 skill 为准**。
- **看原文，不看摘要**：优先取页面/raw 正文再判断，别只凭搜索结果摘要下结论（此前有过摘要臆造出不存在内容的教训）。
- **仍然不打断**：查归查，缺口照旧写 `〔待补：…〕`，不因为要联网就转成追问。

**E. 优雅降级**：无网络、超时、工具不可用、白名单页 404 → **静默跳过，照常出稿**，最多在「💡 假设」里记一句"未能联网核对，依据本文既有原则"。**不得因此中断或报错**。

## 改动 2：§「语言与目标模型」指向分模型指南

现文只说"默认面向 Claude 优化；若用户指明其他模型/场景，相应调整"。补一句：目标模型特性存疑时，按改动 1 的 A 级来源查当期分模型指南；并说明**为什么**——各代模型在 thinking 默认值、输出冗长度、agent 行为上差异真实存在，套上一代的写法会失准。

## 改动 3：第 7 条去掉写死的型号

把"但 Opus 4.x 等强模型自身推理已稳"改为不绑定具体型号的表述，例如「当代 Claude（Opus 5 / Fable 5.1 / Sonnet 5 等）推理已稳，**且 thinking 多为默认开启**」，并指向 A 级来源而非在文中固化型号清单。**保留**该条已有的 CoT 论证与上一轮加入的高编造风险框架段落，只改会过期的那半句。

## 改动 4：同步到项目级副本

改完用户级后，同步 `/home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine/`（`cp -a` 覆盖），保持两级一致——ADR 0014 已记载同名并存会静默漂移，本次必须同步，不能只改一边。

## 收尾

更新项目内留档 `.claude/plan/prompt-refine-借鉴生态同类.md` 为本轮内容（或另存一份增量二），保持 `.claude/plan/` 与实际改动对得上。

---

## 验证

1. **frontmatter 未破坏**（本轮不改 description，但改动 3 触及正文，仍复查）：
   ```bash
   /home/dev_st/iriswork/tools/anaconda/bin/python -c "
   t=open('/home/dev_st/.claude/skills/prompt-refine/SKILL.md',encoding='utf-8').read().split('---')[1].strip().splitlines()
   print('YAML 行数:',len(t),'✅' if len(t)==2 else '❌')"
   ```

2. **新章节落位正确**（在第二步之后、第三步之前）：
   ```bash
   grep -n "^## " /home/dev_st/.claude/skills/prompt-refine/SKILL.md
   ```
   期望顺序：…第二步 → 可选一步：按需查权威来源 → 第三步…

3. **白名单里的 A 级链接当下可达**（防止写进文档就是死链）：
   ```bash
   curl -sL -o /dev/null -w "%{http_code}\n" \
     "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"
   ```
   期望 200。

4. **两级一致**：
   ```bash
   diff -r /home/dev_st/.claude/skills/prompt-refine \
           /home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine && echo "✅ 一致"
   ```

5. **行为验证（需新会话，本轮做不了）**：
   - 「帮我优化这段发给 Midjourney 的提示词：一只赛博朋克猫」→ 应触发联网（条件 1），且**不得**照搬社区模板的空头衔写法；
   - 「帮我优化这段提示词：总结这篇文章」→ **不应**联网，直接出稿（保住一步出稿）；
   - 断网环境下重复上一条 → 仍正常出稿，不报错。
