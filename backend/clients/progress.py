# -*- coding: utf-8 -*-
"""项目进度：把散在 markdown 里的计划与完成度解析成数据，喂给工作台进度视图。

为什么读 markdown 而不是新建一份 JSON：本仓已经证明**手工维护的第二份数据必然
漂移**——`docs/reference/devhtml/路线图全景与决策看板.html` 数据 100% 硬编码，
14 天未动，三条 Next/Later 里两条已与现状相反；`项目总览` §1.1 至今仍写着早已
删除的视图「代码全保留」。所以真源只有一份：人写的那几张 markdown 表。
**页面上不出现任何手打数字。** 见 docs/adr/0016-in-app-progress-view.md。

读四处（全部只读，零写入）：
  .claude/plan/作战板-<期>.md   §⓪ 两层计划表 · §② 出口门禁勾选框 · §④ 风险 · §⑤ 偏离
  docs/requirements/需求台账.md  §4 汇总表 → 需求完成度
  <作战板头部「周表：」链接指向的复盘文件>  周表的「门 / 结果」列
  （使用量指标不在这里算——那在 backend/pipeline/usage_report.metrics()，
    CLI 报表与本视图吃同一份，两处各算一遍就会分叉。）

写侧（2026-09-21 起）**只开两处**：§⑤ 偏离记录追加、§④ 风险状态改一格。
这两处没有 DoD 约束，纯粹是"摩擦高就不会被记"；而 §②③ 的勾选**刻意不开**——
指南 §3 规定勾 `[x]` 前要过 DoD 四款，一键勾选会把它架空，而"计划宣称完成、
无人逐条对过"正是这套机制要治的病。§⓪①（基线）期中不该改，更不给入口。
写法一律**外科手术式改行**：只动目标行，绝不重新生成文件（重生成会毁掉
人写的注释与散文）。并发靠内容哈希前置条件挡（你在编辑器里同时改过就拒绝）。

**表头是契约**：下面这些 H_* / 列名常量若与 markdown 对不上，对应段返回 None
并附 note，**绝不猜、绝不静默填 0**——静默填 0 会让页面说谎，而页面说谎正是
本仓砍掉上一批遥测视图的原因（ADR 0013）。
"""
import hashlib
import os
import re
import threading
from datetime import date, datetime

from backend.core import config as wb_config

# ---- 表头契约（改这些 = 改解析契约，要同步改作战板模板） ----
H_PLAN = "## ⓪ 计划总表"
H_PHASE = "### 层一 · 项目阶段"
H_WEEK = "### 层二 · 当期四周"
H_GATE = "## ② 出口门禁"
H_TASK = "## ③ 本周任务"
H_RISK = "## ④ 风险与假设登记册"
H_DEVIATION = "## ⑤ 偏离记录"

# 头部两条自描述信息：让**板子自己说清**对表日与周表在哪，代码里不写死。
# 写死过一次（deadline="2026-10-17" + 周表文件名），换期即烂——见 ADR 0016。
RE_DEADLINE = re.compile(r"对表日[：:]\s*\**(\d{4}-\d{2}-\d{2})")
RE_WEEKLY = re.compile(r"周表[：:]\s*\[[^\]]*\]\(([^)]+)\)")

_CHECK = re.compile(r"^\s*-\s*\[([ x~\-])\]\s*(.*)$")
# 只在**未转义**的竖线处切分。写侧把用户文本里的 `|` 转成 `\|`（否则整张表多出
# 一列、后续解析全错），读侧必须认这个转义，否则往返不闭环——首版就栽在这。
_CELLS = re.compile(r"(?<!\\)\|")
_STATUS_WORD = {"✅": "ok", "🔧": "doing", "🚧": "todo", "⏸": "wait", "✂": "cut",
                "⏳": "wait", "🔴": "bad", "🟡": "warn", "🟢": "ok", "⚪": "wait", "🆕": "new"}


def _read(p):
    if not p or not os.path.isfile(p):
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def _section(md, header, stop=("\n## ",)):
    """取 header 到下一个同级标题之间的片段。找不到 header 返回 None（不返回空串）。"""
    if not md or header not in md:
        return None
    seg = md.split(header, 1)[1]
    cut = len(seg)
    for s in stop:
        i = seg.find(s)
        if i != -1:
            cut = min(cut, i)
    return seg[:cut]


def _tables(block):
    """把片段里的**所有** markdown 表切出来 → [(表头, 行列表), ...]。

    刻意不只取第一张：一个小节里可能有多张表（周五仪式那节就是四问表在前、
    周表在后），按位置猜会取错——这正是首版的 bug。
    """
    out, head, rows = [], None, []
    for line in (block or "").splitlines():
        line = line.strip()
        if not line.startswith("|"):
            if head is not None:
                out.append((head, rows))
                head, rows = None, []
            continue
        cells = [c.strip().replace("\\|", "|") for c in _CELLS.split(line.strip().strip("|"))]
        if set("".join(cells)) <= set("-: "):
            continue           # 分隔行
        if head is None:
            head = cells
        else:
            rows.append(cells)
    if head is not None:
        out.append((head, rows))
    return out


def _table(block, want=None):
    """取表。给了 want（期望前几列列名）就按列名找那一张，否则取第一张。"""
    ts = _tables(block)
    if not ts:
        return None, []
    if want:
        for head, rows in ts:
            if head[:len(want)] == list(want):
                return head, rows
        return None, []
    return ts[0]


def _status_of(cell):
    for sym, word in _STATUS_WORD.items():
        if sym in (cell or ""):
            return word
    return None


def _rows_as_dicts(block, expect_cols, status_col="状态"):
    """按期望列名取表；列名对不上返回 (None, note)——**不猜、不静默填 0**。

    状态一律**按列名**取，不按位置——阶段表的「状态」不是最后一列，
    首版按 r[-1] 取导致四行状态全是 None。
    """
    head, rows = _table(block, want=expect_cols)
    if not head:
        ts = _tables(block)
        got = [t[0] for t in ts]
        return None, ("未找到表头为 %s 的表（实得 %s）" % (list(expect_cols), got or "无表"))
    out = []
    for r in rows:
        d = dict(zip(head, r + [""] * (len(head) - len(r))))
        d["_status"] = _status_of(d.get(status_col, ""))
        out.append(d)
    return out, None


def _checkbox_counts(block):
    """§② 勾选框四态计数 + 逐条明细。"""
    if not block:
        return None
    items, c = [], {"x": 0, "~": 0, " ": 0, "-": 0}
    for line in block.splitlines():
        m = _CHECK.match(line)
        if not m:
            continue
        mark, text = m.group(1), m.group(2)
        c[mark] = c.get(mark, 0) + 1
        # 条目正文取到第一个「——」或「—」之前，作为短标题
        title = re.split(r"\s+[—－]{1,2}\s+", re.sub(r"\*\*", "", text), maxsplit=1)[0]
        items.append({"mark": mark, "title": title.strip()[:120]})
    total = sum(c.values())
    if not total:
        return None
    return {"done": c["x"], "doing": c["~"], "open": c[" "], "dropped": c["-"],
            "total": total, "pct": round(c["x"] * 100.0 / total) if total else 0,
            "items": items}


def parse_deadline(md):
    """从作战板头部读对表日（`对表日：**2026-10-17**`）。读不到返回 None。"""
    m = RE_DEADLINE.search(md or "")
    return m.group(1) if m else None


def parse_weekly_link(md, board_path):
    """从作战板头部读周表链接（`周表：[xxx](相对路径)`），解析成绝对路径。"""
    m = RE_WEEKLY.search(md or "")
    if not m:
        return None
    rel = m.group(1).strip()
    base = os.path.dirname(os.path.abspath(board_path or ""))
    return os.path.normpath(os.path.join(base, rel))


def parse_board(path=None):
    """作战板 → 计划两层 / 门禁 / 本周任务 / 风险 / 偏离。任何一段缺失都只影响那一段。"""
    path = path or wb_config.board_path()
    md = _read(path)
    if md is None:
        return {"ok": False, "note": "作战板读不到（%s）" % (path or "未配置")}

    plan = _section(md, H_PLAN)
    phases, p_note = _rows_as_dicts(_section(plan or "", H_PHASE, stop=("\n### ",)),
                                    ["阶段", "内容", "门性", "状态", "完成日 / 依赖"])
    weeks, w_note = _rows_as_dicts(_section(plan or "", H_WEEK, stop=("\n### ",)),
                                   ["周", "区间", "计划内容", "周门", "状态"])
    gate = _checkbox_counts(_section(md, H_GATE))
    task = _checkbox_counts(_section(md, H_TASK))
    risks, _ = _rows_as_dicts(_section(md, H_RISK), ["#", "风险 / 假设", "触发信号", "应对", "状态"])
    dev_head, dev_rows = _table(_section(md, H_DEVIATION))

    title = (md.splitlines() or [""])[0].lstrip("# ").strip()
    return {
        "ok": True,
        "file": os.path.basename(path),
        "title": title,
        "deadline": parse_deadline(md),
        "weeklyPath": parse_weekly_link(md, path),
        "phases": phases, "phasesNote": p_note,
        "weeks": weeks, "weeksNote": w_note,
        "gate": gate, "task": task,
        "risks": risks or [],
        "deviations": len(dev_rows),
        "deviationRows": [r[:2] for r in dev_rows][-5:],
    }


def parse_ledger(path=None):
    """需求台账 §4 汇总表 → 需求完成度 = ✅ / (合计 − ✂)。"""
    path = path or os.path.join(wb_config.ROOT, "docs", "requirements", "需求台账.md")
    md = _read(path)
    if md is None:
        return {"ok": False, "note": "需求台账读不到"}
    block = _section(md, "## 4 · 一眼看盘")
    head, rows = _table(block, want=["状态", "条数"])
    if not head:
        return {"ok": False, "note": "台账 §4 表头已变"}
    buckets, total = {}, 0
    for r in rows:
        label = re.sub(r"\*", "", r[0]).strip()
        try:
            n = int(re.sub(r"\D", "", r[1]) or 0)
        except Exception:
            continue
        if label.startswith("合计"):
            total = n
        else:
            buckets[label] = n
    done = next((v for k, v in buckets.items() if k.startswith("✅")), 0)
    cut = next((v for k, v in buckets.items() if k.startswith("✂")), 0)
    denom = max(total - cut, 0)
    return {"ok": True, "buckets": buckets, "total": total, "done": done, "cut": cut,
            "denom": denom, "pct": round(done * 100.0 / denom) if denom else 0}


def parse_weekly(path=None):
    """冲刺复盘的周表 → 每周的门与结果；「结果」空 = 尚未判定。"""
    md = _read(path)
    if md is None:
        return {"ok": False, "note": "周表读不到（作战板头部的「周表：」链接缺失或指错：%s）" % (path or "未声明")}
    head, rows = _table(_section(md, "## 2 · 周五 15 分钟仪式"), want=["周", "区间"])
    if not head:
        return {"ok": False, "note": "周表表头已变"}
    weeks = [{"week": r[0], "span": r[1], "gate": r[2] if len(r) > 2 else "",
              "result": r[3] if len(r) > 3 else ""} for r in rows]
    judged = sum(1 for w in weeks if w["result"].strip())
    passed = sum(1 for w in weeks if "过" in w["result"] and "不过" not in w["result"])
    return {"ok": True, "weeks": weeks, "judged": judged, "passed": passed}


def deadline_days(target, today=None):
    """距对表日还有几天。已过则为负；target 为空或非日期返回 None。"""
    try:
        t = datetime.strptime(target, "%Y-%m-%d").date()
    except Exception:
        return None
    return (t - (today or date.today())).days


def snapshot(fallback_deadline=None):
    """一次取齐（不含使用量指标——那由 usage_report.metrics 提供，两处不重算）。

    **对表日与周表路径都从当期作战板头部读**，代码里不留期号。换期＝新建一张板，
    一行代码都不用改（换期清单见操作指南 §4）。板子没写就退回 fallback，并把
    `source` 标成 "fallback" —— 页面据此说明「这个日期是兜底的」，不假装准确。
    """
    board = parse_board()
    dl = board.get("deadline") if board.get("ok") else None
    src = "board" if dl else ("fallback" if fallback_deadline else "none")
    dl = dl or fallback_deadline
    return {
        "board": board,
        "ledger": parse_ledger(),
        "weekly": parse_weekly(board.get("weeklyPath") if board.get("ok") else None),
        "deadline": {"date": dl, "daysLeft": deadline_days(dl) if dl else None, "source": src},
    }


# ======================== 写侧（只开 §⑤ 偏离 / §④ 风险） ========================

_WLOCK = threading.RLock()
RISK_STATUS = ["🔴", "🟡", "🟢", "⚪", "🆕"]   # 状态白名单，不在表内一律拒
_CELL_MAX = 200


def board_hash(path=None):
    """当期作战板内容哈希。页面读取时拿走，写回时带上——**中途被编辑器改过就拒绝**。"""
    md = _read(path or wb_config.board_path())
    if md is None:
        return None
    return hashlib.sha256(md.encode("utf-8")).hexdigest()[:16]


def _cell(text):
    """把用户文本压成能安全放进 markdown 表格单元的一行。

    `|` 不转义会直接撑坏整张表（多出一列，后续解析全错）；换行同理。
    """
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    return t.replace("|", "\\|")[:_CELL_MAX]


def _atomic_write(fp, text):
    """tmp + os.replace 原子写，照 clients/inbox.py:44 的范式（含 pid/线程名防撞）。"""
    tmp = "%s.tmp.%d.%d" % (fp, os.getpid(), threading.get_ident())
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, fp)
    except Exception:
        try:
            os.remove(tmp)
        except Exception:
            pass
        raise


def _guarded_rewrite(expect_hash, mutate):
    """读 → 校验哈希 → mutate(md) → 原子写。mutate 返回 None 表示"没改动"。"""
    fp = wb_config.board_path()
    if not fp:
        return {"ok": False, "error": "no board"}
    with _WLOCK:
        md = _read(fp)
        if md is None:
            return {"ok": False, "error": "board unreadable"}
        cur = hashlib.sha256(md.encode("utf-8")).hexdigest()[:16]
        if expect_hash and expect_hash != cur:
            # 页面加载后文件被改过（多半是你在编辑器里动了）——宁可拒绝也不覆盖
            return {"ok": False, "error": "stale", "hash": cur}
        new = mutate(md)
        if new is None:
            return {"ok": False, "error": "target not found"}
        if new == md:
            return {"ok": True, "changed": False, "hash": cur}
        _atomic_write(fp, new)
        return {"ok": True, "changed": True,
                "hash": hashlib.sha256(new.encode("utf-8")).hexdigest()[:16]}


def add_deviation(what, why="", expect_hash=None, today=None):
    """§⑤ 偏离记录追加一行。日期由**服务端**盖戳（不信前端时区，同 usage.py）。"""
    what = _cell(what)
    if not what:
        return {"ok": False, "error": "empty"}
    day = (today or date.today()).strftime("%Y-%m-%d")
    row = "| %s | %s | %s |" % (day, what, _cell(why) or "—")

    def mutate(md):
        if H_DEVIATION not in md:
            return None
        head, sep, tail = md.partition(H_DEVIATION)
        lines = tail.split("\n")
        last = None
        for i, ln in enumerate(lines):
            if ln.strip().startswith("|"):
                last = i
            elif last is not None and ln.strip() == "" and i > last:
                break
            elif ln.startswith("## "):
                break
        if last is None:
            return None
        lines.insert(last + 1, row)
        return head + sep + "\n".join(lines)

    return _guarded_rewrite(expect_hash, mutate)


def set_risk_status(risk_id, status, expect_hash=None):
    """§④ 风险登记册：把第 risk_id 行的「状态」格改成 status（白名单内）。"""
    status = (status or "").strip()
    if status not in RISK_STATUS:
        return {"ok": False, "error": "bad status"}
    rid = str(risk_id).strip()

    def mutate(md):
        if H_RISK not in md:
            return None
        head, sep, tail = md.partition(H_RISK)
        lines, hit = tail.split("\n"), False
        for i, ln in enumerate(lines):
            if ln.startswith("## "):
                break
            if not ln.strip().startswith("|"):
                continue
            cells = _CELLS.split(ln.strip().strip("|"))
            if len(cells) < 5 or cells[0].strip() != rid:
                continue
            cells[-1] = " %s " % status
            lines[i] = "|" + "|".join(cells) + "|"
            hit = True
            break
        return head + sep + "\n".join(lines) if hit else None

    return _guarded_rewrite(expect_hash, mutate)
