// 全局桥接声明：state.js 把共享状态镜像到 window，供经典脚本
// （schedule.js / kb.js / model-manager.js）读取。仅声明本桥接契约用到的属性。
interface Window {
  /** 数据快照镜像，唯一写入方为 js/core/state.js 的 setData */
  __data: import("../core/net.js").WBData | null;
  /** 当前视图 id 镜像，唯一写入方为 js/core/state.js 的 setView */
  __view: string;
}
