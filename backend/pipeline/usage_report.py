# -*- coding: utf-8 -*-
"""使用量报表：把「这工具到底有没有在被用」打成一张能贴进自评卡的表。

纯只读、只打印，**绝不自动写任何 docs 文件**——自动生成的复盘等于没有复盘，
人必须自己手写结论句（见 docs/guides/项目自评打分-指南.md §5）。

四个数据源交叉验证，刻意不只信埋点：
  usage.local.jsonl  人的手势（ADR 0015）
  inbox.local.json   捕获条目与消化状态
  <depositRoot>/_index.jsonl  真卡（按 savedAt 截区间，排除自测卡与幽灵卡）
  data.json.sync + local_refresh.log  同步是否还活着
**前端自报的数字可以靠「我点一下」刷出来，磁盘产物不能**——所以真卡/收件箱/
同步一律读磁盘真源，只有「复盘天数」「温故点开」才用埋点。

第五源 `git log` 回答的是另一个问题：**注意力花在哪了**。一人项目最稀缺的
资源不是工时是注意力，所以「成本管理」这一格量元工作占比，不做人天估算。
见 docs/guides/项目管理-操作指南.md。

用法：python -m backend.pipeline.usage_report [--since YYYY-MM-DD] [--days 30] [--no-mix]
"""
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta

from backend.core import config as wb_config
from backend.core.paths import ROOT      # 仓库根的单一真源，别再自己 dirname 数层数
from backend.clients import usage
COLS = [("app_use", "打开"), ("recall_open", "温故开"), ("recall_useful", "温故有用"),
        ("review_save", "复盘"), ("note_add", "速记"), ("todo_add", "代办"),
        ("distill_save", "蒸馏")]

# 元工作＝围着「项目本身」转的提交（文档/治理/搬运/换皮），对照 feat/fix 这类
# 围着「产品」转的。心法 §5 那条「连续几周动作全在工程层要警惕」的量化版。
META_TYPES = ("docs", "chore", "refactor", "style", "ci", "build", "test")
META_WARN_RATIO = 0.5
TYPE_RE = re.compile(r"^[a-z][a-z0-9-]{0,14}$")


def _load_json(p, default):
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _real_cards(since, module="蒸馏库"):
    """区间内新增的真卡：排除 MCP 自测卡，且文件必须还在（幽灵卡不算数）。

    默认只数「蒸馏库」——自评卡 #1 的「真卡流量」指的就是蒸馏卡，把产品拆解等
    其它沉淀混进来会把这个数刷高，正是指南 §9 点名的作弊方式。"""
    vault, deposit = wb_config.kb()
    p = os.path.join(deposit or "", "_index.jsonl")
    n, ghosts = 0, 0
    if not os.path.isfile(p):
        return 0, 0
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if "【MCP测试】" in (r.get("title") or ""):
                continue
            if module and r.get("module") != module:
                continue
            rel = r.get("relPath") or ""
            if not rel or not os.path.isfile(os.path.join(deposit, rel.replace("/", os.sep))):
                ghosts += 1
                continue
            if (r.get("savedAt") or "")[:10] >= since:
                n += 1
    return n, ghosts


def _sync_health(since):
    d = _load_json(os.path.join(ROOT, "data.json"), {})
    s = (d.get("sync") or {})
    last, hours = s.get("lastRun"), None
    if last:
        try:
            hours = (datetime.now() - datetime.strptime(last.replace(" ", "T"), "%Y-%m-%dT%H:%M:%S")).total_seconds() / 3600
        except Exception:
            pass
    runs = 0
    log = os.path.join(ROOT, "backend", "pipeline", "local_refresh.log")
    if os.path.isfile(log):
        with open(log, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                # 收尾行形如：[2026-09-20 15:03:44] ===== local refresh end (ok=True) =====
                if line.startswith("[") and "local refresh end (ok=True)" in line and line[1:11] >= since:
                    runs += 1
    return last, hours, runs


def _max_window(days_with, span=7):
    """任一 span 天窗口里「有该动作的天数」的最大值——自评卡 #4 的问法。"""
    if not days_with:
        return 0
    ds = sorted(datetime.strptime(x, "%Y-%m-%d") for x in days_with)
    best = 0
    for i, d0 in enumerate(ds):
        best = max(best, sum(1 for d in ds[i:] if (d - d0).days < span))
    return best


def classify_commits(subjects):
    """把 Conventional Commits 的标题行归到 type 上。识别不出的一律记「其它」。

    认得 `feat: x` / `feat(scope): x` / `chore(skills)!: x` 三种写法；没有冒号的
    （如最早那条 upstream 快照）不硬猜。

    type 允许字母开头 + 数字/连字符——`i18n` 这类真实用过的 type 不能因为带
    数字就被扫进「其它」（本仓 09-14 那两条就是这么丢的）。"""
    counts = defaultdict(int)
    for s in subjects:
        s = (s or "").strip()
        if not s:
            continue
        head = s.split(":", 1)[0] if ":" in s else ""
        t = re.split(r"[(!]", head, maxsplit=1)[0].strip().lower()
        counts[t if TYPE_RE.match(t) else "其它"] += 1
    return dict(counts)


def meta_ratio(counts):
    """元工作占比。区间内 0 条提交时返回 (0, 0, None)——不是 0%，是「没得算」。"""
    total = sum(counts.values())
    meta = sum(n for t, n in counts.items() if t in META_TYPES)
    return total, meta, (meta / total if total else None)


def _git_subjects(since):
    """区间内的提交标题。拿不到 git（非仓库/无 git/超时）就返回 None，不让报表挂掉。"""
    try:
        out = subprocess.run(["git", "-C", ROOT, "log", "--since=" + since, "--no-merges", "--pretty=%s"],
                             capture_output=True, text=True, timeout=10)
    except Exception:
        return None
    if out.returncode != 0:
        return None
    return out.stdout.splitlines()


def format_mix(counts, since):
    """只打印、只提示，**不判红**——判红会变成新的假绿动力（同宪章禁 `|| true`）。"""
    total, meta, ratio = meta_ratio(counts)
    lines = ["", "### 工作构成 · %s 起（注意力花在哪）" % since, ""]
    if not total:
        return lines + ["- 区间内没有提交。", ""]
    order = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    lines.append("- 共 **%d** 条提交：" % total + " · ".join("%s %d" % (t, n) for t, n in order))
    lines.append("- 元工作（%s）占比 **%d%%** %s" % (
        "/".join(META_TYPES[:4]), round(ratio * 100),
        "⚠ 过半——周五第 4 问要写一句为什么" if ratio > META_WARN_RATIO else "✓ 未过半"))
    lines.append("")
    return lines


def report(since, mix=True):
    evs = usage.read_events(since)
    per = defaultdict(lambda: defaultdict(int))
    for e in evs:
        per[e.get("day")][e.get("ev")] += 1

    lines = ["", "## 使用量 · %s 起" % since, "",
             "| 日期 | " + " | ".join(c[1] for c in COLS) + " |",
             "|---" * (len(COLS) + 1) + "|"]
    for day in sorted(per):
        row = per[day]
        lines.append("| %s | " % day + " | ".join(str(row.get(k, 0) or "·") for k, _ in COLS) + " |")
    if not per:
        lines.append("| （区间内没有任何手势） |" + " |" * len(COLS))

    # 有交互 = 当天有任何真实手势；report_run 是我自己跑报表，不算"在用工具"
    used_days = [d for d in per if any(k != "report_run" and v for k, v in per[d].items())]
    review_days = [d for d in per if per[d].get("review_save")]
    cards, ghosts = _real_cards(since)
    others, _ = _real_cards(since, module=None)
    inbox_items = _load_json(wb_config.inbox_path(), [])
    inbox_items = inbox_items if isinstance(inbox_items, list) else []
    distilled = sum(1 for i in inbox_items if i.get("status") == "已蒸馏")
    last, hours, runs = _sync_health(since)
    useful_cards = len({e.get("k") for e in evs if e.get("ev") == "recall_useful" and e.get("k")})

    lines += ["", "### 对着自评卡 §5 的八条", "",
              "- 有交互天数：**%d** 天（区间 %d 天）" % (len(used_days), (datetime.now() - datetime.strptime(since, "%Y-%m-%d")).days + 1),
              "- #1 真卡流量（区间内新增蒸馏卡）：**%d** 张 · 其它沉淀 %d 篇%s" % (
                  cards, max(others - cards, 0), ("（另有 %d 条幽灵账本行）" % ghosts) if ghosts else ""),
              "- #2 收件箱：**%d** 条，其中已蒸馏 **%d** 条" % (len(inbox_items), distilled),
              "- #3 同步：上次 %s%s · 区间内成功 **%d** 次" % (
                  last or "（无记录）", ("，距今 %.1f 小时" % hours) if hours is not None else "", runs),
              "- #4 复盘：任一 7 天窗口最多 **%d** 天有复盘（目标 ≥5）" % _max_window(review_days),
              "- #5 温故：标过「有用」的不同卡 **%d** 张（目标 ≥3）" % useful_cards,
              ""]

    if mix:
        subjects = _git_subjects(since)
        if subjects is None:
            lines += ["", "### 工作构成 · %s 起（注意力花在哪）" % since, "",
                      "- 读不到 git 历史，本段跳过。", ""]
        else:
            lines += format_mix(classify_commits(subjects), since)

    lines += ["> 结论句要人自己写：下一个功能是 X，因为摩擦 Y 出现 N 次且过了心法 §4 三门。", ""]
    return "\n".join(lines)


def main():
    since = None
    argv = sys.argv[1:]
    if "--since" in argv:
        since = argv[argv.index("--since") + 1]
    days = int(argv[argv.index("--days") + 1]) if "--days" in argv else 30
    since = since or (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    print(report(since, mix="--no-mix" not in argv))
    usage.track({"ev": "report_run", "cid": "cli"})   # 尺子自己也要被量
    return 0


if __name__ == "__main__":
    sys.exit(main())
