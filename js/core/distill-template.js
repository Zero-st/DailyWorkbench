// 蒸馏「知识工艺层」单一权威源：六维定义 + 每维硬约束 + 主题词 + tier 评级 + 指令生成。
// 方法论出处见 docs/research/蒸馏方法论-开源参考地图.md（抄 fabric extract_wisdom 的「每段规定量/字数」
// 工艺 + rate_content 的 S/A/B/C/D + Anthropic 四段结构化骨架）。此前六维散落硬编码在 distill.js:18，
// 本模块把它收成唯一源，distill.js 只消费不再自持字符串。零依赖、纯原生 ES module。

// 六维 + 每维硬约束（k=维度名，hint=对萃取端的量/字数/形态约束，直接进指令）。
// 改这里 = 改全站蒸馏标准；别再在别处复述六维。
export var DIMENSIONS = [
  { k: "核心观点", hint: "1 条，≤20 字，一句话说清主张" },
  { k: "方法步骤", hint: "3~7 条，每条动词开头、可照做" },
  { k: "适用场景", hint: "2~4 条，什么情况下用得上" },
  { k: "边界反例", hint: "≥1 条，何时失效/不适用；取材受限就如实写「未覆盖」" },
  { k: "可复用动作", hint: "1~5 条，下次我能直接执行的动作" },
  { k: "出处", hint: "作者 + 链接 + 关键引文或时间点" }
];

// 我关注的主题（评级「相关性」的判据源）。**按你的飞轮方向自行增删这一行。**
export var THEMES = ["RAG", "Agent", "LLM 应用", "提示词工程", "知识管理", "个人工作流", "产品判断"];

// 内容价值分档（抄 fabric rate_content：idea 密度 × 与 THEMES 契合）。
export var TIERS = ["S", "A", "B", "C", "D"];

// 评级 rubric（进指令，让萃取端在正文顶部给一行 tier + 理由；最终由人确认后落库）。
export var TIER_RUBRIC =
  "S=洞见密度高且强命中我的主题 / A=干货多且相关 / B=尚可 / C=零散或弱相关 / D=水分多或几乎不相关";

// 把六维渲染成带约束的清单行。
function _dimLines() {
  return DIMENSIONS.map(function (d) { return "- " + d.k + "（" + d.hint + "）"; }).join("\n");
}

// 指令骨架（Anthropic 四段：任务/我的主题/输出格式/材料）。
// 各分支只换「怎么拿材料」，六维与评级要求共用同一套 —— 保证产出可结构化成经验卡。
function _shell(taskLine, materialBlock) {
  return (
    "<任务>\n" + taskLine + " 直接输出 Markdown，只用无序列表，不要寒暄/说明/免责声明。\n\n" +
    "<我的主题>\n判定相关性时参照：" + THEMES.join("、") + "\n\n" +
    "<六维经验卡·每维按括号约束产出>\n" + _dimLines() + "\n\n" +
    "<评级>\n在正文最顶部先给一行 `tier: X`（X ∈ " + TIERS.join("/") + "）并附一句为什么。\n" +
    "分档标准：" + TIER_RUBRIC + "\n\n" +
    "<材料>\n" + materialBlock
  );
}

/**
 * 生成蒸馏交接指令（供 cmdtext 复制、人粘去 Claude Code 跑）。
 * @param {{plat:object, url?:string, extra?:{excerpt?:string, note?:string}}} args
 *   plat 为 platforms.platform() 返回的平台对象；extra.excerpt 存在则走「据此提炼」（绕反爬）。
 * @returns {string} 结构化指令；plat 缺失返回空串。
 */
export function buildDistillCmd(args) {
  args = args || {};
  var p = args.plat, url = args.url || "", extra = args.extra;
  if (!p) return "";

  // 分支①：有人工摘录 —— 小红书/微博反爬抓不到正文，选中那段就是精华，直接据此提炼，不抓页面。
  if (extra && extra.excerpt) {
    var mat = "以下是我从该 " + p.label + " " + p.kind + " 中选中的摘录与当时的感悟，据此提炼、无需再抓取页面。\n\n" +
              "【摘录】\n" + extra.excerpt;
    if (extra.note) mat += "\n\n【我的感悟】\n" + extra.note;
    if (url) mat += "\n\n【出处】\n" + url;
    return _shell("把下面的材料提炼成一张六维经验卡。", mat);
  }

  // 分支②：视频 —— 按 kind 判定，不再绑死具体 skill（creator-video-decoder 已从本机移除）。
  if (p.kind === "视频") {
    return _shell(
      "先用你可用的工具拿到该 " + p.label + " 视频的字幕/文字稿，再把内容提炼成一张六维经验卡。",
      (url || "")
    );
  }

  // 分支③：图文 —— baoyu-url-to-markdown 抓取转 md 再提炼（本机尚在）。
  return _shell(
    "先用 baoyu-url-to-markdown 抓取以下 " + p.label + " " + p.kind + " 转 markdown，再提炼成一张六维经验卡。",
    (url || "")
  );
}

// 页面「▶ 直接蒸馏」用：给**无头 agent**（只有 WebFetch + 只读知识库工具，见 backend/clients/agent.py）的提示。
// 复用同一套 _shell 六维/评级骨架（craft 单一真源、不漂移），只把「怎么拿材料」换成 WebFetch；
// 末尾要求「产出即最终答复本身」，便于前端把 result 文本直接填进起草区（人核对后点保存）。
export function buildDistillAgentPrompt(args) {
  args = args || {};
  var p = args.plat, url = args.url || "", extra = args.extra;
  var tail = "\n\n（直接把这张卡作为你的最终答复输出，不要额外解释；你没有写库工具，落库由用户在页面确认。）";
  // 有人工摘录：据此提炼，无需抓页面（同 buildDistillCmd 分支①）
  if (extra && extra.excerpt) {
    var mat = "以下是我选中的摘录与当时的感悟，据此提炼、无需再抓取页面。\n\n【摘录】\n" + extra.excerpt;
    if (extra.note) mat += "\n\n【我的感悟】\n" + extra.note;
    if (url) mat += "\n\n【出处】\n" + url;
    return _shell("把下面的材料提炼成一张六维经验卡。", mat) + tail;
  }
  var label = p ? (p.label + " " + p.kind) : "网页";
  return _shell(
    "先用 WebFetch 工具抓取以下" + label + "的正文（抓不到就如实说明并就已知信息提炼），再提炼成一张六维经验卡。",
    (url || "")
  ) + tail;
}
