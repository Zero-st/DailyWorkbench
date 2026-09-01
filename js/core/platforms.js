// 平台枚举（收件箱 inbox 与蒸馏库 distill 共享，避免两处漂移）。
// v: 存 frontmatter 的平台值；label: 展示名；ic: 内联 SVG 图标名（见 icons.js）；
// skill: 蒸馏时交接哪把萃取器；kind: 内容形态；hosts: 用于从链接自动识别平台的域名片段。
import { icon } from "./icons.js";

export var PLATFORMS = [
  { v: "bilibili", label: "B站", ic: "tv", skill: "creator-video-decoder", kind: "视频", hosts: ["bilibili.com", "b23.tv"] },
  { v: "xhs", label: "小红书", ic: "book", skill: "baoyu-url-to-markdown", kind: "图文", hosts: ["xiaohongshu.com", "xhslink.com"] },
  { v: "weibo", label: "微博", ic: "book", skill: "baoyu-url-to-markdown", kind: "图文", hosts: ["weibo.com", "weibo.cn"] },
  { v: "jike", label: "即刻", ic: "file", skill: "baoyu-url-to-markdown", kind: "图文", hosts: ["okjike.com"] },
  { v: "article", label: "图文/文章", ic: "file", skill: "baoyu-url-to-markdown", kind: "图文", hosts: [] }
];

export function platform(v) {
  for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].v === v) return PLATFORMS[i];
  return null;
}

// 平台徽标（图标 + 名称）；未标注时给个占位
export function platformBadge(v) {
  var p = platform(v);
  return p ? icon(p.ic) + " " + p.label : "· 未标注";
}

// 从链接自动识别平台：无链接返回 ""（＝纯想法）；有链接但不匹配已知平台返回 "article"
export function detectPlatform(url) {
  url = (url || "").trim();
  if (!url) return "";
  var host = "";
  try { host = new URL(url).hostname.toLowerCase(); }
  catch (e) {
    // 容错：用户可能没带协议头（如 xiaohongshu.com/xxx）
    var m = url.toLowerCase().match(/^(?:https?:\/\/)?([^/]+)/);
    host = m ? m[1] : "";
  }
  if (!host) return "article";
  for (var i = 0; i < PLATFORMS.length; i++) {
    var hs = PLATFORMS[i].hosts;
    for (var j = 0; j < hs.length; j++) {
      if (host === hs[j] || host.indexOf("." + hs[j]) >= 0 || host.indexOf(hs[j]) === 0) return PLATFORMS[i].v;
    }
  }
  return "article";
}
