# -*- coding: utf-8 -*-
"""捕获收件箱服务：读帖当场捕获的「摘录 + 感悟」暂存工作集。

真源是仓库根 inbox.local.json（gitignore，可由 workbench.local.json 的 inbox.path 覆盖）。
为什么不写进 Obsidian vault：收件箱是**暂存工作集**、不是知识；且沉淀根可能是公开库，
状态流转（待处理/已蒸馏/已归档）也不该靠改 frontmatter。详见
docs/design/捕获收件箱-浏览器扩展-设计.md。

只用标准库（项目「零第三方依赖」）。写入走 tmp + os.replace 原子替换；
文件损坏则备份 .bak 后空启动，绝不让工作台起不来。

并发：服务器是 ThreadingHTTPServer，且前端补推/扩展可能并行提交，故所有
「读-改-写」必须在 _LOCK 内完成——否则两线程各自读到旧列表再覆写，会**静默丢条目**；
tmp 文件名也带 pid/线程 id，避免两个写者抢同一个 tmp 导致 os.replace 失败（表现为 400）。
"""
import json
import os
import shutil
import sys
import threading
import time
import uuid

from backend.core import config as wb_config

# 条目状态与类型枚举（与前端 js/features/inbox.js 保持一致）
STATUSES = ["待处理", "已蒸馏", "已归档"]
TYPES = ["clip", "idea"]
SOURCES = ["ext", "web"]

_LOCK = threading.RLock()   # 保护 inbox.local.json 的读-改-写（见模块 docstring「并发」）

EXCERPT_MAX = 5000      # 选中摘录上限，防超长选区
NOTE_MAX = 5000
DEDUP_WINDOW = 60       # 同 url+excerpt 在此秒数内视为重复提交
_PATCHABLE = ("status", "note", "tags")   # update 只允许改这三个字段


def path():
    """收件箱数据文件路径。"""
    return wb_config.inbox_path()


def _atomic_write(fp, obj):
    """tmp + os.replace 原子写：避免写一半断电/并发读到残文件。"""
    # tmp 名带 pid+线程 id：两个写者若共用一个 tmp，先 replace 的会把它移走，
    # 后者 os.replace 找不到源文件而抛错（对外表现为 400 写入失败）
    tmp = "%s.tmp.%d.%d" % (fp, os.getpid(), threading.get_ident())
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        os.replace(tmp, fp)
    except Exception:
        try:
            os.remove(tmp)          # 别把半截 tmp 留在盘上
        except Exception:
            pass
        raise


def _load():
    """读全量。文件不存在返回空；损坏则备份 .bak 后空启动。"""
    fp = path()
    if not fp or not os.path.isfile(fp):
        return []
    try:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        sys.stderr.write("[inbox] 数据文件损坏，备份后空启动: %s\n" % e)
        try:
            shutil.copyfile(fp, fp + ".bak")
        except Exception:
            pass
        return []


def _save(items):
    fp = path()
    if not fp:
        return False
    try:
        _atomic_write(fp, items)
        return True
    except Exception as e:
        sys.stderr.write("[inbox] 写入失败: %s\n" % e)
        return False


def _s(v, limit=500):
    """标量清洗：非字符串转字符串、去首尾空白、截断。"""
    if v is None:
        return ""
    return str(v).strip()[:limit]


def _tags(v):
    """标签规整成字符串列表（最多 12 个，各 ≤32 字）。"""
    if not v:
        return []
    if isinstance(v, str):
        v = v.replace("，", " ").replace(",", " ").split()
    if not isinstance(v, (list, tuple)):
        return []
    out = []
    for t in v:
        t = _s(t, 32)
        if t and t not in out:
            out.append(t)
    return out[:12]


def list_items():
    """列表，新→旧。"""
    items = _load()
    items.sort(key=lambda x: x.get("at") or 0, reverse=True)
    return items


def count():
    return len(_load())


def add(payload):
    """新增一条捕获。服务端补 id/at/status，做 60s 去重。

    payload: {type?, url?, title?, excerpt?, note?, tags?, platform?, source?}
    type 未给时按「有无 url」推断（有=clip 剪藏，无=idea 灵感）。
    """
    if not path():
        return {"ok": False, "error": "未配置收件箱数据文件路径"}
    if not isinstance(payload, dict):
        return {"ok": False, "error": "payload 非法"}

    url = _s(payload.get("url"), 2000)
    excerpt = _s(payload.get("excerpt"), EXCERPT_MAX)
    note = _s(payload.get("note"), NOTE_MAX)
    title = _s(payload.get("title"), 300)
    if not url and not excerpt and not note:
        return {"ok": False, "error": "空捕获（至少要有链接、摘录或想法之一）"}

    itype = payload.get("type")
    if itype not in TYPES:
        itype = "clip" if url else "idea"
    source = payload.get("source") if payload.get("source") in SOURCES else "web"

    # 整段读-改-写进锁：并发 add（前端 _flush 并行补推 / 扩展连点）否则会互相覆盖丢条目
    with _LOCK:
        items = _load()
        now = int(time.time() * 1000)
        # 去重：url+摘录+感悟 三者全同且在窗口内 —— 防手抖/重试造成重复条目。
        # 必须带上 note：否则两条不同的**纯想法**（url 与 excerpt 皆空）会被误判重复而静默丢弃。
        for it in items:
            same = (it.get("url") == url
                    and (it.get("excerpt") or "") == excerpt
                    and (it.get("note") or "") == note)
            if same and now - (it.get("at") or 0) < DEDUP_WINDOW * 1000:
                return {"ok": True, "deduped": True, "item": it, "count": len(items)}

        item = {
            "id": uuid.uuid4().hex[:12],
            "type": itype,
            "url": url,
            "title": title,
            "excerpt": excerpt,
            "note": note,
            "tags": _tags(payload.get("tags")),
            "platform": _s(payload.get("platform"), 32),
            "status": "待处理",
            "source": source,
            "at": now,
            "updatedAt": now,
        }
        items.insert(0, item)
        if not _save(items):
            return {"ok": False, "error": "写入失败"}
        return {"ok": True, "item": item, "count": len(items)}


def update(item_id, patch):
    """局部更新：只允许改 status / note / tags。"""
    item_id = _s(item_id, 64)
    if not item_id or not isinstance(patch, dict):
        return {"ok": False, "error": "参数非法"}
    with _LOCK:
        items = _load()
        for it in items:
            if it.get("id") != item_id:
                continue
            for k in _PATCHABLE:
                if k not in patch:
                    continue
                if k == "status":
                    v = _s(patch[k], 16)
                    if v not in STATUSES:
                        return {"ok": False, "error": "status 非法"}
                    it[k] = v
                elif k == "tags":
                    it[k] = _tags(patch[k])
                else:
                    it[k] = _s(patch[k], NOTE_MAX)
            it["updatedAt"] = int(time.time() * 1000)
            if not _save(items):
                return {"ok": False, "error": "写入失败"}
            return {"ok": True, "item": it}
        return {"ok": False, "error": "未找到该条目"}


def delete(item_id):
    item_id = _s(item_id, 64)
    if not item_id:
        return {"ok": False, "error": "缺少 id"}
    with _LOCK:
        items = _load()
        left = [x for x in items if x.get("id") != item_id]
        if len(left) == len(items):
            return {"ok": False, "error": "未找到该条目"}
        if not _save(left):
            return {"ok": False, "error": "写入失败"}
        return {"ok": True, "count": len(left)}
