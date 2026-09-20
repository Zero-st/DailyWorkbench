// 使用量埋点（ADR 0015）：只记「人的手势」，用来回答『这工具到底有没有在被用』。
//
// 为什么不记页面加载/视图切换/轮询：那是「开着标签页」不是「在用」，记了就是
// 自评指南 §9 点名的 vanity metrics——而这份数据的全部价值就在于它敢说真话。
// 服务端还有一层白名单与字段裁剪，前端这里只管"发出去且绝不碍事"。
//
// 优雅劣化：后端不在（离线 / GitHub Pages 版）时 fetch 直接失败，静默丢弃。
// 不做离线队列——丢一条使用记录无所谓，队列是多一份要维护的状态。
var CID_KEY = "wb_cid";      // 本机匿名标识：让两个 Chrome profile 能分开又能合计
var _used = false;           // 本次页面会话是否已补发过 app_use

function cid() {
  try {
    var v = localStorage.getItem(CID_KEY);
    if (!v) {
      v = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
      localStorage.setItem(CID_KEY, v);
    }
    return v;
  } catch (e) {
    return "anon";           // 隐私模式/禁用存储：照样能记，只是不区分设备
  }
}

function send(ev, k) {
  try {
    var body = { ev: ev, cid: cid() };
    if (k) body.k = k;
    fetch("/api/usage", {
      method: "POST",
      keepalive: true,        // 点完就跳转/关页时也别把这条丢了
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(function () {});
  } catch (e) { /* 埋点绝不允许影响任何交互 */ }
}

/** 记一次手势。首个手势会顺带补一条 app_use（服务端按 (cid,day) 去重）。 */
export function track(ev, k) {
  if (!_used && ev !== "app_use") { _used = true; send("app_use"); }
  send(ev, k);
}
