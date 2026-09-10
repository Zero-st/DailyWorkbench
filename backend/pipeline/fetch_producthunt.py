# -*- coding: utf-8 -*-
"""抓取 Product Hunt 每日精选新品（官方 Atom feed），生成 producthunt.json。

数据源：https://www.producthunt.com/feed  （公开 Atom，免登录/免 key）
  entry: title(产品名) / link[rel=alternate]@href(产品页) / content(一句话简介)

设计要点（路 A · 纯 stdlib RSS/Atom，不经 OpenCLI、不上 Node）：
  - 抓取失败时**不覆盖**已有 producthunt.json，保留上一次成功结果（优雅劣化）。
  - 解析用 wb_common.parse_feed（命名空间无关，RSS/Atom 通吃），与少数派源共用。
  - 统一 item：{title, summary, url, source}，与其余资讯源同构。
"""
import os
import json
from datetime import datetime

from backend.utils import common as wb_common
from backend.core.paths import PRODUCTHUNT_JSON

FEED = "https://www.producthunt.com/feed"
CANONICAL = "https://www.producthunt.com"
OUT = PRODUCTHUNT_JSON  # 钉在仓库根
LIMIT = 20


def build():
    """抓 Atom feed -> 映射到本仓统一 item；无有效条目抛异常（由 main 兜底跳过）。"""
    xml = wb_common.http_get_text(FEED)
    rows = wb_common.parse_feed(xml, LIMIT)
    items = []
    for r in rows:
        title = (r.get("title") or "").strip()
        if not title:
            continue
        items.append({
            "title": title,
            "summary": r.get("summary") or "",
            "url": r.get("url") or "",
            "source": "Product Hunt",
        })
    if not items:
        raise ValueError("解析后无有效条目")
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "fetchedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": "Product Hunt (Atom feed)",
        "canonical": CANONICAL,
        "count": len(items),
        "items": items,
        "warnings": [],
    }


def main():
    try:
        data = build()
    except Exception as e:
        print("[WARN] Product Hunt 抓取失败，保留上一次结果：%s" % e)
        if os.path.isfile(OUT):
            print("       已有 %s，未覆盖" % OUT)
        return 1
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("[OK] Product Hunt %s · %d 条 -> %s"
          % (data["date"], data["count"], OUT))
    for i, it in enumerate(data["items"][:5], 1):
        print("   %d. %s" % (i, it["title"][:50]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
