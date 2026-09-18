---
name: find-skills
description: 当用户问"怎么做 X"、"有没有能做 X 的技能"、"能不能做 X"，或想扩展 agent 能力时，帮用户在开放 Agent Skills 生态里发现并安装技能。
---

# find-skills · 技能发现与安装

帮你在开放的 agent skills 生态里发现、评估、安装技能。

## 何时用

以下场景下使用本技能：

- 用户问"怎么做 X"，而 X 可能已经有现成技能。
- 用户说"找个能做 X 的技能"或"有没有做 X 的技能"。
- 用户问"你能不能做 X"，X 是某种专门能力。
- 用户想扩展 agent 能力，或想找工具/模板/工作流。
- 用户提到希望在某个领域（设计、测试、部署等）得到帮助。

## Skills CLI 是什么

`npx skills` 是开放 agent skills 生态的包管理器。技能是可安装的模块化包，为 agent 扩展专门知识、工作流和工具。

**关键命令：**

- `npx skills find [query] [--owner <owner>]` — 交互式或按关键词搜索技能，可用 `--owner` 限定到某个 GitHub 账号
- `npx skills add <package>` — 从 GitHub 或其他来源安装技能
- `npx skills update` — 更新所有已装技能

**浏览技能：** https://skills.sh/

## 怎么帮用户找技能

### 第一步：搞清楚用户要什么

用户提出需求时，先确认：

1. 领域（比如 React、测试、设计、部署）
2. 具体任务（比如写测试、做动画、审 PR）
3. 这是否是个足够常见、大概率已经有现成技能的任务

### 第二步：先查排行榜

跑 CLI 搜索之前，先看 [skills.sh 排行榜](https://skills.sh/)，看该领域是不是已经有知名技能。排行榜按总装机量排序，能优先浮出最流行、最经过验证的选项。

比如 Web 开发领域排名靠前的：

- `vercel-labs/agent-skills` — React、Next.js、Web 设计（各 10 万+ 装机）
- `anthropics/skills` — 前端设计、文档处理（10 万+ 装机）

### 第三步：搜索技能

如果排行榜没覆盖到用户的需求，跑搜索命令：

```bash
npx skills find [query] [--owner <owner>]
```

例如：

- 用户问"怎么让我的 React app 更快" → `npx skills find react performance`
- 用户问"能帮我审 PR 吗" → `npx skills find pr review`
- 用户问"我要生成 changelog" → `npx skills find changelog`

### 第四步：推荐前先核实质量

**不要仅凭搜索结果就推荐一个技能。** 一定要核实：

1. **装机量** — 优先选 1000+ 装机的；低于 100 的要谨慎。
2. **来源信誉** — 官方来源（`vercel-labs`、`anthropics`、`microsoft`）比不知名作者更可信。
3. **GitHub star 数** — 查一下源仓库，star 数低于 100 的仓库要多留个心眼。

### 第五步：把选项呈现给用户

找到相关技能后，给用户展示：

1. 技能名称和它是做什么的
2. 装机量和来源
3. 可以直接跑的安装命令
4. 去 skills.sh 了解更多的链接

示例回复：

```
我找到一个可能有帮助的技能！"react-best-practices" 提供了 Vercel 工程团队出的
React 和 Next.js 性能优化指南。（18.5 万装机）

安装方式：
npx skills add vercel-labs/agent-skills@react-best-practices

了解更多：https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### 第六步：提出代装

如果用户想装，可以帮他执行：

```bash
npx skills add <owner/repo@skill> -g -y
```

`-g` 表示装到用户级（全局），`-y` 表示跳过确认提示。

## 常见技能分类

| 分类 | 示例查询词 |
| --- | --- |
| Web 开发 | react、nextjs、typescript、css、tailwind |
| 测试 | testing、jest、playwright、e2e |
| DevOps | deploy、docker、kubernetes、ci-cd |
| 文档 | docs、readme、changelog、api-docs |
| 代码质量 | review、lint、refactor、best-practices |
| 设计 | ui、ux、design-system、accessibility |
| 效率 | workflow、automation、git |

## 高效搜索的技巧

1. **用具体的关键词**：搜"react testing"比只搜"testing"更好
2. **换个说法再试**："deploy"搜不到就试试"deployment"或"ci-cd"
3. **留意热门来源**：很多技能来自 `vercel-labs/agent-skills` 或 `ComposioHQ/awesome-claude-skills`

## 没找到技能时

如果没有相关技能：

1. 老实告诉用户没找到现成技能
2. 提出直接用你的通用能力帮他做这件事
3. 如果这是个经常要做的事，建议用户用 `npx skills init` 自己写一个技能

示例：

```
我搜了"xyz"相关的技能，没找到匹配的。
这件事我还是可以直接帮你做！要现在开始吗？

如果这个任务你经常要做，也可以自己建一个技能：
npx skills init my-xyz-skill
```
