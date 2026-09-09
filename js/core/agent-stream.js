// 核心：页面触发无头 agent 的「流式脊柱」（本仓首个流式消费者）。
// 后端 POST /api/agent 回 text/event-stream（每帧 `data: {json}\n\n`）；
// 这里用 fetch + response.body.getReader() 解析 SSE，把精简事件派发给回调。
// 蒸馏楔子（distill.js）与通用 agent 对话（ai.js）都复用它。
//
// 为什么不用 core/net.js 的 fetchT：它带 AbortController 超时，会掐断长连接流。
// agent 一次跑可能几十秒，这里用裸 fetch，由后端墙钟看门狗兜底（见 backend/clients/agent.py）。
//
// 后端事件契约（backend/clients/agent.py 的 stream()）：
//   {type:"meta",   phase, model?, mcp?}   启动/init 元信息
//   {type:"text",   text}                  助手正文增量（token 级）
//   {type:"tool",   name, input?}          agent 在调某工具（页面显示「🔍 …」）
//   {type:"result", text, cost_usd?, stop?, denials?}  终答 + 成本
//   {type:"error",  error, configured?}    未配置/启动失败/内部错误（优雅劣化）

/**
 * 发起一次流式 agent 运行。
 * @param {{task?:string, payload?:Object}} req  task: "distill"|"chat"…；payload: {prompt?, url?, messages?}
 * @param {{onMeta?:Function,onText?:Function,onTool?:Function,onResult?:Function,onError?:Function}} cbs
 * @returns {Promise<void>} 流结束（或出错）后 resolve
 */
export async function agentStream(req, cbs) {
  cbs = cbs || {};
  const emitErr = (m) => { if (cbs.onError) cbs.onError(typeof m === "string" ? { error: m } : m); };

  let resp;
  try {
    resp = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: (req && req.task) || "chat", payload: (req && req.payload) || {} }),
    });
  } catch (e) {
    // 后端没起 / 从静态源打开 → 与站内其它请求同款提示
    emitErr("连不上后端：请从后端源打开工作台（python -m backend.server），别用 file:// 或静态托管");
    return;
  }
  if (!resp.ok || !resp.body) {
    emitErr("HTTP " + resp.status);
    return;
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      // SSE 以空行（\n\n）分帧；可能一次 read 到多帧或半帧
      let sep;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        _dispatchFrame(frame, cbs);
      }
    }
    if (buf.trim()) _dispatchFrame(buf, cbs); // 收尾残帧（正常不会有）
  } catch (e) {
    emitErr("流中断：" + (e && e.message ? e.message : String(e)));
  }
}

function _dispatchFrame(frame, cbs) {
  // 一帧可能含多行；取 data: 行拼接（SSE 规范允许多行 data）
  const dataLines = [];
  frame.split("\n").forEach((ln) => {
    if (ln.indexOf("data:") === 0) dataLines.push(ln.slice(5).replace(/^ /, ""));
  });
  if (!dataLines.length) return;
  let ev;
  try { ev = JSON.parse(dataLines.join("\n")); } catch (_) { return; }
  switch (ev && ev.type) {
    case "meta":   cbs.onMeta   && cbs.onMeta(ev); break;
    case "text":   cbs.onText   && cbs.onText(ev.text || "", ev); break;
    case "tool":   cbs.onTool   && cbs.onTool(ev); break;
    case "result": cbs.onResult && cbs.onResult(ev); break;
    case "error":  cbs.onError  && cbs.onError(ev); break;
    default: break;
  }
}
