# -*- coding: utf-8 -*-
"""使用量埋点：只记「人的手势」，用来回答『这工具到底有没有在被用』。

为什么需要它：2026-09-17 的自评卡硬门·频率门不过（17 天仅 3 天有痕迹），而当时
量测靠 chrome-devtools + ldbdump 人工捞 localStorage，1~2 小时/次且要先固定用
哪个 profile——已经被证明量不动。见 docs/adr/0015-usage-metering-local-jsonl.md。

设计红线（每条都是为了让这份数据经得起自己追问）：
- **只记手势，不记页面存在**：页面加载、视图切换、30s 轮询、渲染次数一律不采。
  那是「开着标签页」不是「在用」，采了就是自评指南 §9 点名的 vanity metrics。
- **字段封闭**：EVENTS 白名单外的事件直接拒；行里只留 at/day/ev/cid/k 五个键，
  其余一律丢弃。**没有任何自由文本字段**——复盘正文、速记内容、URL 都不进。
- **day 由服务端盖戳**：不信前端时区（调试 Chrome 常年 LA 时区，会错一天）。
- **绝不进 data.json**：那是单向门契约，且与刚落地的 ADR 0013 冲突。独立文件。
- **优雅劣化**：前端 fetch 失败静默丢弃，绝不阻塞任何交互。

存储：仓库根 usage.local.jsonl（append-only，已 gitignore——deploy-pages 会把
整个仓库发布成公开 Pages，漏加就等于把使用日志公开）。
"""
import json
import os
import sys
import threading
from datetime import datetime

from backend.core import config as wb_config

# 事件白名单。改这里 = 改存储格式，属单向门，要回 ADR 0015 记一笔。
EVENTS = [
    "app_use",          # 当天第一个真实手势（服务端按 (cid,day) 去重）
    "review_save",      # 写了复盘
    "review_kbsave",    # 复盘存进知识库
    "recall_open",      # 点开温故卡
    "recall_useful",    # 温故卡标「有用」
    "recall_archive",   # 温故卡标「已内化」
    "todo_add",
    "note_add",
    "distill_save",     # 存了一张蒸馏卡
    "kb_open",          # 打开知识库里的一篇
    "progress_open",    # 手动切到「项目进度」视图（恢复上次标签不算）——它自己的放弃线指标，ADR 0016
    "report_run",       # 报表自己跑了一次——量测有没有被用，本身也要可测
]
_KEY_MAX = 300          # k 只用于 recall_*/kb_open 的 vaultPath
_LOCK = threading.RLock()


def path():
    return wb_config.usage_path()


def _today_seen(fp, cid, day, ev):
    """(cid, day, ev) 是否已记过——只给 app_use 用，避免一天几十条噪声。"""
    if not os.path.isfile(fp):
        return False
    try:
        with open(fp, "r", encoding="utf-8") as f:
            for line in f:
                if '"%s"' % ev not in line:
                    continue
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if r.get("ev") == ev and r.get("cid") == cid and r.get("day") == day:
                    return True
    except Exception:
        return False
    return False


def track(body):
    """记一条事件。body 只认 ev / cid / k 三个键，其余丢弃。"""
    body = body if isinstance(body, dict) else {}
    ev = str(body.get("ev") or "").strip()
    if ev not in EVENTS:
        return {"ok": False, "error": "unknown event"}
    cid = str(body.get("cid") or "").strip()[:32] or "anon"
    now = datetime.now()
    rec = {
        "at": now.strftime("%Y-%m-%dT%H:%M:%S"),
        "day": now.strftime("%Y-%m-%d"),     # 服务端盖戳，不信前端时区
        "ev": ev,
        "cid": cid,
    }
    k = body.get("k")
    if k and ev.startswith(("recall_", "kb_", "distill_")):
        rec["k"] = str(k)[:_KEY_MAX]

    fp = path()
    with _LOCK:      # ThreadingHTTPServer + 多标签页可能并发 append
        if ev == "app_use" and _today_seen(fp, cid, rec["day"], ev):
            return {"ok": True, "deduped": True}
        try:
            with open(fp, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        except Exception as e:
            sys.stderr.write("[usage] append failed: %s\n" % e)
            return {"ok": False, "error": "write failed"}
    return {"ok": True}


def read_events(since=None):
    """读全部事件（坏行跳过）。since='YYYY-MM-DD' 时只留该日及之后。"""
    out = []
    fp = path()
    if not os.path.isfile(fp):
        return out
    try:
        with open(fp, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if since and (r.get("day") or "") < since:
                    continue
                out.append(r)
    except Exception:
        return out
    return out
