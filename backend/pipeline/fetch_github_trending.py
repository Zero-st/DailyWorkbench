# -*- coding: utf-8 -*-
"""抓取 GitHub Trending 今日热门仓库，生成 github_trending.json（经 OpenCLI 取数层）。

数据源：`opencli github-trending repos --since daily`（browser:false，抓 github.com/trending
  的 HTML，免登录/免 key；OpenCLI 侧有解析漂移守护，改版会抛错而非出脏数据）
  输出行对象列：rank / repo / description / language / stars / forks / starsSince / url

设计要点（与 fetch_hacker_news.py 同构）：
  - OpenCLI 需 Node>=20，仅在**取数层**被调用，**不进 App 运行时**（守北极星）。
    命令经 wb_config.opencli_cmd() 取；未配置 / node 缺失 → fetch 抛异常。
  - 抓取失败时**不覆盖**已有 github_trending.json，保留上一次成功结果；缺 OpenCLI 时静默沿用，
    不影响 export_data 与其余资讯源（优雅劣化）。
  - OpenCLI 退出码（sysexits）：0 成功 / 66 空结果 / 其它异常跳过。
"""
import os
import json
import subprocess
from datetime import datetime

from backend.core import config as wb_config
from backend.core.paths import GITHUB_TRENDING_JSON

OUT = GITHUB_TRENDING_JSON  # 钉在仓库根
SITE = "github-trending"
COMMAND = "repos"
SINCE = "daily"
LIMIT = 20
CANONICAL = "https://github.com/trending"


def fetch():
    """经 OpenCLI 拿 GitHub Trending 行对象数组；未配置/失败抛异常（由 main 兜底跳过）。"""
    cmd = wb_config.opencli_cmd()
    if not cmd:
        raise RuntimeError(
            "未配置 OpenCLI（env WB_OPENCLI_CMD / workbench.local.json opencliCmd / "
            "PATH 上的 opencli 均缺失）——本机若未装 Node>=20 + OpenCLI，该源自动跳过")
    argv = [*cmd, SITE, COMMAND, "--since", SINCE, "--limit", str(LIMIT), "-f", "json"]
    try:
        p = subprocess.run(
            argv, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=60,
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
        "source": "GitHub Trending (via OpenCLI)",
        "canonical": CANONICAL,
        "count": len(items),
        "items": items,
        "warnings": [],
    }


def main():
    try:
        data = build()
    except Exception as e:
        print("[WARN] GitHub Trending 抓取失败，保留上一次结果：%s" % e)
        if os.path.isfile(OUT):
            print("       已有 %s，未覆盖" % OUT)
        return 1
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("[OK] GitHub Trending %s · %d 条 -> %s"
          % (data["date"], data["count"], OUT))
    for i, it in enumerate(data["items"][:5], 1):
        print("   %d. %s" % (i, it["title"][:50]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
