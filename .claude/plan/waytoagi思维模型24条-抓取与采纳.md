# 抓取 WayToAGI 飞书文档 → 生成仓内文档 → 据此再优化 prompt-refine

> 前两轮（同一 skill 的增量一、二）已执行完毕并留档在 `.claude/plan/prompt-refine-借鉴生态同类.md`、
> `.claude/plan/prompt-refine-按需查权威来源.md`。本轮是新任务：引入一份外部资料。

## Context

用户给了 `https://waytoagi.feishu.cn/wiki/YXENwsiS6i0hZFkKBimcjCN6nIc`，要求：**总结 → 生成文档 → 参照它再优化 prompt-refine**。

已核实的现状：

- **该页在登录墙后**：`curl` 被 302 到 `accounts.feishu.cn/accounts/page/login`，纯 HTTP 抓不到正文。
- **本机 19222 调试 Chrome 可达**（实测返回 `Chrome/146.0.7680.153`），但当前只开着一个标签（工作台 `127.0.0.1:8899`），**没有飞书页，且该 profile 是否已登录飞书未知**。
- `bun` 未安装、`npx` 可用（`/home/dev_st/.nvm/.../npx`），`baoyu-url-to-markdown` 可走 `npx -y bun`。
- 仓内**没有**提示工程类文档；`docs/research/蒸馏方法论-开源参考地图.md` 是"外部资料参考地图"的现成先例，落位与写法可对齐。

用户已定：**用本机 Chrome 抓** · **文档落仓内 `docs/` 按后缀词表** · **优化目标是 `prompt-refine`**。

**本计划的一个前提**：正文尚未读到，所以第 3 步只能给出**采纳判据**，不预先编造具体改动——读完正文才知道有什么可吸收。这是有意为之，不是遗漏。

---

## 第 1 步：抓取正文

用 `baoyu-url-to-markdown`（项目级已有副本），连 19222 那个已运行的 Chrome。

- 若该 profile **已登录飞书** → 直接抽成 markdown。
- 若**未登录** → 走它的「等用户信号」模式：**停下来告诉用户去浏览器里登录**，登录完再继续。**不尝试任何自动登录、不碰凭据。**
- 若 CDP 路径整体失败 → 退回让用户粘贴正文或导出文件（本轮不自动走 hosted defuddle.md API，避免把内网可见内容外发第三方）。
- 中间产物（原始 markdown / HTML 快照）落 **scratchpad**，不进仓——仓里只留最终成稿。

## 第 2 步：生成仓内文档

**落位**：按 `docs/README.md` §2 后缀词表，**读完正文再定后缀**：
- 若是「外部资料/工具/方法的对比与地图」→ `docs/research/<主题>-地图.md`（对齐 `蒸馏方法论-开源参考地图.md`）
- 若是「跨维度方法论·何时戴哪顶帽子」→ `docs/principles/<主题>-心法.md`
- 若是「怎么一步步做」→ `docs/guides/<主题>-指南.md`

**落位后必须补 `docs/README.md` §4 索引**（CLAUDE.md 第 1 条硬要求，上一轮加 ADR 0014 时同样做过）。

**文档结构**（按仓内既有文档风格：给机制理由、标出处、不堆砌）：
1. 一句话定位 + 原始出处链接 + 抓取日期（外部资料必须可追溯）
2. 核心观点提炼（分条，每条标注**这是主张还是事实**）
3. **与本仓/本 skill 既有原则的对照**——哪些印证、哪些冲突、哪些补空白
4. **可采纳清单** 与 **不采纳清单（含理由）**——不采纳的理由要写下来，避免日后反复讨论
5. 存疑/待验证项

**来源定级（重要，且是自洽性检验）**：按 `prompt-refine` 上一轮刚写进去的可信度判据，WayToAGI 是**有署名的社区/教育项目 → B 级（可参考，需交叉验证）**，不是 A 级厂商官方。所以：
- B 级内容**采纳前要对照 A 级来源交叉验证**（`platform.claude.com` 的 prompt-engineering 页）；
- 交叉验证不过的，进"存疑"而非"可采纳"。

## 第 3 步：据此优化 prompt-refine

**采纳判据（先定标准，再看内容——防止被资料牵着走）**，只有同时满足才改：

1. **补的是真空白**：`prompt-refine` 现在确实没讲，而不是换个说法重复第三步那九条。
2. **不与既有原则冲突**。特别是这三条红线，冲突即**不采纳并记录**：
   - §「这个 skill 做什么」的铁律——只出稿、不执行；
   - §第三步第 3 条 + §关键原则——**不套空头衔角色**（"你是资深X" / `I want you to act as…`）；
   - §第二步——**默认不打断**，缺口写 `〔待补：…〕`。
3. **经得起 A 级交叉验证**（见第 2 步）。
4. **不让文件膨胀**：`prompt-refine` 自己的核心训诫就是「投入与任务匹配，别过度工程」——它自身也适用。**能并进现有条目就别新开章节**；新增内容需给机制理由，不只给结论。

**改完同样要同步项目级副本**（`cp -a` 覆盖 `/home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine/`）——ADR 0014 已记载同名并存会静默漂移。

**若读完发现没有任何内容通过上述判据**：如实说"这份资料没有值得改进 skill 的点"，只交文档、不动 skill。**不为了交差而硬改。**

## 收尾

本计划复制一份到 `.claude/plan/`（保留前两轮那两份，不覆盖）。

---

## 验证

1. **抓取成真**（防止拿到的是登录页而不自知）：
   ```bash
   wc -c <抓取产物>; grep -c "登录\|accounts.feishu.cn\|login" <抓取产物>
   ```
   正文应有实质长度，且**不含**登录页特征串。

2. **文档落位与索引**：
   ```bash
   cd /home/dev_st/mtools/DailyWorkbench
   ls docs/research docs/principles docs/guides | grep <新文档名>
   grep -n "<新文档名>" docs/README.md          # §4 索引必须补上
   ```

3. **skill 未被破坏**（若第 3 步确实改了）：
   ```bash
   /home/dev_st/iriswork/tools/anaconda/bin/python -c "
   t=open('/home/dev_st/.claude/skills/prompt-refine/SKILL.md',encoding='utf-8').read().split('---')[1].strip().splitlines()
   print('YAML 行数:',len(t),'✅' if len(t)==2 else '❌')"
   grep -n "^## " /home/dev_st/.claude/skills/prompt-refine/SKILL.md
   diff -r /home/dev_st/.claude/skills/prompt-refine \
           /home/dev_st/mtools/DailyWorkbench/.claude/skills/prompt-refine && echo "✅ 两级一致"
   ```

4. **门禁**（本轮只动 docs 与 .claude，理论上不受影响，仍跑一遍确认没误伤）：
   ```bash
   cd /home/dev_st/mtools/DailyWorkbench
   /home/dev_st/iriswork/tools/anaconda/bin/python check_design_tokens.py
   /home/dev_st/iriswork/tools/anaconda/bin/python bump_version.py --check
   ```

5. **行为验证**：同前两轮，`prompt-refine` 的触发行为需**新会话**才能验，本轮做不了；如实说明而不是声称已验。
