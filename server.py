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
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

# ---------- Supabase 配置（云端存储模型配置，前端不持 key） ----------
# 优先级：环境变量 > 本地 supabase.local.json（已 gitignore，不入库）
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
_cfg_path = os.path.join(HERE, "supabase.local.json")
if (not SUPABASE_URL or not SUPABASE_KEY) and os.path.exists(_cfg_path):
    try:
        with open(_cfg_path, "r", encoding="utf-8") as _f:
            _c = json.load(_f)
        SUPABASE_URL = _c.get("url", "").rstrip("/") or SUPABASE_URL
        SUPABASE_KEY = _c.get("serviceKey") or _c.get("service_role") or SUPABASE_KEY
    except Exception as _e:
        sys.stderr.write("[supabase] 读取本地配置失败: %s\n" % _e)

# ---------- 知识库配置（Obsidian vault 只读浏览 + 沉淀写入根） ----------
# 优先级：环境变量 > 本地 kb.local.json（已 gitignore，不入库）
KB_VAULT = os.environ.get("KB_VAULT", "")
KB_DEPOSIT = os.environ.get("KB_DEPOSIT", "")
_kb_cfg_path = os.path.join(HERE, "kb.local.json")
if (not KB_VAULT) and os.path.exists(_kb_cfg_path):
    try:
        with open(_kb_cfg_path, "r", encoding="utf-8") as _f:
            _kc = json.load(_f)
        KB_VAULT = os.path.normpath(_kc.get("vault", "") or "")
        KB_DEPOSIT = os.path.normpath(_kc.get("depositRoot", "") or "")
    except Exception as _e:
        sys.stderr.write("[kb] 读取配置失败: %s\n" % _e)
# 沉淀模块白名单（与工作台侧边栏一致，去空格）
KB_MODULES = ["今日", "资讯", "AI助手", "会话档案", "知识库"]
KB_SOURCES = ["review", "ai-daily", "news", "ai-chat", "session", "note"]
KB_SKIP_DIRS = {".obsidian", ".git", ".claude", ".trash", ".cache", "node_modules"}

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
            [PY, os.path.join(HERE, "local_refresh.py")],
            cwd=HERE, env=env, timeout=600,
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


def _sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
    }


def _sb_get_config():
    """读取 model_configs 单行；未配置返回 None，读取失败返回 'ERR'。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = SUPABASE_URL + "/rest/v1/model_configs?select=data&id=eq.default"
    req = Request(url, headers=_sb_headers())
    try:
        with urlopen(req, timeout=10) as resp:
            arr = json.loads(resp.read().decode("utf-8"))
            if isinstance(arr, list) and arr and arr[0].get("data") is not None:
                return arr[0]["data"]
            return {}  # 配置了但还没有数据
    except Exception as e:
        sys.stderr.write("[sb] get: %s\n" % e)
        return "ERR"


def _sb_upsert(data):
    """写入/合并 model_configs 单行；失败返回 False。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    url = SUPABASE_URL + "/rest/v1/model_configs"
    body = json.dumps({"id": "default", "data": data}).encode("utf-8")
    req = Request(url, data=body, method="POST", headers=_sb_headers())
    req.add_header("Prefer", "resolution=merge-duplicates")
    try:
        with urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201, 204)
    except HTTPError as e:
        sys.stderr.write("[sb] upsert: %s\n" % e.read().decode("utf-8", "ignore"))
        return False
    except Exception as e:
        sys.stderr.write("[sb] upsert: %s\n" % e)
        return False


# ==================== 知识库（Obsidian vault） ====================
import re as _re
_FM_RE = _re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", _re.DOTALL)
_H1_RE = _re.compile(r"^#\s+(.+?)\s*$", _re.MULTILINE)


def _kb_under(path, root):
    """realpath 安全校验：path 必须位于 root 之下（防穿越）。"""
    if not root or not path:
        return False
    try:
        rp = os.path.realpath(path)
        rr = os.path.realpath(root)
        return os.path.commonpath([rp, rr]) == rr
    except Exception:
        return False


def _kb_parse_fm(raw):
    """拆 frontmatter，简易解析（不依赖 pyyaml）。返回 (fm_dict, body)。"""
    m = _FM_RE.match(raw)
    if not m:
        return {}, raw
    fm_raw, body = m.group(1), m.group(2)
    fm = {}
    for line in fm_raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        k, _, v = line.partition(":")
        k, v = k.strip(), v.strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
        elif v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        fm[k] = v
    return fm, body


def _kb_title_of(name, body):
    """笔记标题：frontmatter title > 首个 h1 > 文件名(去 .md)。"""
    fm, _ = _kb_parse_fm(body if isinstance(body, str) else "")
    if fm.get("title"):
        return str(fm["title"])
    if isinstance(body, str):
        m = _H1_RE.search(body[:2000])
        if m:
            return m.group(1).strip()
    return name[:-3] if name.lower().endswith(".md") else name


def _kb_scan():
    """递归扫 vault，返回 (files, sig)。files=[{rel,name,title,mtime,size}]。"""
    files = []
    sig = 0
    if not KB_VAULT or not os.path.isdir(KB_VAULT):
        return files, sig
    for dirpath, dirnames, filenames in os.walk(KB_VAULT):
        dirnames[:] = [d for d in dirnames if d not in KB_SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if not fn.lower().endswith(".md"):
                continue
            full = os.path.join(dirpath, fn)
            try:
                st = os.stat(full)
            except Exception:
                continue
            rel = os.path.relpath(full, KB_VAULT).replace("\\", "/")
            title = fn[:-3]
            try:
                with open(full, "r", encoding="utf-8") as _f:
                    raw = _f.read(4000)
                title = _kb_title_of(fn, raw)
            except Exception:
                pass
            files.append({"rel": rel, "name": fn, "title": title,
                          "mtime": int(st.st_mtime), "size": st.st_size})
            sig += int(st.st_mtime)
    files.sort(key=lambda x: x["rel"].lower())
    return files, sig


def _kb_read_note(rel):
    """读单篇 md：返回 {path,raw,fm,body,sibs} 或 None。"""
    if not KB_VAULT:
        return None
    full = os.path.join(KB_VAULT, rel.replace("/", os.sep))
    if not _kb_under(full, KB_VAULT) or not os.path.isfile(full):
        return None
    try:
        with open(full, "r", encoding="utf-8") as _f:
            raw = _f.read()
    except Exception as e:
        return {"error": "read failed: %s" % e}
    fm, body = _kb_parse_fm(raw)
    sib_dir = os.path.dirname(full)
    sibs = []
    try:
        for fn in sorted(os.listdir(sib_dir)):
            if fn.lower().endswith(".md"):
                sibs.append(fn[:-3])
    except Exception:
        pass
    return {"path": rel, "raw": raw, "fm": fm, "body": body, "sibs": sibs}


def _kb_search(q, stype="full"):
    """检索：full=正文子串+高亮偏移；title=文件名/标题；tag=frontmatter tags。返回 [{path,title,snippet,hl}]，限 50。"""
    if not KB_VAULT or not q:
        return []
    q = q.strip()
    ql = q.lower()
    if stype == "tag" and not q.startswith("#"):
        ql = q  # tag 内容
    out = []
    files, _ = _kb_scan()
    for f in files:
        full = os.path.join(KB_VAULT, f["rel"].replace("/", os.sep))
        try:
            with open(full, "r", encoding="utf-8") as _f:
                raw = _f.read()
        except Exception:
            continue
        fm, body = _kb_parse_fm(raw)
        hit = None
        snippet = ""
        hl = [0, 0]
        if stype == "title":
            if ql in f["title"].lower() or ql in f["name"].lower():
                hit = f["title"]
                snippet = f["title"]
        elif stype == "tag":
            tags = fm.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]
            tagsl = [str(t).lower() for t in tags]
            # 也扫行内 #tag
            inline = [w.lstrip("#").lower() for w in _re.findall(r"(?<![\w#])#[\u4e00-\u9fa5\w-]+", body)]
            if any(ql == t or ql in t for t in tagsl + inline):
                hit = f["title"]
                snippet = "# " + ", ".join(tags if isinstance(tags, list) else [tags])[:120]
        else:  # full
            bl = body.lower()
            idx = bl.find(ql)
            if idx >= 0:
                hit = f["title"]
                start = max(0, idx - 40)
                snippet = body[start:idx + len(q) + 80].replace("\n", " ")
                hl = [idx - start if idx >= start else 0, len(q)]
        if hit:
            out.append({"path": f["rel"], "title": f["title"],
                        "snippet": snippet[:200], "hl": hl})
            if len(out) >= 50:
                break
    return out


def _kb_clean_title(title):
    """清洗文件名：仅允许中文/字母/数字/-/_，去空格与特殊字符。"""
    if not title:
        return ""
    t = title.strip()
    # 去除 Windows 非法字符与空格
    t = _re.sub(r'[\\/:*?"<>|\s]+', "-", t)
    t = _re.sub(r"[^\u4e00-\u9fa5A-Za-z0-9_-]+", "-", t)
    t = _re.sub(r"-{2,}", "-", t).strip("-_")
    return t[:60]


def _kb_save(module, source, title, body):
    """沉淀写入：三级目录 + 同名冲突 + frontmatter + _index.jsonl。返回 dict。"""
    if not KB_DEPOSIT:
        return {"ok": False, "error": "未配置 depositRoot"}
    if module not in KB_MODULES:
        return {"ok": False, "error": "模块不在白名单: " + module}
    if source not in KB_SOURCES:
        source = "note"
    import datetime as _dt
    now = _dt.datetime.now()
    date = now.strftime("%Y-%m-%d")
    ts = now.strftime("%Y-%m-%dT%H:%M:%S") + ("+08:00")
    base = _kb_clean_title(title) or ("未命名-" + now.strftime("%Y%m%d-%H%M%S"))
    day_dir = os.path.join(KB_DEPOSIT, module, date)
    if not _kb_under(day_dir, KB_DEPOSIT):
        return {"ok": False, "error": "路径越界"}
    try:
        os.makedirs(day_dir, exist_ok=True)
    except Exception as e:
        return {"ok": False, "error": "建目录失败: %s" % e}
    # 同名冲突解析
    fname = base + ".md"
    fpath = os.path.join(day_dir, fname)
    n = 2
    while os.path.exists(fpath):
        if n >= 10:
            fname = "%s-%s.md" % (base, now.strftime("%Y%m%d-%H%M%S"))
            fpath = os.path.join(day_dir, fname)
            break
        fname = "%s-%d.md" % (base, n)
        fpath = os.path.join(day_dir, fname)
        n += 1
    rel = os.path.relpath(fpath, KB_DEPOSIT).replace("\\", "/")
    front = "---\nmodule: %s\ndate: %s\nsource: %s\nsavedAt: %s\ntitle: %s\ntags: [AI工作台, %s]\n---\n\n" % (
        module, date, source, ts, base, module)
    try:
        with open(fpath, "w", encoding="utf-8") as _f:
            _f.write(front + (body or "") + "\n")
        bsz = os.path.getsize(fpath)
    except Exception as e:
        return {"ok": False, "error": "写文件失败: %s" % e}
    # 追加 _index.jsonl
    rec = {"savedAt": ts, "module": module, "date": date, "relPath": rel,
           "fileName": fname, "title": base, "source": source, "bytes": bsz}
    try:
        with open(os.path.join(KB_DEPOSIT, "_index.jsonl"), "a", encoding="utf-8") as _f:
            _f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception as e:
        sys.stderr.write("[kb] index append failed: %s\n" % e)
    return {"ok": True, "path": rel, "fileName": fname, "savedAt": ts}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        # data.json 永不缓存：前端 30s 轮询才能拿到新数据
        if self.path.split("?")[0].endswith("data.json"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def _json(self, status, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/models":
            if not SUPABASE_URL or not SUPABASE_KEY:
                self._json(200, {"configured": False})
                return
            res = _sb_get_config()
            if res == "ERR":
                self._json(200, {"configured": True, "data": None, "error": "read failed"})
            else:
                self._json(200, {"configured": True, "data": res if res is not None else {}})
            return
        if path == "/api/kb/tree":
            if not KB_VAULT:
                self._json(200, {"configured": False})
                return
            files, sig = _kb_scan()
            self._json(200, {"configured": True, "root": KB_VAULT, "files": files, "sig": sig})
            return
        if path == "/api/kb/note":
            if not KB_VAULT:
                self._json(200, {"configured": False})
                return
            rel = (self.path.split("?", 1)[1].split("path=", 1)[1] if "path=" in self.path else "")
            from urllib.parse import unquote as _unq
            rel = _unq(rel).strip()
            if not rel:
                self._json(400, {"error": "missing path"})
                return
            res = _kb_read_note(rel)
            if res is None:
                self._json(404, {"error": "not found or out of vault"})
                return
            self._json(200, {"configured": True, "note": res})
            return
        if path == "/api/kb/search":
            if not KB_VAULT:
                self._json(200, {"configured": False, "results": []})
                return
            from urllib.parse import parse_qs as _pqs
            qs = _pqs(self.path.split("?", 1)[1]) if "?" in self.path else {}
            q = (qs.get("q", [""])[0] or "").strip()
            stype = (qs.get("type", ["full"])[0] or "full").strip()
            res = _kb_search(q, stype) if q else []
            self._json(200, {"configured": True, "results": res, "q": q, "type": stype})
            return
        # 其余静态文件交给父类处理
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/chat":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                payload = json.loads(raw) if raw else {}
                status, body = _do_chat_proxy(payload)
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                sys.stderr.write("[chat] handler error: %s\n" % e)
                body = b'{"error":"internal error"}'
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return
        if path == "/api/models":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                payload = json.loads(raw) if raw else {}
                if not SUPABASE_URL or not SUPABASE_KEY:
                    self._json(200, {"ok": False, "configured": False})
                    return
                data = {
                    "models": payload.get("models", []),
                    "activeId": payload.get("activeId", ""),
                }
                ok = _sb_upsert(data)
                self._json(200, {"ok": ok, "configured": True})
            except Exception as e:
                sys.stderr.write("[models] %s\n" % e)
                self._json(500, {"error": "internal error"})
            return
        if path == "/api/kb/save":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                payload = json.loads(raw) if raw else {}
                res = _kb_save(payload.get("module", ""), payload.get("source", "note"),
                               payload.get("title", ""), payload.get("body", ""))
                self._json(200 if res.get("ok") else 400, res)
            except Exception as e:
                sys.stderr.write("[kb-save] %s\n" % e)
                self._json(500, {"error": "internal error"})
            return
        if path != "/api/refresh":
            self.send_error(404)
            return
        # 同步启动后台线程，立刻获取返回值；告诉前端是「刚开始」还是「复用已有任务」
        result = {"ok": True, "msg": "ok"}
        container = {"r": None}

        def runner():
            container["r"] = _do_refresh()

        t = threading.Thread(target=runner, daemon=True)
        t.start()
        # 最多等 200ms 看是否秒返回「已在跑」
        t.join(timeout=0.2)
        if container["r"] == "running":
            result["running"] = True
            result["msg"] = "已有任务在跑，本轮跳过"
        else:
            result["msg"] = "refresh started"
        body = json.dumps(result).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Workbench: http://localhost:%d  (Ctrl+C stop)" % port)
    print("POST /api/refresh -> local_refresh.py")
    print("POST /api/chat   -> AI proxy")
    if SUPABASE_URL and SUPABASE_KEY:
        print("GET/POST /api/models -> Supabase (云端配置已启用)")
    else:
        print("GET/POST /api/models -> 未配置 Supabase，回退 localStorage")
    if KB_VAULT:
        print("GET /api/kb/* -> Obsidian vault 已启用: " + KB_VAULT)
        print("POST /api/kb/save -> 沉淀根: " + (KB_DEPOSIT or "(未配置 depositRoot)"))
    else:
        print("GET /api/kb/* -> 未配置 kb.local.json，知识库不可用")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
