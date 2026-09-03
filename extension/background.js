// Service worker：右键菜单 + 统一的后端 fetch 出口 + 非四站页面的临时注入。
// 为什么 fetch 走这里：background 不受页面 CSP / CORS 约束，content script 直接 fetch
// 本地端口会被站点 CSP 拦掉。设计见 docs/design/捕获收件箱-浏览器扩展-设计.md。

const DEFAULT_PORT = 8899;

async function backendBase() {
  const { port } = await chrome.storage.sync.get({ port: DEFAULT_PORT });
  return `http://127.0.0.1:${port}`;
}

// ---- 后端调用（唯一出口） ----
async function apiAdd(payload) {
  const base = await backendBase();
  const r = await fetch(`${base}/api/inbox/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function apiPing() {
  const base = await backendBase();
  const r = await fetch(`${base}/api/inbox/ping`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---- 右键菜单：全站可用 ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wb-capture",
    title: "存到工作台收件箱",
    contexts: ["selection", "page", "link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "wb-capture" || !tab || !tab.id) return;
  // 四站已有常驻 content script；其余页面临时注入，实现"任意文章页也能存"
  try {
    await chrome.tabs.sendMessage(tab.id, {
      kind: "openPanel",
      excerpt: info.selectionText || "",
      url: info.linkUrl || info.pageUrl || (tab && tab.url) || ""
    });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, {
        kind: "openPanel",
        excerpt: info.selectionText || "",
        url: info.linkUrl || info.pageUrl || (tab && tab.url) || ""
      });
    } catch (e2) {
      // 特权页（chrome:// / 应用商店）无法注入，只能忽略
      console.warn("[wb] 无法在此页面注入面板：", e2 && e2.message);
    }
  }
});

// ---- 消息路由：content script / popup 都经此访问后端 ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.kind) return;
  if (msg.kind === "save") {
    apiAdd(msg.payload)
      .then((r) => sendResponse({ ok: true, result: r }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;   // 异步响应
  }
  if (msg.kind === "ping") {
    apiPing()
      .then((r) => sendResponse({ ok: true, result: r }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  if (msg.kind === "openWorkbench") {
    backendBase().then((base) => {
      chrome.tabs.create({ url: `${base}/index.html` });
      sendResponse({ ok: true });
    });
    return true;
  }
});
