# -*- coding: utf-8 -*-
"""抓取 Hacker News 热帖，生成 hacker_news.json（经 OpenCLI 取数层）。

数据源：`opencli hackernews top`（browser:false，走 HN 官方 Firebase API，免登录/免 key）
  OpenCLI 把网站封装成确定性 CLI：`opencli hackernews top --limit 20 -f json`
  输出行对象列：rank / id / title / score / author / comments / url

设计要点（与 fetch_daily_news.py 对齐 + OpenCLI 特有约束）：
  - OpenCLI 需 Node>=20，仅在**取数层**被调用，**不进 App 运行时**（守北极星）。
    调用命令经 wb_config.opencli_cmd() 取；未配置 / node 缺失 → fetch 抛异常。
  - 抓取失败时**不覆盖**已有 hacker_news.json，保留上一次成功结果；缺 OpenCLI 时该源
    静默沿用上一次（或空），**不影响 export_data 与其余资讯源**（优雅劣化）。
  - OpenCLI 退出码（sysexits）：0 成功 / 66 空结果 / 69 Bridge 未起 / 77 需登录。
    本源为 PUBLIC，正常不该出现 69/77；出现即当异常跳过。
"""
import os
import json
import subprocess
from datetime import datetime

from backend.core import config as wb_config
from backend.core.paths import HACKER_NEWS_JSON

OUT = HACKER_NEWS_JSON  # 钉在仓库根
SITE = "hackernews"
COMMAND = "top"
LIMIT = 20
CANONICAL = "https://news.ycombinator.com/"


def fetch():
    """经 OpenCLI 拿 HN 热帖行对象数组；未配置/失败抛异常（由 main 兜底跳过）。"""
    cmd = wb_config.opencli_cmd()
    if not cmd:
        raise RuntimeError(
            "未配置 OpenCLI（env WB_OPENCLI_CMD / workbench.local.json opencliCmd / "
            "PATH 上的 opencli 均缺失）——本机若未装 Node>=20 + OpenCLI，该源自动跳过")
    argv = [*cmd, SITE, COMMAND, "--limit", str(LIMIT), "-f", "json"]
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
        "source": "Hacker News (via OpenCLI)",
        "canonical": CANONICAL,
        "count": len(items),
        "items": items,
        "warnings": [],
    }


def main():
    try:
        data = build()
    except Exception as e:
        print("[WARN] Hacker News 抓取失败，保留上一次结果：%s" % e)
        if os.path.isfile(OUT):
            print("       已有 %s，未覆盖" % OUT)
        return 1
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("[OK] Hacker News %s · %d 条 -> %s"
          % (data["date"], data["count"], OUT))
    for i, it in enumerate(data["items"][:5], 1):
        print("   %d. %s" % (i, it["title"][:50]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
