# -*- coding: utf-8 -*-
"""资讯源（Feed）的单一真源：一张 FEEDS 表 + 四个共用骨架函数。

术语（见仓库根 CONTEXT.md）：
  - **资讯源（Feed）**：定期抓取、按日份累积历史的内容来源（AI 日报 / 每日60秒 / HN / …）。
  - **日份（day）**：history 里的一条，形如 {date, fetchedAt, count, items|sections, …}。

此前这个概念在两层各被抄了七遍：`export_data.py` 七个 `get_<源>()`（213 行里约 190 行是同一条
「合并日份、留 14 天」的重复），七个 `fetch_<源>.py` 的 `main()`（同一段 try/except/写盘/打印）。
本模块把**不变的骨架**收进函数：读源 → 空壳兜底 → upsert 当天日份 → 倒序留 14 天；抓取失败不
覆盖旧文件、成功原子写。**随源变的部分**留在两处：FEEDS 表的字段（键名、文案、空壳默认值、
预览方式）与各 `fetch_<源>.py` 的 `build()`（怎么取数、怎么映射成统一 item）。

加一个新资讯源 = 写一个 `build()` + 在 FEEDS 加一行 + 在 `backend/core/paths.py` 加一个路径常量。

**为什么写盘只留一条通道**：此前七个 fetcher 各自裸 `json.dump`，而 `enrich.py` 用
`write_json_atomic` 回写同一批文件——同一文件两条写通道（一原子一非原子），读者可能读到写了
一半的 json。`run_fetcher` 统一走原子写，这条 bug 面就此消失。
"""
import json
import os
import subprocess
from dataclasses import dataclass
from typing import Callable, Tuple

from backend.core import config as wb_config
from backend.utils import common as wb_common

HISTORY_DAYS = 14  # history 保留多少个日份


def items_preview(width=50, tip=False):
    """返回一个「打印前 5 条标题」的预览函数；tip=True 额外打印「一言」（每日60秒专用）。"""
    def _preview(data):
        for i, it in enumerate(data["items"][:5], 1):
            print("   %d. %s" % (i, it["title"][:width]))
        if tip and data["tip"]:
            print("   一言：%s" % data["tip"][:40])
    return _preview


def sections_preview(data):
    """按节打印（分节结构专用，如 AI 日报）。"""
    for s in data["sections"]:
        print("   - %s (%d)" % (s["label"], len(s["items"])))


@dataclass(frozen=True)
class FeedSpec:
    """一个资讯源随源而变的那些事实。骨架行为在本模块的函数里，不在这里。"""

    key: str  # data.json 里的键，也是 FEEDS 的索引
    label: str  # 中文名，用于控制台 [OK]/[WARN] 文案
    canonical: str  # 源站链接（fetcher 与空壳共用，避免两处各写一遍）
    path_attr: str  # backend/core/paths.py 里对应的路径常量名
    source: str = ""  # 来源串；"" 表示该源的空壳与日份都没有这个键（AI 日报即如此）
    kind: str = "items"  # items | sections（AI 日报按节分组）
    hist_extra: Tuple[str, ...] = ()  # 除骨架外还要透传进日份的键（每日60秒的 tip）
    shell_extra: Tuple[str, ...] = ()  # 空壳独有的额外空串键（每日60秒的 tip/cover）
    preview: Callable = None  # 成功后的控制台预览；None = items_preview(50)

    def shell(self):
        """源文件缺失/损坏时的空壳——键与键序和此前七处手写版逐字一致。"""
        d = {"date": "", "fetchedAt": "", "count": 0, self.kind: []}
        if self.source:
            d["source"] = self.source
        d["canonical"] = self.canonical
        for k in self.shell_extra:
            d[k] = ""
        return d

    def day(self, d):
        """从源文件内容取出一个日份（history 里的一条）。"""
        out = {"date": d.get("date"), "fetchedAt": d.get("fetchedAt"),
               "count": d.get("count"), self.kind: d.get(self.kind)}
        for k in self.hist_extra:
            out[k] = d.get(k, "")
        if self.source:
            out["source"] = d.get("source", "")
        out["canonical"] = d.get("canonical", "")
        return out

    def cjk_label(self):
        """英文名与中文之间补一个空格，中文名不补（保持既有文案逐字不变）。"""
        return self.label + " " if self.label[-1].isascii() else self.label


FEEDS = {s.key: s for s in (
    FeedSpec(key="aiDaily", label="AI 日报", path_attr="AI_DAILY_JSON",
             canonical="https://aihot.virxact.com/daily",
             kind="sections", preview=sections_preview),
    FeedSpec(key="dailyNews", label="每日新闻", path_attr="DAILY_NEWS_JSON",
             canonical="https://github.com/vikiboss/60s",
             source="每日60秒 (vikiboss/60s)",
             hist_extra=("tip",), shell_extra=("tip", "cover"),
             preview=items_preview(40, tip=True)),
    FeedSpec(key="hackerNews", label="Hacker News", path_attr="HACKER_NEWS_JSON",
             canonical="https://news.ycombinator.com/",
             source="Hacker News (via OpenCLI)"),
    FeedSpec(key="githubTrending", label="GitHub Trending", path_attr="GITHUB_TRENDING_JSON",
             canonical="https://github.com/trending",
             source="GitHub Trending (via OpenCLI)"),
    FeedSpec(key="productHunt", label="Product Hunt", path_attr="PRODUCTHUNT_JSON",
             canonical="https://www.producthunt.com",
             source="Product Hunt (Atom feed)"),
    FeedSpec(key="sspai", label="少数派", path_attr="SSPAI_JSON",
             canonical="https://sspai.com",
             source="少数派 (sspai.com RSS)", preview=items_preview(40)),
    FeedSpec(key="x", label="X/推特", path_attr="X_JSON",
             canonical="https://x.com/",
             source="X (via grok-cli)"),
)}


def merge_history(src_path, data_json, spec):
    """读源文件 → 合并日份（upsert 当天、倒序、留 HISTORY_DAYS 天）→ 返回该源在 data.json 里的片段。

    history 随 data.json 经 sync.py 用 GitHub API 推送天然持久化（无需额外文件/本地 git），
    所以每次 export 都要从「上一次生成的 data.json」把历史读回来。
    源文件缺失/损坏 → 空壳，不抛异常、不影响其余资讯源（优雅劣化）。
    """
    try:
        d = json.load(open(src_path, encoding="utf-8"))
    except Exception:
        d = spec.shell()
    hist = []
    if os.path.isfile(data_json):
        try:
            hist = (json.load(open(data_json, encoding="utf-8")).get(spec.key) or {}).get("history", [])
        except Exception:
            hist = []
    if d.get("date"):
        hist = [h for h in hist if h.get("date") != d["date"]]
        hist.append(spec.day(d))
        hist.sort(key=lambda x: x.get("date", ""), reverse=True)
        hist = hist[:HISTORY_DAYS]
    d["history"] = hist
    return d


def run_fetcher(spec, build, out):
    """跑一个资讯源的抓取：失败不覆盖旧文件（返回 1），成功原子写（返回 0）。

    失败即优雅劣化——该源沿用上一次结果，export_data 与其余资讯源不受影响。
    """
    try:
        data = build()
    except Exception as e:
        print("[WARN] %s抓取失败，保留上一次结果：%s" % (spec.cjk_label(), e))
        if os.path.isfile(out):
            print("       已有 %s，未覆盖" % out)
        return 1
    wb_common.write_json_atomic(out, data)
    if spec.kind == "sections":
        print("[OK] %s %s · %d 条 · %d 节 -> %s"
              % (spec.label, data["date"], data["count"], len(data["sections"]), out))
    else:
        print("[OK] %s %s · %d 条 -> %s" % (spec.label, data["date"], data["count"], out))
    (spec.preview or items_preview())(data)
    return 0


def opencli_rows(site, command, *args, timeout=60):
    """经 OpenCLI 取一个站点的行对象数组；未配置/失败抛异常（由 run_fetcher 兜底跳过）。

    OpenCLI 需 Node>=20，仅在**取数层**被调用、不进 App 运行时（守北极星，见 ADR 0007）。
    退出码（sysexits）：0 成功 / 66 空结果 / 69 Bridge 未起 / 77 需登录；非 0 一律当异常。
    """
    cmd = wb_config.opencli_cmd()
    if not cmd:
        raise RuntimeError(
            "未配置 OpenCLI（env WB_OPENCLI_CMD / workbench.local.json opencliCmd / "
            "PATH 上的 opencli 均缺失）——本机若未装 Node>=20 + OpenCLI，该源自动跳过")
    argv = [*cmd, site, command, *args, "-f", "json"]
    try:
        p = subprocess.run(
            argv, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except Exception as e:
        raise RuntimeError("调用 OpenCLI 失败：%s" % e)
    if p.returncode == 66:
        raise ValueError("OpenCLI 返回空结果（exit 66）")
    if p.returncode != 0:
        tail = ((p.stderr or "").strip().splitlines() or [""])[-1]
        raise RuntimeError("OpenCLI 退出码 %d：%s" % (p.returncode, tail))
    try:
        rows = json.loads(p.stdout)
    except Exception as e:
        raise ValueError("OpenCLI 输出非 JSON：%s" % e)
    if not isinstance(rows, list) or not rows:
        raise ValueError("OpenCLI 输出不是非空数组")
    return rows
