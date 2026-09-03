// 页内脚本：选中即现的浮按钮 + shadow DOM 捕获面板。
//
// 【零站点解析】本文件刻意不含任何站点专属 DOM 选择器——只用 getSelection()、
// document.title、og:* meta。站点改版不会让它失效；平台识别交给工作台的
// detectPlatform(url)。这是本扩展长期低维护成本的关键（见 adr/0006）。
//
// 可能被重复注入（四站常驻 + 右键临时注入），故用全局哨兵防重复初始化。
(function () {
  if (window.__wbInboxLoaded) return;
  window.__wbInboxLoaded = true;

  var HOST_ID = "wb-inbox-host";
  var _host = null, _shadow = null, _btn = null, _lastSel = "";

  // ---------- 页面元信息（零站点解析） ----------
  function meta(prop) {
    var el = document.querySelector('meta[property="' + prop + '"], meta[name="' + prop + '"]');
    return el ? (el.getAttribute("content") || "").trim() : "";
  }
  function pageTitle() {
    return meta("og:title") || (document.title || "").trim();
  }
  function pageDesc() {
    return meta("og:description") || meta("description") || "";
  }

  // ---------- 浮按钮 ----------
  function ensureHost() {
    if (_host && document.documentElement.contains(_host)) return;
    _host = document.createElement("div");
    _host.id = HOST_ID;
    _host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0";
    _shadow = _host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS_TEXT;
    _shadow.appendChild(style);
    document.documentElement.appendChild(_host);
  }

  function showButton(x, y) {
    ensureHost();
    if (!_btn) {
      _btn = document.createElement("button");
      _btn.className = "wb-fab";
      _btn.textContent = "存到工作台";
      _btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
      _btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        openPanel(_lastSel, location.href);
      });
      _shadow.appendChild(_btn);
    }
    _btn.style.display = "block";
    // 贴在选区下方，夹住不超出视口
    var bx = Math.max(8, Math.min(x, window.innerWidth - 120));
    var by = Math.max(8, Math.min(y + 8, window.innerHeight - 44));
    _btn.style.left = bx + "px";
    _btn.style.top = by + "px";
  }
  function hideButton() { if (_btn) _btn.style.display = "none"; }

  document.addEventListener("selectionchange", function () {
    // 面板开着时不抢焦点
    if (_shadow && _shadow.querySelector(".wb-panel")) return;
    chrome.storage.sync.get({ fab: true }, function (cfg) {
      if (!cfg.fab) { hideButton(); return; }
      var sel = window.getSelection();
      var text = sel ? String(sel).trim() : "";
      if (!text || text.length < 2) { hideButton(); return; }
      _lastSel = text;
      try {
        var rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) { hideButton(); return; }
        showButton(rect.left, rect.bottom);
      } catch (e) { hideButton(); }
    });
  });

  // ---------- 捕获面板 ----------
  function openPanel(excerpt, url) {
    ensureHost();
    hideButton();
    var old = _shadow.querySelector(".wb-panel");
    if (old) old.remove();

    var wrap = document.createElement("div");
    wrap.className = "wb-panel";
    wrap.innerHTML =
      '<div class="wb-hd">存到工作台收件箱</div>' +
      '<div class="wb-meta" id="wbTitle"></div>' +
      '<label class="wb-lb">摘录（选中的精华，可改）</label>' +
      '<textarea class="wb-ta" id="wbEx" rows="4"></textarea>' +
      '<label class="wb-lb">感悟 · 为什么值得存</label>' +
      '<textarea class="wb-ta" id="wbNote" rows="3" placeholder="一句话就够，未来的你会感谢现在的你"></textarea>' +
      '<label class="wb-lb">标签（空格分隔，可选）</label>' +
      '<input class="wb-in" id="wbTags" placeholder="如 RAG Agent">' +
      '<div class="wb-ft"><span class="wb-msg" id="wbMsg"></span>' +
        '<button class="wb-btn ghost" id="wbCancel">取消</button>' +
        '<button class="wb-btn" id="wbSave">保存 ⏎</button></div>';
    _shadow.appendChild(wrap);

    var title = pageTitle();
    wrap.querySelector("#wbTitle").textContent = title || url;
    wrap.querySelector("#wbEx").value = excerpt || "";
    var noteEl = wrap.querySelector("#wbNote");

    function close() { wrap.remove(); }
    function save() {
      var msg = wrap.querySelector("#wbMsg");
      var payload = {
        type: "clip",
        url: url || location.href,
        title: title,
        excerpt: wrap.querySelector("#wbEx").value.trim(),
        note: noteEl.value.trim(),
        tags: wrap.querySelector("#wbTags").value.trim(),
        source: "ext"
      };
      if (!payload.excerpt && !payload.note) {
        msg.textContent = "写点摘录或感悟再存";
        msg.className = "wb-msg warn";
        return;
      }
      msg.textContent = "保存中…";
      msg.className = "wb-msg";
      wrap.querySelector("#wbSave").disabled = true;
      chrome.runtime.sendMessage({ kind: "save", payload: payload }, function (resp) {
        wrap.querySelector("#wbSave").disabled = false;
        if (resp && resp.ok) {
          msg.textContent = resp.result && resp.result.deduped ? "✓ 已存在（去重）" : "✓ 已存到工作台";
          msg.className = "wb-msg ok";
          setTimeout(close, 1200);
        } else {
          msg.textContent = "工作台后端未启动（127.0.0.1:8899）";
          msg.className = "wb-msg warn";
        }
      });
    }

    wrap.querySelector("#wbCancel").addEventListener("click", close);
    wrap.querySelector("#wbSave").addEventListener("click", save);
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      // Enter 保存；Shift+Enter 在 textarea 内换行
      if (e.key === "Enter" && !e.shiftKey) {
        if (e.target && e.target.tagName === "TEXTAREA" && e.target.id === "wbEx") return;
        e.preventDefault(); e.stopPropagation(); save();
      }
    });
    noteEl.focus();   // 感悟是最该趁热写的，直接聚焦
  }

  // 右键菜单 / background 触发
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.kind === "openPanel") {
      var sel = window.getSelection();
      openPanel(msg.excerpt || (sel ? String(sel).trim() : ""), msg.url || location.href);
      sendResponse({ ok: true });
    }
  });

  // ---------- 样式（shadow DOM 内，站点样式进不来） ----------
  var CSS_TEXT = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}",
    ".wb-fab{position:fixed;display:none;padding:6px 12px;font-size:12px;font-weight:600;color:#fff;",
    "background:linear-gradient(180deg,#58a6ff,#2f7fe0);border:none;border-radius:999px;cursor:pointer;",
    "box-shadow:0 4px 14px rgba(0,0,0,.28)}",
    ".wb-fab:hover{filter:brightness(1.06)}",
    ".wb-panel{position:fixed;right:20px;bottom:20px;width:380px;max-height:82vh;overflow:auto;",
    "background:#12161d;color:#e6edf3;border:1px solid #2a3140;border-radius:14px;padding:16px;",
    "box-shadow:0 18px 48px rgba(0,0,0,.5);font-size:13px}",
    ".wb-hd{font-size:15px;font-weight:700;margin-bottom:8px;color:#fff}",
    ".wb-meta{font-size:11px;color:#8b949e;margin-bottom:12px;word-break:break-all;line-height:1.5}",
    ".wb-lb{display:block;font-size:11px;font-weight:600;color:#8b949e;margin:10px 0 4px}",
    ".wb-ta,.wb-in{width:100%;background:#0d1117;color:#e6edf3;border:1px solid #2a3140;border-radius:8px;",
    "padding:8px 10px;font-size:13px;line-height:1.6;resize:vertical}",
    ".wb-ta:focus,.wb-in:focus{outline:none;border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,.15)}",
    ".wb-ft{display:flex;align-items:center;gap:8px;margin-top:14px}",
    ".wb-msg{flex:1;font-size:11px;color:#8b949e}",
    ".wb-msg.ok{color:#3fb950}.wb-msg.warn{color:#d29922}",
    ".wb-btn{padding:7px 14px;font-size:12px;font-weight:600;color:#fff;background:linear-gradient(180deg,#58a6ff,#2f7fe0);",
    "border:none;border-radius:8px;cursor:pointer}",
    ".wb-btn.ghost{background:#1c2230;color:#e6edf3;border:1px solid #2a3140}",
    ".wb-btn:disabled{opacity:.6;cursor:default}"
  ].join("");
})();
