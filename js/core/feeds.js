// 资讯源（Feed）表：前端这一侧的单一真源。术语定义见仓库根 CONTEXT.md。
//
// 后端对应表在 backend/pipeline/feeds.py（键名 / 空壳 / 日份合并），两处按 key 对齐。
// 此前 info.js 把这张表拆成七组近同构的 render/缓存/DateChanged/日期回落（约 400 行），
// infosearch.js 里还另有一张源名表；加一个新源要在前端改 6 处。
//
// 加一个新资讯源 = 这里加一行 + index.html 的 #col-info 里加一个 <div id="<id>Block">。
//
// 字段说明（都是"随源而变的事实"，渲染骨架在 js/views/info.js 的 renderFeed）：
//   key        data.json 里的键（与后端 FEEDS 的 key 一致）
//   id         DOM/localStorage 前缀：<id>Block / <id>Body / <id>Sel，折叠态也用它当键
//              —— 改它会让用户已保存的折叠状态失效，别动
//   kind       sections（按节分组，仅 AI 日报）| items
//   label      源标题条与正文大标题用的名字
//   unit       计数单位：条 / 个 / 篇
//   icon       内联 SVG 图标名（见 core/icons.js）
//   histLabel  历史下拉的前缀文案
//   fallbackSource / linkText   正文 meta 行的来源兜底名与外链文案
//   cardTitle / cardIcon        条目列表卡片的标题与图标（sections 源不用）
//   defaultSrc 条目没有自带 source 时显示的兜底来源；""=不显示（AI 日报如此）
//   searchLabel 检索面板里这个源的名字（infosearch.js 用）
//   ask        「让 AI 讲讲」的提问开头
//   summary    条目是否展示摘要（每日60秒刻意不展示）
//   numbered   条目是否编号（AI 日报按节分组，不编号）
//   empty      没数据时的提示 {text（含 HTML，是本仓字面量不转义）, cmd（可选：一键让 AI 抓）}
//   actions    顶部「提炼 / 存库」按钮组；null = 该源没有这组按钮
//              prompt 里的 {n} 会被当日条目数替换
export const FEEDS = [
  {
    key: "aiDaily", id: "news", kind: "sections",
    label: "AI 日报", unit: "条", icon: "fileText", histLabel: "历史日报",
    fallbackSource: "AI HOT", linkText: "看完整日报 ↗",
    defaultSrc: "", searchLabel: "AI 日报",
    ask: "用大白话展开讲讲这条 AI 新闻的背景和影响，并说说对我有什么用：",
    summary: true, numbered: false,
    empty: {
      text: "这一天还没有抓到日报数据。可以点「立即刷新」让本机重新抓一次；也可以让 WorkBuddy 手动跑 <code>fetch_ai_daily.py</code>。",
      cmd: "跑一下 personal-workbench 的 fetch_ai_daily.py 抓今天的 AI 日报，然后 export + push",
    },
    actions: {
      title: "基于日报做点什么", refine: "提炼 3 条要点", archive: "存进知识库",
      refinePrompt: "下面是今天的 AI 日报（{n} 条）。挑出对我最有用的 3 条要点，各配一个今天就能动手试的小实验。",
      archivePrompt: "把今天这份 AI 日报整理成一篇可归档的主题化摘要（Markdown，分主题、要点式）。整理好后我自己点「存知识库」入库。",
    },
  },
  {
    key: "dailyNews", id: "dnews", kind: "items",
    label: "每日新闻", unit: "条", icon: "fileText", histLabel: "历史新闻",
    fallbackSource: "每日60秒", linkText: "看来源 ↗",
    cardTitle: "今日头条", cardIcon: "trendingUp",
    defaultSrc: "每日60秒", searchLabel: "每日60秒",
    ask: "用大白话展开讲讲这条新闻的背景，并说说对我有什么影响：",
    summary: false, numbered: true, cover: true, tip: true,
    empty: {
      text: "这一天还没有抓到新闻数据。可以点「立即刷新」让本机重新抓一次；也可以让 WorkBuddy 手动跑 <code>fetch_daily_news.py</code>。",
      cmd: "跑一下 personal-workbench 的 fetch_daily_news.py 抓今天的国内新闻，然后 export + push",
    },
    actions: {
      title: "基于新闻做点什么", refine: "挑 3 条相关的", archive: "存进知识库",
      refinePrompt: "下面是今天的每日新闻（{n} 条）。挑 3 条跟我最相关的，说说为什么值得关注。",
      archivePrompt: "把今天这份每日新闻整理成一篇可归档的主题化摘要（Markdown）。整理好后我自己点「存知识库」入库。",
    },
  },
  {
    key: "hackerNews", id: "hnews", kind: "items",
    label: "Hacker News 热帖", unit: "条", icon: "trendingUp", histLabel: "历史热帖",
    fallbackSource: "Hacker News", linkText: "去 HN ↗",
    cardTitle: "今日热帖", cardIcon: "trendingUp",
    defaultSrc: "Hacker News", searchLabel: "Hacker News",
    ask: "用大白话讲讲这条 Hacker News 热帖在讨论什么、为什么值得关注：",
    summary: true, numbered: true, actions: null,
    empty: { text: "还没有抓到 Hacker News 数据。点「立即刷新」让本机经 OpenCLI 抓一次；若本机没装 OpenCLI（Node ≥20），该源会自动跳过，不影响其它资讯。" },
  },
  {
    key: "githubTrending", id: "gt", kind: "items",
    label: "GitHub Trending 今日热门", unit: "个", icon: "trendingUp", histLabel: "历史热门",
    fallbackSource: "GitHub Trending", linkText: "去 Trending ↗",
    cardTitle: "今日热门仓库", cardIcon: "trendingUp",
    defaultSrc: "GitHub Trending", searchLabel: "GitHub Trending",
    ask: "用大白话讲讲这个 GitHub 仓库是做什么的、解决了什么问题、什么时候该用它：",
    summary: true, numbered: true, actions: null,
    empty: { text: "还没有抓到 GitHub Trending 数据。点「立即刷新」让本机经 OpenCLI 抓一次；若本机没装 OpenCLI（Node ≥20），该源会自动跳过，不影响其它资讯。" },
  },
  {
    key: "productHunt", id: "ph", kind: "items",
    label: "Product Hunt 每日新品", unit: "个", icon: "trendingUp", histLabel: "历史新品",
    fallbackSource: "Product Hunt", linkText: "去 Product Hunt ↗",
    cardTitle: "今日上新（挑一个拆产品感）", cardIcon: "trendingUp",
    defaultSrc: "Product Hunt", searchLabel: "Product Hunt",
    ask: "用大白话讲讲这个新产品解决了谁的什么需求、亮点在哪、我能从它的设计里学到什么：",
    summary: true, numbered: true, actions: null,
    empty: { text: "还没有抓到 Product Hunt 数据。点「立即刷新」让本机抓一次（走公开 Atom feed，无需 Node/OpenCLI）。" },
  },
  {
    key: "sspai", id: "sspai", kind: "items",
    label: "少数派上新", unit: "篇", icon: "fileText", histLabel: "历史上新",
    fallbackSource: "少数派", linkText: "去少数派 ↗",
    cardTitle: "近期文章", cardIcon: "fileText",
    defaultSrc: "少数派", searchLabel: "少数派",
    ask: "用大白话讲讲这篇文章在说什么、对提升产品品味/效率有什么启发：",
    summary: true, numbered: true, actions: null,
    empty: { text: "还没有抓到少数派数据。点「立即刷新」让本机抓一次（走公开 RSS，无需 Node/OpenCLI）。" },
  },
  {
    key: "x", id: "x", kind: "items",
    label: "X/推特热议", unit: "条", icon: "messageCircle", histLabel: "历史热议",
    fallbackSource: "X (via grok-cli)", linkText: "去 X ↗",
    cardTitle: "近期热议（挑一条深挖）", cardIcon: "messageCircle",
    defaultSrc: "X", searchLabel: "X",
    ask: "用大白话讲讲这条 X 帖子在说什么、背景是什么、值不值得我关注：",
    summary: true, numbered: true, actions: null,
    empty: { text: "还没有抓到 X 数据。该源经 grok-cli（需 Bun + xAI 付费 key）抓取，未配置时自动跳过——在 <code>workbench.local.json</code> 填好 grokCmd / grokApiKey 后，点「立即刷新」即可。" },
  },
];

// 按 DOM 前缀取源（内联 onclick 只传得动字符串，回调里靠它还原 spec）
export function feedById(id) {
  return FEEDS.filter(function (s) { return s.id === id; })[0] || null;
}
