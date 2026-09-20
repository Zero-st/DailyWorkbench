# -*- coding: utf-8 -*-
"""抓取 Hacker News 热帖，生成 hacker_news.json（经 OpenCLI 取数层）。

数据源：`opencli hackernews top`（browser:false，走 HN 官方 Firebase API，免登录/免 key）
  OpenCLI 把网站封装成确定性 CLI：`opencli hackernews top --limit 20 -f json`
  输出行对象列：rank / id / title / score / author / comments / url

设计要点（与 fetch_daily_news.py 对齐 + OpenCLI 特有约束）：
  - OpenCLI 需 Node>=20，仅在**取数层**被调用，**不进 App 运行时**（守北极星）。
    取数与退出码语义在 feeds.opencli_rows()；未配置 / node 缺失 → 抛异常。
  - 抓取失败时**不覆盖**已有 hacker_news.json，保留上一次成功结果；缺 OpenCLI 时该源
    静默沿用上一次（或空），**不影响 export_data 与其余资讯源**（优雅劣化，见 feeds.run_fetcher）。
  - 本源为 PUBLIC，正常不该出现 69（Bridge 未起）/ 77（需登录）；出现即当异常跳过。
"""
from datetime import datetime

from backend.core.paths import HACKER_NEWS_JSON
from backend.pipeline.feeds import FEEDS, opencli_rows, run_fetcher

SPEC = FEEDS["hackerNews"]  # 键名/文案/空壳/预览等随源而变的事实，见 feeds.py
OUT = HACKER_NEWS_JSON  # 钉在仓库根
SITE = "hackernews"
COMMAND = "top"
LIMIT = 20


def fetch():
    """经 OpenCLI 拿 HN 热帖行对象数组；未配置/失败抛异常（由 run_fetcher 兜底跳过）。"""
    return opencli_rows(SITE, COMMAND, "--limit", str(LIMIT))


def build():
    """把 OpenCLI 行对象映射到本仓统一 item：{title, summary, url, source}。"""
    rows = fetch()
    items = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        title = str(r.get("title") or "").strip()
        if not title:
            continue
        hid = r.get("id")
        url = str(r.get("url") or "").strip()
        if not url and hid is not None:  # Ask/Show HN 等无外链 -> 回退 HN 讨论页
            url = "https://news.ycombinator.com/item?id=%s" % hid
        score = r.get("score")
        author = str(r.get("author") or "").strip()
        comments = r.get("comments")
        bits = []
        if score is not None:
            bits.append("▲%s" % score)
        if author:
            bits.append(author)
        if comments is not None:
            bits.append("%s 评论" % comments)
        items.append({
            "title": title,
            "summary": " · ".join(bits),
            "url": url,
            "source": "Hacker News",
        })
    if not items:
        raise ValueError("映射后无有效条目")
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "fetchedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": SPEC.source,
        "canonical": SPEC.canonical,
        "count": len(items),
        "items": items,
        "warnings": [],
    }


def main():
    return run_fetcher(SPEC, build, OUT)


if __name__ == "__main__":
    raise SystemExit(main())
