# -*- coding: utf-8 -*-
"""抓取 GitHub Trending 今日热门仓库，生成 github_trending.json（经 OpenCLI 取数层）。

数据源：`opencli github-trending repos --since daily`（browser:false，抓 github.com/trending
  的 HTML，免登录/免 key；OpenCLI 侧有解析漂移守护，改版会抛错而非出脏数据）
  输出行对象列：rank / repo / description / language / stars / forks / starsSince / url

设计要点（与 fetch_hacker_news.py 同构）：
  - OpenCLI 需 Node>=20，仅在**取数层**被调用，**不进 App 运行时**（守北极星）。
    取数与退出码语义在 feeds.opencli_rows()；未配置 / node 缺失 → 抛异常。
  - 抓取失败时**不覆盖**已有 github_trending.json，保留上一次成功结果；缺 OpenCLI 时静默沿用，
    不影响 export_data 与其余资讯源（优雅劣化，见 feeds.run_fetcher）。
"""
from datetime import datetime

from backend.core.paths import GITHUB_TRENDING_JSON
from backend.pipeline.feeds import FEEDS, opencli_rows, run_fetcher

SPEC = FEEDS["githubTrending"]  # 键名/文案/空壳/预览等随源而变的事实，见 feeds.py
OUT = GITHUB_TRENDING_JSON  # 钉在仓库根
SITE = "github-trending"
COMMAND = "repos"
SINCE = "daily"
LIMIT = 20


def fetch():
    """经 OpenCLI 拿 GitHub Trending 行对象数组；未配置/失败抛异常（由 run_fetcher 兜底跳过）。"""
    return opencli_rows(SITE, COMMAND, "--since", SINCE, "--limit", str(LIMIT))


def build():
    """把 OpenCLI 行对象映射到本仓统一 item：{title, summary, url, source}。"""
    rows = fetch()
    items = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        repo = str(r.get("repo") or "").strip()
        if not repo:
            continue
        url = str(r.get("url") or "").strip()
        if not url:  # 兜底：github-trending 一般都有 url，缺则由 repo 拼
            url = "https://github.com/%s" % repo
        stars = r.get("stars")
        since = r.get("starsSince")
        lang = str(r.get("language") or "").strip()
        desc = str(r.get("description") or "").strip()
        bits = []
        if isinstance(stars, (int, float)):
            bits.append("★%s" % format(int(stars), ","))
        elif stars:
            bits.append("★%s" % stars)
        if since:
            bits.append("+%s today" % since)
        if lang:
            bits.append(lang)
        if desc:
            bits.append(desc)
        items.append({
            "title": repo,
            "summary": " · ".join(bits),
            "url": url,
            "source": "GitHub Trending",
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
