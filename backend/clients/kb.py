# -*- coding: utf-8 -*-
"""知识库服务：Obsidian vault 只读浏览(扫描/读/搜) + 沉淀写入。从 server.py 抽出，高内聚。

配置(vault/depositRoot)经 wb_config.kb() 解析；本模块不关心 HTTP 路由。
未配置时 VAULT/DEPOSIT 为空串，扫描/搜索返回空、保存返回错误。

注：frontmatter 解析(_parse_fm)与 export_data.fm() 语义不同（这里处理列表/引号/正文），
故意各自保留，不并入 wb_common。
"""
import json
import os
import re
import sys
import datetime as _dt

from backend.core import config as wb_config

VAULT, DEPOSIT = wb_config.kb()
# 沉淀模块白名单（与工作台侧边栏一致，去空格）
MODULES = ["今日", "资讯", "AI助手", "会话档案", "知识库"]
SOURCES = ["review", "ai-daily", "news", "ai-chat", "session", "note"]
SKIP_DIRS = {".obsidian", ".git", ".claude", ".trash", ".cache", "node_modules"}

_FM_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", re.DOTALL)
_H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


def _under(path, root):
    """realpath 安全校验：path 必须位于 root 之下（防穿越）。"""
    if not root or not path:
        return False
    try:
        rp = os.path.realpath(path)
        rr = os.path.realpath(root)
        return os.path.commonpath([rp, rr]) == rr
    except Exception:
        return False


def _parse_fm(raw):
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


def _title_of(name, body):
    """笔记标题：frontmatter title > 首个 h1 > 文件名(去 .md)。"""
    fm, _ = _parse_fm(body if isinstance(body, str) else "")
    if fm.get("title"):
        return str(fm["title"])
    if isinstance(body, str):
        m = _H1_RE.search(body[:2000])
        if m:
            return m.group(1).strip()
    return name[:-3] if name.lower().endswith(".md") else name


def scan():
    """递归扫 vault，返回 (files, sig)。files=[{rel,name,title,mtime,size}]。"""
    files = []
    sig = 0
    if not VAULT or not os.path.isdir(VAULT):
        return files, sig
    for dirpath, dirnames, filenames in os.walk(VAULT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if not fn.lower().endswith(".md"):
                continue
            full = os.path.join(dirpath, fn)
            try:
                st = os.stat(full)
            except Exception:
                continue
            rel = os.path.relpath(full, VAULT).replace("\\", "/")
            title = fn[:-3]
            try:
                with open(full, "r", encoding="utf-8") as _f:
                    raw = _f.read(4000)
                title = _title_of(fn, raw)
            except Exception:
                pass
            files.append({"rel": rel, "name": fn, "title": title,
                          "mtime": int(st.st_mtime), "size": st.st_size})
            sig += int(st.st_mtime)
    files.sort(key=lambda x: x["rel"].lower())
    return files, sig


def read_note(rel):
    """读单篇 md：返回 {path,raw,fm,body,sibs} 或 None。"""
    if not VAULT:
        return None
    full = os.path.join(VAULT, rel.replace("/", os.sep))
    if not _under(full, VAULT) or not os.path.isfile(full):
        return None
    try:
        with open(full, "r", encoding="utf-8") as _f:
            raw = _f.read()
    except Exception as e:
        return {"error": "read failed: %s" % e}
    fm, body = _parse_fm(raw)
    sib_dir = os.path.dirname(full)
    sibs = []
    try:
        for fn in sorted(os.listdir(sib_dir)):
            if fn.lower().endswith(".md"):
                sibs.append(fn[:-3])
    except Exception:
        pass
    return {"path": rel, "raw": raw, "fm": fm, "body": body, "sibs": sibs}


def search(q, stype="full"):
    """检索：full=正文子串+高亮偏移；title=文件名/标题；tag=frontmatter tags。返回 [{path,title,snippet,hl}]，限 50。"""
    if not VAULT or not q:
        return []
    q = q.strip()
    ql = q.lower()
    if stype == "tag" and not q.startswith("#"):
        ql = q  # tag 内容
    out = []
    files, _ = scan()
    for f in files:
        full = os.path.join(VAULT, f["rel"].replace("/", os.sep))
        try:
            with open(full, "r", encoding="utf-8") as _f:
                raw = _f.read()
        except Exception:
            continue
        fm, body = _parse_fm(raw)
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
            inline = [w.lstrip("#").lower() for w in re.findall(r"(?<![\w#])#[一-龥\w-]+", body)]
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


def _clean_title(title):
    """清洗文件名：仅允许中文/字母/数字/-/_，去空格与特殊字符。"""
    if not title:
        return ""
    t = title.strip()
    # 去除 Windows 非法字符与空格
    t = re.sub(r'[\\/:*?"<>|\s]+', "-", t)
    t = re.sub(r"[^一-龥A-Za-z0-9_-]+", "-", t)
    t = re.sub(r"-{2,}", "-", t).strip("-_")
    return t[:60]


def save(module, source, title, body):
    """沉淀写入：三级目录 + 同名冲突 + frontmatter + _index.jsonl。返回 dict。"""
    if not DEPOSIT:
        return {"ok": False, "error": "未配置 depositRoot"}
    if module not in MODULES:
        return {"ok": False, "error": "模块不在白名单: " + module}
    if source not in SOURCES:
        source = "note"
    now = _dt.datetime.now()
    date = now.strftime("%Y-%m-%d")
    ts = now.strftime("%Y-%m-%dT%H:%M:%S") + ("+08:00")
    base = _clean_title(title) or ("未命名-" + now.strftime("%Y%m%d-%H%M%S"))
    day_dir = os.path.join(DEPOSIT, module, date)
    if not _under(day_dir, DEPOSIT):
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
    rel = os.path.relpath(fpath, DEPOSIT).replace("\\", "/")
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
        with open(os.path.join(DEPOSIT, "_index.jsonl"), "a", encoding="utf-8") as _f:
            _f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception as e:
        sys.stderr.write("[kb] index append failed: %s\n" % e)
    return {"ok": True, "path": rel, "fileName": fname, "savedAt": ts}
