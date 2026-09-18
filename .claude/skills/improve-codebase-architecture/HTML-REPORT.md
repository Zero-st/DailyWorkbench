# HTML 报告格式

架构评审渲染成**一个自包含的 HTML 文件**，落在 `/home/dev_st/桌面/comtools/tmp/dailyworkbench/`（见 SKILL.md 第 2 步）。Tailwind 和 Mermaid 都走 CDN。Mermaid 负责图状结构、渲染可靠；手搭的 div 和内联 SVG 负责更有编辑感的视觉（体量图、剖面图）。两者混用：别什么都靠 Mermaid，那样会越来越像模板。

## 骨架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>{{repo name}} 架构评审</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* 一小层自定义样式，补 Tailwind 不好处理的东西：
         虚线接缝、手绘感箭头等 */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 页头

仓库名、日期，加一个紧凑图例：实线框 = 模块，虚线 = 接缝，红箭头 = 泄漏，粗深色框 = 深模块。没有导语段落，直接进候选。

## 候选卡片

图承担重量。文字要少、要直白，用 `codebase-design` 的术语但不端着。

每个候选是一个 `<article>`：

- **标题**：短，点名这次深化（例如"折叠日报入库流水线"）。
- **徽章行**：推荐强度（`Strong` = emerald，`Worth exploring` = amber，`Speculative` = slate），外加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **文件**：等宽字体列表，`font-mono text-sm`。
- **前 / 后对比图**：核心。两列并排。模式见下文。
- **问题**：一句话。哪里疼。
- **方案**：一句话。改什么。
- **收益**：短句列表，每条 ≤ 8 个字，如"测试只打一个接口"、"定价逻辑不再泄漏"、"删掉 4 个浅包装"。
- **ADR 提示**（如适用）：一行，放在琥珀色底的框里。

不要成段解释。如果一张图需要一段话才能看懂，重画那张图。

## 图形模式

按候选选合适的模式。混着用。别让每张图长得一样，多样性本身就是重点。

### Mermaid 图（依赖 / 调用流的主力）

当重点是"X 调 Y 调 Z，看看这一团乱"，用 Mermaid 的 `flowchart` 或 `graph`。包在一个 Tailwind 卡片里，别让它看起来像空降的。用 classDef 把泄漏边染红、把深模块染深色。时序图适合表达"前：6 次往返；后：1 次"。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手搭的框与箭头（Mermaid 排版跟你打架时用）

模块画成带边框和标签的 `<div>`；箭头用内联 SVG 的 `<line>` 或 `<path>`，绝对定位叠在一个相对定位的容器上。当你想让"后"图呈现为一个粗边框的深模块、内部灰化，就用这种——Mermaid 画不出那种分量感。

### 剖面图（适合分层式的浅）

堆叠水平条带（`h-12 border-l-4`）表示一次调用穿过的层。前：6 层薄薄的、每层啥也不干。后：1 条粗带，标着合并后的职责。

### 体量图（适合"接口和实现一样宽"）

每个模块画两个矩形：一个表示接口表面积，一个表示实现。前：接口矩形几乎和实现矩形一样高（浅）。后：接口矩形很矮、实现矩形很高（深）。

### 调用图折叠

前：一棵函数调用树，画成嵌套的框。后：同一棵树折叠成一个框，原先的内部调用淡化显示在里面。

## 样式指引

- 偏编辑风，不要企业仪表盘风。留白要足。标题可选衬线（`font-serif` 配 stone/slate 效果不错）。
- 用色克制：一个主色（emerald 或 indigo）+ 红色表泄漏 + 琥珀色表警告。
- 图高控制在 ~320px，让前/后并排不用滚动。
- 图里的模块标签用 `text-xs uppercase tracking-wider`，读起来像示意图而不像 UI。
- 页面里唯一的脚本就是 Tailwind CDN 和 Mermaid ESM 导入。其他部分全是静态的：没有应用代码，除了 Mermaid 自己的渲染外没有交互。

## 首选推荐区

一张更大的卡片。候选名、一句为什么、一个跳到它卡片的锚链接。就这些。

## 语气

直白、简洁，但架构名词和动词直接来自 `codebase-design` 技能。简洁不是用词漂移的借口。

**严格用**：模块、接口、实现、深度、深、浅、接缝、适配器、杠杆、局部性。

**绝不替换成**：组件、服务、单元（替模块）· API、签名（替接口）· 边界（替接缝）· 层、包装（当你其实指的是模块时）。

**符合风格的说法**：

- "日报入库模块很浅：接口几乎和实现一样复杂。"
- "定价逻辑泄漏过了接缝。"
- "深化：一个接口，一处测试。"
- "两个适配器撑起这道接缝：生产走 HTTP，测试走内存。"

**收益条目**要用术语表里的词说清得到了什么：*"局部性：bug 收敛到一个模块"*、*"杠杆：一个接口，N 个调用点"*、*"接口收窄；实现吸收掉那些包装"*。不要写*"更易维护"*、*"代码更干净"*——这些词不在术语表里，也配不上一个位置。

不要含糊其辞，不要清嗓子，不要"值得注意的是……"。一句话能写成一条要点就写成要点；一条要点能删就删。如果一个词不在 `codebase-design` 的术语表里，先在表里找一个能用的，再考虑发明新词。
