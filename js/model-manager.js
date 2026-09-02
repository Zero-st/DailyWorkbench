// model-manager.js — AI 模型管理模块（OpenAI 兼容协议）
// 职责：维护本机 AI 模型配置列表、渲染「模型管理」视图、为 AI 助手提供当前模型配置。
(function () {
  "use strict";

  var WB = window.WB = window.WB || {};
  var esc = WB.esc || function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var escAttr = function (s) { return esc(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;"); };

  var STORAGE_KEY = "wb_models_v2";
  var ACTIVE_KEY = "wb_active_model_id";

  // ---------- 预设平台（OpenAI 兼容协议） ----------
  var PRESETS = {
    openai: {
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      docs: "https://platform.openai.com/docs",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini", "chatgpt-4o-latest"]
    },
    azure: {
      label: "Azure OpenAI",
      baseUrl: "https://{your-resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-06-01",
      docs: "https://learn.microsoft.com/azure/ai-services/openai/",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo-2024-04-09", "gpt-35-turbo"]
    },
    anthropic: {
      label: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com/v1/messages",
      docs: "https://docs.anthropic.com/",
      models: ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"]
    },
    gemini: {
      label: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      docs: "https://ai.google.dev/gemini-api/docs",
      models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro"]
    },
    deepseek: {
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      docs: "https://platform.deepseek.com/docs",
      models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"]
    },
    aliyun: {
      label: "阿里云百炼",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      docs: "https://help.aliyun.com/zh/dashscope/",
      models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-coder-plus", "qwen2.5-72b-instruct"]
    },
    tencent: {
      label: "腾讯云 Token Plan",
      baseUrl: "https://api.lkeap.cloud.tencent.com/v1/chat/completions",
      docs: "https://cloud.tencent.com/document/product/1772",
      models: ["MiniMax-M2.5", "MiniMax-M2.7", "GLM-5", "GLM-5.1", "Kimi-K2.5", "DeepSeek-V4-Flash", "DeepSeek-V4-Pro"]
    },
    "volcengine-coding": {
      label: "火山方舟 Coding Plan",
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
      docs: "https://www.volcengine.com/docs/82379/",
      models: ["glm-5.3", "doubao-seed-2.1-turbo", "doubao-seed-2.0-lite", "minimax-m2.7", "minimax-m3", "deepseek-v4-flash", "deepseek-v4-pro", "kimi-k2.6", "kimi-k2.7-code", "doubao-seed-evolving", "ark-code-latest"],
      modelHint: "Coding Plan 直接填模型名称（如 glm-5.3）",
      hint: "Coding Plan 套餐请选此项，API 地址以 /api/coding/v3 结尾"
    },
    volcengine: {
      label: "火山方舟（按量/普通）",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      docs: "https://www.volcengine.com/docs/82379/",
      models: ["doubao-seed-2.1-turbo", "doubao-seed-2.0-lite", "glm-4-flash", "deepseek-v3"],
      modelHint: "普通方舟请填推理接入点 Endpoint ID（如 ep-2025xxx）或 Model ID",
      hint: "普通按量计费/非 Coding Plan 套餐请选此项"
    },
    minimax: {
      label: "MiniMax",
      baseUrl: "https://api.minimax.chat/v1/chat/completions",
      docs: "https://www.minimaxi.com/",
      models: ["MiniMax-M2.5", "MiniMax-M2.7", "MiniMax-Text-01", "abab6.5s-chat"]
    },
    zhipu: {
      label: "智谱 GLM",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      docs: "https://open.bigmodel.cn/",
      models: ["glm-4-flash", "glm-4", "glm-4-air", "glm-4-airx", "glm-4v-plus", "glm-4v"]
    },
    kimi: {
      label: "月之暗面 Kimi",
      baseUrl: "https://api.moonshot.cn/v1/chat/completions",
      docs: "https://platform.moonshot.cn/docs",
      models: ["kimi-k2.5", "kimi-k2", "kimi-latest", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"]
    },
    openrouter: {
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      docs: "https://openrouter.ai/docs",
      models: ["openai/gpt-4o", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-1.5-pro", "deepseek/deepseek-chat"]
    },
    agnes: {
      label: "Agnes",
      baseUrl: "https://apihub.agnes-ai.cn/v1/chat/completions",
      docs: "https://apihub.agnes-ai.cn/",
      models: ["agnes-2.5-flash", "agnes-2.5-pro", "agnes-2.0"]
    },
    custom: {
      label: "自定义 OpenAI 兼容",
      baseUrl: "",
      docs: "",
      models: []
    }
  };

  function presetKeys() { return Object.keys(PRESETS); }
  function presetLabel(k) { return PRESETS[k] ? PRESETS[k].label : k; }

  // ---------- 数据持久化（localStorage 为缓存，Supabase 为云端真源） ----------
  // MEM 为内存真源：服务端配置优先；服务端未配置/不可达时退回 localStorage。
  var MEM = { models: null, activeId: null, loaded: false, serverOk: false };

  function lsModels() {
    try { var s = localStorage.getItem(STORAGE_KEY); var a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function lsActive() { try { return localStorage.getItem(ACTIVE_KEY) || ""; } catch (e) { return ""; } }

  function modelsLoad() { return (MEM.loaded && MEM.models) ? MEM.models : lsModels(); }
  function activeId() { return (MEM.loaded && MEM.activeId) ? MEM.activeId : lsActive(); }

  function _persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MEM.models || []));
      localStorage.setItem(ACTIVE_KEY, MEM.activeId || "");
    } catch (e) {}
  }
  function _syncServer() {
    if (!MEM.serverOk) return;
    fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ models: MEM.models || [], activeId: MEM.activeId || "" })
    }).catch(function () {});
  }
  function modelsSave(arr) {
    MEM.models = Array.isArray(arr) ? arr.slice() : [];
    if (!MEM.activeId && MEM.models[0]) MEM.activeId = MEM.models[0].id;
    _persistLocal();
    _syncServer();
  }
  function setActiveId(id) {
    MEM.activeId = id || "";
    _persistLocal();
    _syncServer();
  }

  // 启动时拉取云端配置；未配置/失败则退回 localStorage（不阻断使用）
  function initModelStore() {
    fetch("/api/models")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.configured) { MEM.loaded = true; return; }
        MEM.serverOk = true;
        if (j.data && Array.isArray(j.data.models)) {
          MEM.models = j.data.models;
          MEM.activeId = j.data.activeId || (j.data.models[0] ? j.data.models[0].id : "");
        } else {
          MEM.models = lsModels();
          MEM.activeId = lsActive();
          _syncServer();
        }
        MEM.loaded = true;
        _persistLocal();
        if (document.getElementById("col-models") && typeof renderModels === "function") renderModels();
        if (window.__data && typeof renderAI === "function") renderAI(window.__data);
      })
      .catch(function () { MEM.loaded = true; });
  }
  initModelStore();
  function genId() { return "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7); }

  // 首次使用：把旧版 Agnes / GLM 配置迁移到新列表（保留兼容性）
  function migrateLegacy() {
    var list = modelsLoad();
    if (list.length) return;
    try {
      var agnesKey = localStorage.getItem("wb_ai_key_agnes") || "";
      var glmKey = localStorage.getItem("wb_ai_key_glm") || "";
      var legacyProv = localStorage.getItem("wb_ai_prov") === "glm" ? "glm" : "agnes";
      var newList = [];
      if (agnesKey) newList.push({ id: genId(), presetId: "agnes", label: "Agnes 2.5 Flash", baseUrl: PRESETS.agnes.baseUrl, apiKey: agnesKey, model: "agnes-2.5-flash", createdAt: Date.now() });
      if (glmKey) newList.push({ id: genId(), presetId: "zhipu", label: "智谱 GLM Flash", baseUrl: PRESETS.zhipu.baseUrl, apiKey: glmKey, model: "glm-4-flash", createdAt: Date.now() });
      if (newList.length) {
        modelsSave(newList);
        setActiveId(newList[legacyProv === "glm" && glmKey ? 1 : 0].id);
      }
    } catch (e) {}
  }
  migrateLegacy();

  // ---------- 当前活跃模型配置（供 AI 助手调用） ----------
  function getActiveConfig() {
    var list = modelsLoad();
    var aid = activeId();
    var active = list.find(function (m) { return m.id === aid; });
    if (active) {
      return {
        label: active.label,
        url: active.baseUrl,
        model: active.model,
        key: active.apiKey,
        maxTokens: 4000
      };
    }
    return null;
  }

  // ---------- 工具 ----------
  function maskKey(k) {
    if (!k) return "未设置";
    if (k.length <= 8) return "••••";
    return k.slice(0, 4) + "••••••••" + k.slice(-4);
  }
  // 供应商徽标：统一内联 SVG（缺 emoji 字体的系统不再豆腐；供应商名由相邻文字承载）
  function providerEmoji(k) {
    return (WB.ic || window.ic || function () { return ""; })("cpu");
  }

  // ---------- 视图渲染 ----------
  function renderModels() {
    var box = document.getElementById("col-models");
    if (!box) return;
    var list = modelsLoad();
    var aid = activeId();
    var active = list.find(function (m) { return m.id === aid; });

    var activeHtml = active
      ? '<div class="model-active-bar">' +
          '<span class="ma-label">当前 AI 助手正在使用</span>' +
          '<span class="ma-pill">' + providerEmoji(active.presetId) + " " + esc(active.label) + " · " + esc(active.model) + "</span>" +
        '</div>'
      : '<div class="model-active-bar warn">' +
          '<span class="ma-label">尚未设置 AI 模型</span>' +
          '<span class="ma-pill">AI 助手将无法发送请求</span>' +
        '</div>';

    var cards = list.map(function (m) {
      var isActive = m.id === aid;
      return '<article class="model-card' + (isActive ? " active" : "") + '" data-id="' + escAttr(m.id) + '">' +
        '<div class="mc-head">' +
          '<span class="mc-emoji">' + providerEmoji(m.presetId) + '</span>' +
          '<div class="mc-title-wrap">' +
            '<div class="mc-title">' + esc(m.label) + (isActive ? '<span class="mc-active-badge">使用中</span>' : '') + '</div>' +
            '<div class="mc-sub">' + esc(presetLabel(m.presetId)) + " · " + esc(m.model) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mc-row"><span class="mc-key-label">API Key</span><span class="mc-key-val">' + esc(maskKey(m.apiKey)) + '</span></div>' +
        '<div class="mc-row"><span class="mc-key-label">接口</span><span class="mc-url" title="' + escAttr(m.baseUrl) + '">' + esc(m.baseUrl) + '</span></div>' +
        '<div class="mc-actions">' +
          (isActive ? '<span class="mc-status">✓ 当前激活</span>' : '<button class="btn-sm" onclick="modelSetActive(\'' + (window.jsStr ? window.jsStr(m.id) : m.id) + '\')">设为当前</button>') +
          '<button class="btn-sm ghost" onclick="modelEdit(\'' + (window.jsStr ? window.jsStr(m.id) : m.id) + '\')">编辑</button>' +
          '<button class="btn-sm danger" onclick="modelDelete(\'' + (window.jsStr ? window.jsStr(m.id) : m.id) + '\')">删除</button>' +
        '</div>' +
      '</article>';
    }).join("");

    var empty = list.length ? "" : '<div class="empty">还没有配置模型。点右上角「添加模型」开始。</div>';

    box.innerHTML = '<div class="card model-view">' +
      '<div class="model-view-h">' +
        '<h2><span class="ic">' + WB.ic("cpu") + '</span>模型管理</h2>' +
        '<button class="btn" onclick="openModelModal()">' + WB.ic("plus") + ' 添加模型</button>' +
      '</div>' +
      activeHtml +
      '<div class="model-grid">' + cards + '</div>' + empty +
    '</div>';
  }

  // ---------- 添加/编辑弹窗 ----------
  var editingId = null;
  function openModelModal(id) {
    var list = modelsLoad();
    editingId = id || null;
    var m = id ? list.find(function (x) { return x.id === id; }) : null;
    var presetId = m ? m.presetId : (activeId() ? list.find(function (x) { return x.id === activeId(); }).presetId : "tencent");
    var preset = PRESETS[presetId] || PRESETS.custom;
    var isCustom = presetId === "custom";

    var title = id ? "编辑模型" : "添加模型";

    // 提供商下拉
    var provSel = '<option value="">选择提供商…</option>' +
      presetKeys().map(function (k) {
        return '<option value="' + k + '"' + (k === presetId ? " selected" : "") + '>' + providerEmoji(k) + " " + esc(PRESETS[k].label) + '</option>';
      }).join("");

    // 模型下拉：预设 + 自定义输入
    var modelOpts = [{ value: "", label: "自定义模型名称…" }].concat(
      (preset.models || []).map(function (x) { return { value: x, label: x }; })
    );
    var modelVal = m ? m.model : (preset.models[0] || "");
    var modelSel = modelOpts.map(function (o) {
      return '<option value="' + escAttr(o.value) + '"' + (o.value === modelVal ? " selected" : "") + '>' + esc(o.label) + '</option>';
    }).join("");
    var isCustomModel = !modelVal || !preset.models.some(function (x) { return x === modelVal; });

    var body = document.getElementById("model-dlg-body");
    if (!body) return;
    document.getElementById("model-dlg-title").textContent = title;

    body.innerHTML = '<form class="model-form" id="model-form" onsubmit="event.preventDefault(); saveModelForm();">' +
      '<div class="model-form-row">' +
        '<label>提供商</label>' +
        '<select id="mf-preset" class="sf" onchange="modelPresetChange(this.value)">' + provSel + '</select>' +
        (preset.docs ? '<a class="model-docs-link" href="' + escAttr(preset.docs) + '" target="_blank" rel="noopener">查看文档</a>' : '') +
      '</div>' +
      '<div class="model-form-row">' +
        '<label>显示名称</label>' +
        '<input id="mf-label" class="sf" value="' + escAttr(m ? m.label : "") + '" placeholder="如：腾讯云 · MiniMax-M2.5">' +
      '</div>' +
      '<div class="model-form-row">' +
        '<label>模型名称</label>' +
        '<div class="model-sel-wrap">' +
          '<select id="mf-model-sel" class="sf" onchange="modelModelSelChange(this.value)">' + modelSel + '</select>' +
          '<input id="mf-model-custom" class="sf' + (isCustomModel ? '' : ' hidden') + '" value="' + escAttr(isCustomModel ? (m ? m.model : "") : "") + '" placeholder="输入模型参数值，例如 gpt-4o 或 openai/gpt-4o">' +
        '</div>' +
      '</div>' +
      '<div class="model-form-row">' +
        '<label>API Key</label>' +
        '<div class="model-key-wrap">' +
          '<input id="mf-key" class="sf" type="password" value="' + escAttr(m ? m.apiKey : "") + '" placeholder="输入你的 API Key，仅保存在本机浏览器">' +
          '<button type="button" class="icon-btn" onclick="modelToggleKeyVis()" title="显示/隐藏">' + WB.ic("eye") + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="model-form-row">' +
        '<label>API 地址</label>' +
        '<input id="mf-baseurl" class="sf" value="' + escAttr(m ? m.baseUrl : preset.baseUrl) + '" placeholder="https://.../v1/chat/completions">' +
      '</div>' +
      '<div class="model-form-foot">' +
        '<span class="empty" id="model-form-hint">仅支持 OpenAI 兼容协议 API</span>' +
        '<button type="button" class="btn-sm ghost" onclick="closeModelModal()">取消</button>' +
        '<button type="submit" class="btn">保存</button>' +
      '</div>' +
    '</form>';

    document.getElementById("model-modal").style.display = "flex";
    // 自动聚焦显示名称
    setTimeout(function () { var el = document.getElementById("mf-label"); if (el) el.focus(); }, 50);
  }

  function closeModelModal() {
    var m = document.getElementById("model-modal");
    if (m) m.style.display = "none";
    editingId = null;
  }

  function modelPresetChange(k) {
    var preset = PRESETS[k] || PRESETS.custom;
    var docsLink = document.querySelector(".model-docs-link");
    if (docsLink) {
      docsLink.href = preset.docs || "javascript:void(0)";
      docsLink.style.display = preset.docs ? "" : "none";
    }
    var baseIn = document.getElementById("mf-baseurl");
    if (baseIn && !editingId) baseIn.value = preset.baseUrl || "";
    var sel = document.getElementById("mf-model-sel");
    var customIn = document.getElementById("mf-model-custom");
    if (sel) {
      var opts = [{ value: "", label: "自定义模型名称…" }].concat((preset.models || []).map(function (x) { return { value: x, label: x }; }));
      sel.innerHTML = opts.map(function (o) { return '<option value="' + escAttr(o.value) + '">' + esc(o.label) + '</option>'; }).join("");
      var first = preset.models && preset.models[0] ? preset.models[0] : "";
      sel.value = first;
      if (customIn) {
        customIn.classList.toggle("hidden", !!first);
        customIn.value = first ? "" : "";
        customIn.placeholder = preset.modelHint || "输入模型参数值，例如 gpt-4o 或 openai/gpt-4o";
      }
    }
    var hint = document.getElementById("model-form-hint");
    if (hint) hint.textContent = preset.hint || "仅支持 OpenAI 兼容协议 API";
  }

  function modelModelSelChange(v) {
    var customIn = document.getElementById("mf-model-custom");
    if (customIn) {
      customIn.classList.toggle("hidden", !!v);
      if (!v) customIn.focus();
      else customIn.value = "";
    }
  }

  function modelToggleKeyVis() {
    var inEl = document.getElementById("mf-key");
    if (!inEl) return;
    inEl.type = inEl.type === "password" ? "text" : "password";
  }

  function saveModelForm() {
    var presetEl = document.getElementById("mf-preset");
    var labelEl = document.getElementById("mf-label");
    var modelSelEl = document.getElementById("mf-model-sel");
    var modelCustomEl = document.getElementById("mf-model-custom");
    var keyEl = document.getElementById("mf-key");
    var baseEl = document.getElementById("mf-baseurl");
    var hint = document.getElementById("model-form-hint");

    var presetId = presetEl ? presetEl.value : "";
    if (!presetId || !PRESETS[presetId]) {
      if (hint) hint.textContent = "请先选择提供商";
      return;
    }
    var model = modelSelEl && modelSelEl.value ? modelSelEl.value : (modelCustomEl ? modelCustomEl.value.trim() : "");
    if (!model) {
      if (hint) hint.textContent = "请填写模型名称";
      return;
    }
    var baseUrl = (baseEl ? baseEl.value.trim() : "");
    if (!baseUrl) {
      if (hint) hint.textContent = "请填写 API 地址";
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      if (hint) hint.textContent = "API 地址需以 http:// 或 https:// 开头";
      return;
    }
    var apiKey = (keyEl ? keyEl.value.trim() : "");
    var label = (labelEl ? labelEl.value.trim() : "");
    if (!label) label = PRESETS[presetId].label + " · " + model;

    var list = modelsLoad();
    if (editingId) {
      var idx = list.findIndex(function (m) { return m.id === editingId; });
      if (idx >= 0) {
        list[idx] = { id: editingId, presetId: presetId, label: label, baseUrl: baseUrl, apiKey: apiKey, model: model, updatedAt: Date.now() };
      }
    } else {
      var newM = { id: genId(), presetId: presetId, label: label, baseUrl: baseUrl, apiKey: apiKey, model: model, createdAt: Date.now() };
      list.push(newM);
      if (!activeId()) setActiveId(newM.id);
    }
    modelsSave(list);
    closeModelModal();
    renderModels();
    if (window.__data) {
      // 同步刷新 AI 助手页顶部提示
      if (typeof renderAI === "function") renderAI(window.__data);
    }
  }

  function modelSetActive(id) {
    setActiveId(id);
    renderModels();
    if (window.__data && typeof renderAI === "function") renderAI(window.__data);
  }

  function modelEdit(id) { openModelModal(id); }
  function modelDelete(id) {
    WB.dialog.confirm("删除这条模型配置？删除后不可恢复。", function () {
      var list = modelsLoad().filter(function (m) { return m.id !== id; });
      modelsSave(list);
      if (activeId() === id) setActiveId(list.length ? list[0].id : "");
      renderModels();
      if (window.__data && typeof renderAI === "function") renderAI(window.__data);
    });
  }

  // ---------- 暴露全局接口 ----------
  window.PRESETS = PRESETS;
  window.modelsLoad = modelsLoad;
  window.getAiActiveConfig = getActiveConfig;
  window.renderModels = renderModels;
  window.openModelModal = openModelModal;
  window.closeModelModal = closeModelModal;
  window.modelPresetChange = modelPresetChange;
  window.modelModelSelChange = modelModelSelChange;
  window.modelToggleKeyVis = modelToggleKeyVis;
  window.saveModelForm = saveModelForm;
  window.modelSetActive = modelSetActive;
  window.modelEdit = modelEdit;
  window.modelDelete = modelDelete;
})();
