# -*- coding: utf-8 -*-
"""本地工作台服务器：静态文件 + JSON API（路线 A 纯本地方案）。

用法：
    python server.py [端口]     # 默认 8080
    浏览器打开 http://localhost:8080

为什么不用 python -m http.server：
  纯静态服务无法执行脚本，页面上的「同步数据」按钮会退化成重读旧文件。
  本服务在静态能力之外提供 POST /api/refresh —— 后台运行 local_refresh.py，
  点按钮即可真正重抓资讯并重建 data.json。
仅监听 127.0.0.1，不暴露到局域网。

分层（高内聚，2026-08 重构）：
  server.py       —— 仅 HTTP 路由 + 请求/响应；用路由表分派，不再一长串 if
  supabase_client —— /api/models 的云端存取
  kb_service      —— /api/kb/* 的 Obsidian vault 扫描/读/搜/沉淀
  wb_config       —— 环境绑定配置解析
"""
import json
import os
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, unquote, parse_qs

from backend.core import config as wb_config
from backend.core.paths import ROOT
from backend.clients import supabase as sb
from backend.clients import kb

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

_lock = threading.Lock()
_running = {"on": False}


def _do_refresh():
    """后台执行 local_refresh.py；已在跑则返回 running=True 让前端提示用户。"""
    with _lock:
        if _running["on"]:
            _running["queued_yes"] = True  # 仅作提示标志，不影响主流程
            return "running"
        _running["on"] = True
    state = "started"
    try:
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        subprocess.run(
            [PY, "-m", "backend.pipeline.local_refresh"],
            cwd=ROOT, env=env, timeout=600,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        sys.stderr.write("[refresh] %s\n" % e)
        state = "error: %s" % e
    finally:
        _running["on"] = False
    return state


def _do_chat_proxy(payload):
    """代理 AI 聊天请求到目标 API，解决浏览器跨域(CORS)问题。"""
    target = payload.get("targetUrl", "").strip()
    if not target:
        return 400, b'{"error":"missing targetUrl"}'
    # 目标主机白名单（wb_config.chat_allow_hosts，空=不限制）：防止本服务被误用为开放代理
    allow = wb_config.chat_allow_hosts()
    if allow:
        host = (urlparse(target).hostname or "").lower()
        if host not in [h.lower() for h in allow]:
            return 403, b'{"error":"target host not allowed"}'
    api_key = payload.get("key", "")
    if not api_key:
        return 401, b'{"error":"missing api key"}'
    body = json.dumps({
        "model": payload.get("model", ""),
        "messages": payload.get("messages", []),
        "max_tokens": payload.get("max_tokens", 4000),
    }).encode("utf-8")
    req = Request(target, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + api_key)
    try:
        with urlopen(req, timeout=60) as resp:
            return resp.status, resp.read()
    except HTTPError as e:
        err_body = e.read()
        return e.code, err_body if err_body else b'{"error":"upstream http error ' + str(e.code).encode("utf-8") + b'"}'
    except URLError as e:
        sys.stderr.write("[chat] %s\n" % e)
        return 502, b'{"error":"upstream unreachable: ' + str(e).encode("utf-8") + b'"}'


class Handler(SimpleHTTPRequestHandler):
    # 路由表：路径 -> 处理方法名（替代原先一长串 if path==）
    GET_ROUTES = {
        "/api/models": "_get_models",
        "/api/kb/tree": "_get_kb_tree",
        "/api/kb/note": "_get_kb_note",
        "/api/kb/search": "_get_kb_search",
    }
    POST_ROUTES = {
        "/api/chat": "_post_chat",
        "/api/models": "_post_models",
        "/api/kb/save": "_post_kb_save",
        "/api/refresh": "_post_refresh",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        # data.json 永不缓存：前端 30s 轮询才能拿到新数据
        if self.path.split("?")[0].endswith("data.json"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    # ---------- 响应/请求小工具 ----------
    def _json(self, status, obj):
        self._raw(status, json.dumps(obj).encode("utf-8"))

    def _raw(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    # ---------- 路由分派 ----------
    def do_GET(self):
        fn = self.GET_ROUTES.get(self.path.split("?")[0])
        if fn:
            getattr(self, fn)()
            return
        super().do_GET()  # 其余静态文件交给父类

    def do_POST(self):
        fn = self.POST_ROUTES.get(self.path.split("?")[0])
        if fn:
            getattr(self, fn)()
            return
        self.send_error(404)

    # ---------- GET 端点 ----------
    def _get_models(self):
        if not sb.configured():
            self._json(200, {"configured": False})
            return
        res = sb.get_config()
        if res == "ERR":
            self._json(200, {"configured": True, "data": None, "error": "read failed"})
        else:
            self._json(200, {"configured": True, "data": res if res is not None else {}})

    def _get_kb_tree(self):
        if not kb.VAULT:
            self._json(200, {"configured": False})
            return
        files, sig = kb.scan()
        self._json(200, {"configured": True, "root": kb.VAULT, "files": files, "sig": sig})

    def _get_kb_note(self):
        if not kb.VAULT:
            self._json(200, {"configured": False})
            return
        rel = (self.path.split("?", 1)[1].split("path=", 1)[1] if "path=" in self.path else "")
        rel = unquote(rel).strip()
        if not rel:
            self._json(400, {"error": "missing path"})
            return
        res = kb.read_note(rel)
        if res is None:
            self._json(404, {"error": "not found or out of vault"})
            return
        self._json(200, {"configured": True, "note": res})

    def _get_kb_search(self):
        if not kb.VAULT:
            self._json(200, {"configured": False, "results": []})
            return
        qs = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
        q = (qs.get("q", [""])[0] or "").strip()
        stype = (qs.get("type", ["full"])[0] or "full").strip()
        res = kb.search(q, stype) if q else []
        self._json(200, {"configured": True, "results": res, "q": q, "type": stype})

    # ---------- POST 端点 ----------
    def _post_chat(self):
        try:
            status, body = _do_chat_proxy(self._body())
            self._raw(status, body)
        except Exception as e:
            sys.stderr.write("[chat] handler error: %s\n" % e)
            body = b'{"error":"internal error"}'
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def _post_models(self):
        try:
            payload = self._body()
            if not sb.configured():
                self._json(200, {"ok": False, "configured": False})
                return
            data = {
                "models": payload.get("models", []),
                "activeId": payload.get("activeId", ""),
            }
            ok = sb.upsert(data)
            self._json(200, {"ok": ok, "configured": True})
        except Exception as e:
            sys.stderr.write("[models] %s\n" % e)
            self._json(500, {"error": "internal error"})

    def _post_kb_save(self):
        try:
            payload = self._body()
            res = kb.save(payload.get("module", ""), payload.get("source", "note"),
                          payload.get("title", ""), payload.get("body", ""))
            self._json(200 if res.get("ok") else 400, res)
        except Exception as e:
            sys.stderr.write("[kb-save] %s\n" % e)
            self._json(500, {"error": "internal error"})

    def _post_refresh(self):
        # 后台线程启动刷新，最多等 200ms 看是否秒返回「已在跑」
        container = {"r": None}

        def runner():
            container["r"] = _do_refresh()

        t = threading.Thread(target=runner, daemon=True)
        t.start()
        t.join(timeout=0.2)
        result = {"ok": True, "msg": "refresh started"}
        if container["r"] == "running":
            result["running"] = True
            result["msg"] = "已有任务在跑，本轮跳过"
        self._json(200, result)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Workbench: http://localhost:%d  (Ctrl+C stop)" % port)
    print("POST /api/refresh -> local_refresh.py")
    print("POST /api/chat   -> AI proxy")
    if sb.configured():
        print("GET/POST /api/models -> Supabase (云端配置已启用)")
    else:
        print("GET/POST /api/models -> 未配置 Supabase，回退 localStorage")
    if kb.VAULT:
        print("GET /api/kb/* -> Obsidian vault 已启用: " + kb.VAULT)
        print("POST /api/kb/save -> 沉淀根: " + (kb.DEPOSIT or "(未配置 depositRoot)"))
    else:
        print("GET /api/kb/* -> 未配置 kb.local.json，知识库不可用")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
