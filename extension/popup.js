// 工具栏弹窗：快速存 + 连接状态 + 设置（端口 / 浮按钮开关）。
// 所有后端访问都经 background（唯一出口），弹窗自己不 fetch。
var $ = function (id) { return document.getElementById(id); };

// ---- 连接状态 ----
function refreshConn() {
  chrome.runtime.sendMessage({ kind: "ping" }, function (resp) {
    var el = $("conn");
    if (resp && resp.ok) {
      el.className = "conn ok";
      el.textContent = "已连上工作台 · " + ((resp.result && resp.result.count) || 0) + " 条";
    } else {
      el.className = "conn warn";
      el.textContent = "后端未启动（python -m backend.server 8899）";
    }
  });
}

// ---- 设置 ----
function loadSettings() {
  chrome.storage.sync.get({ port: 8899, fab: true }, function (cfg) {
    $("port").value = cfg.port;
    $("fab").checked = cfg.fab;
  });
}
$("port").addEventListener("change", function () {
  var v = parseInt($("port").value, 10);
  if (!v || v < 1 || v > 65535) return;
  chrome.storage.sync.set({ port: v }, refreshConn);
});
$("fab").addEventListener("change", function () {
  chrome.storage.sync.set({ fab: $("fab").checked });
});
$("open").addEventListener("click", function () {
  chrome.runtime.sendMessage({ kind: "openWorkbench" });
});

// ---- 当前页信息 + 选区（从活动标签取，零站点解析） ----
var _page = { url: "", title: "" };
function loadPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var t = tabs && tabs[0];
    if (!t) return;
    _page.url = t.url || "";
    _page.title = t.title || "";
    $("pageInfo").textContent = _page.title || _page.url;
    // 取当前选区（特权页会失败，忽略即可）
    if (!t.id) return;
    chrome.scripting.executeScript(
      { target: { tabId: t.id }, func: function () { return String(window.getSelection() || "").trim(); } },
      function (res) {
        if (chrome.runtime.lastError) return;
        var sel = res && res[0] && res[0].result;
        if (sel) $("ex").value = sel;
      }
    );
  });
}

// ---- 保存 ----
$("save").addEventListener("click", function () {
  var payload = {
    url: _page.url,
    title: _page.title,
    excerpt: $("ex").value.trim(),
    note: $("note").value.trim(),
    tags: $("tags").value.trim(),
    type: _page.url ? "clip" : "idea",
    source: "ext"
  };
  if (!payload.url && !payload.excerpt && !payload.note) {
    $("msg").textContent = "写点摘录或感悟再存";
    $("msg").className = "msg warn";
    return;
  }
  $("msg").textContent = "保存中…";
  $("msg").className = "msg";
  $("save").disabled = true;
  chrome.runtime.sendMessage({ kind: "save", payload: payload }, function (resp) {
    $("save").disabled = false;
    if (resp && resp.ok) {
      $("msg").textContent = resp.result && resp.result.deduped ? "✓ 已存在（去重）" : "✓ 已存到工作台";
      $("msg").className = "msg ok";
      refreshConn();
      setTimeout(function () { window.close(); }, 900);
    } else {
      $("msg").textContent = "保存失败：后端未启动？";
      $("msg").className = "msg warn";
    }
  });
});

loadSettings();
loadPage();
refreshConn();
