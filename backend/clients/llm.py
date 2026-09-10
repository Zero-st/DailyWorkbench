# -*- coding: utf-8 -*-
"""OpenAI 兼容 LLM 瘦客户端：chat（结构化 JSON）+ embedding。纯标准库 urlopen。

为什么新建而不复用前端 /api/chat：那条代理与对话 UI 强耦合（面向浏览器 CORS 透传，
key/model 由前端 payload 决定）。enrich 是**后端无头批处理**，需要一个「传文本 → 拿
结构化结果 / 向量」的无副作用函数，故在此另起一个瘦封装（请求构造仿 server._do_chat_proxy）。

守北极星：只用标准库（urllib），不引 openai/requests；缺配置由调用方优雅停用。见 ADR 0011。
"""
import http.client
import json
import re
import socket
import ssl
import urllib.request
import urllib.error

# 瞬时网络错误（大响应易 IncompleteRead、跨区易超时）→ 有界重试；HTTPError(4xx/5xx) 不重试
_TRANSIENT = (http.client.IncompleteRead, socket.timeout, TimeoutError, ConnectionError, urllib.error.URLError)


def _post(url, key, payload, timeout=60, retries=3):
    """POST JSON 到 OpenAI 兼容端点，返回解析后的 dict。

    瞬时网络错误（IncompleteRead/超时/连接重置）有界重试；证书链异常降级为不校验重试。
    HTTPError（模型不存在/鉴权失败等）直接抛 RuntimeError，不重试。
    """
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", "Bearer " + key)
    ctx = ssl.create_default_context()
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            raise RuntimeError("LLM HTTP %d: %s" % (e.code, detail[:300]))
        except _TRANSIENT as e:
            # 瞬时错误（含 URLError/证书问题/超时/连接重置）有界重试，**始终用校验过的 ctx**。
            # 不像仓内 http_get_*（抓公开内容）那样降级为不校验——本请求带 API 密钥，
            # 不校验重发会把 Bearer key 暴露给 MITM（见 code-review F2）。
            last = e
    raise RuntimeError("LLM 瞬时网络错误重试 %d 次仍失败: %s" % (retries, last))


def _extract_json(text):
    """从模型返回的 content 里稳健抽出 JSON（容忍 ```json 代码围栏 / 前后废话）。"""
    if not text:
        return None
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s, flags=re.IGNORECASE).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    # 退一步：截取第一个 [ 或 { 到最后一个 ] 或 }
    for lo, hi in (("[", "]"), ("{", "}")):
        i, j = s.find(lo), s.rfind(hi)
        if 0 <= i < j:
            try:
                return json.loads(s[i:j + 1])
            except Exception:
                continue
    return None


def chat_json(base_url, model, key, system, user, timeout=90):
    """调 chat/completions，要求模型只回 JSON，返回解析后的 Python 对象（失败返回 None）。"""
    url = base_url + "/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
    }
    data = _post(url, key, payload, timeout=timeout)
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None
    return _extract_json(content)


def embed(base_url, model, key, texts, timeout=60):
    """调 embeddings，返回向量列表 [[float,...], ...]，与 texts 一一对应。

    texts 为字符串列表。上游按 index 排序（OpenAI 兼容规范），此处仍按 index 重排以防乱序。
    """
    if not texts:
        return []
    url = base_url + "/embeddings"
    payload = {"model": model, "input": list(texts)}
    data = _post(url, key, payload, timeout=timeout)
    rows = data.get("data") or []
    rows = sorted(rows, key=lambda r: r.get("index", 0))
    return [r.get("embedding") or [] for r in rows]


def probe_dim(base_url, model, key):
    """用一条测试文本探测 embedding 维度；失败返回 0。"""
    try:
        v = embed(base_url, model, key, ["dimension probe 维度探测"])
        return len(v[0]) if v and v[0] else 0
    except Exception:
        return 0
