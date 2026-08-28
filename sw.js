// 个人工作台 Service Worker - 离线可开、可安装到主屏幕
const CACHE = "workbench-e8368598";
const FILES = [
  "./index.html",
  "./styles.css?v=4f5e2288",
  "./schedule.js?v=64c25777",
  "./model-manager.js?v=af4fbd61",
  "./vendor/marked.min.js?v=b7319d77",
  "./kb.js?v=3ff6bd36",
  "./app.js?v=608f79e2",
  "./js/core/util.js",
  "./js/core/state.js",
  "./js/core/net.js",
  "./js/views/stats.js",
  "./js/views/ov.js",
  "./js/views/sess.js",
  "./js/views/week.js",
  "./js/views/info.js",
  "./js/views/cap.js",
  "./js/views/ai.js",
  "./js/views/dash.js",
  "./js/features/favs.js",
  "./js/features/notes.js",
  "./js/features/todos.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});
// 激进清缓存：activate 时清掉所有 CACHE 再重建（不只是非当前名），保证用户刷新后 0 旧缓存可用
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE).then((c) => c.addAll(FILES)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // /api/* 网络唯一：不缓存（避免 /api/kb/note?path=X 等变体污染缓存），离线返回 503
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  // data.json：网络优先，离线时回退最近一次成功缓存（断网也能看上次数据）
  if (url.pathname.endsWith("data.json")) {
    e.respondWith(
      fetch(e.request)
        .then(function (resp) {
          if (resp && resp.ok) {
            var copy = resp.clone();
            caches.open(CACHE).then(function (c) { c.put("data.json", copy); });
          }
          return resp;
        })
        .catch(function () { return caches.match("data.json"); })
    );
    return;
  }
  // 其余资源：网络优先（保证每次拿到最新），离线 fallback 缓存
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() =>
        caches.match(e.request).then((cached) =>
          cached || (e.request.mode === "navigate" ? caches.match("./index.html") : null)
        )
      )
  );
});
