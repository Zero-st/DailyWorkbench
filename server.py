# -*- coding: utf-8 -*-
"""本地工作台服务器：静态文件 + 一键刷新接口（路线 A 纯本地方案）。

用法：
    python server.py [端口]     # 默认 8080
    浏览器打开 http://localhost:8080

为什么不用 python -m http.server：
  纯静态服务无法执行脚本，页面上的「同步数据」按钮会退化成重读旧文件。
  本服务在静态能力之外提供 POST /api/refresh —— 后台运行 local_refresh.py，
  点按钮即可真正重抓资讯并重建 data.json。
仅监听 127.0.0.1，不暴露到局域网。
"""
import json
import os
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

_lock = threading.Lock()
_running = {"on": False}


def _do_refresh():
    """后台执行 local_refresh.py；已在跑则忽略重复触发。"""
    with _lock:
        if _running["on"]:
            return
        _running["on"] = True
    try:
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        subprocess.run(
            [PY, os.path.join(HERE, "local_refresh.py")],
            cwd=HERE, env=env, timeout=600,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        sys.stderr.write("[refresh] %s\n" % e)
    finally:
        _running["on"] = False


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        # data.json 永不缓存：前端 30s 轮询才能拿到新数据
        if self.path.split("?")[0].endswith("data.json"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/refresh":
            self.send_error(404)
            return
        threading.Thread(target=_do_refresh, daemon=True).start()
        body = json.dumps({"ok": True, "msg": "refresh started"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Workbench: http://localhost:%d  (Ctrl+C stop)" % port)
    print("POST /api/refresh -> local_refresh.py")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
