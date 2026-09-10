# -*- coding: utf-8 -*-
"""抓取少数派（sspai.com）最新文章（官方 RSS 2.0 feed），生成 sspai.json。

数据源：https://sspai.com/feed  （公开 RSS 2.0，免登录/免 key）
  item: title(标题) / link(文章页) / description(摘要，含"查看全文"导流已剥)

设计要点（路 A · 纯 stdlib RSS/Atom，不经 OpenCLI、不上 Node）：
  - 抓取失败时**不覆盖**已有 sspai.json，保留上一次成功结果（优雅劣化）。
  - 解析用 wb_common.parse_feed（命名空间无关，RSS/Atom 通吃），与 Product Hunt 源共用。
  - 选它做「练产品感」的中文源：少数派是中文圈最好的效率工具/产品品味社区。
"""
import os
import json
from datetime import datetime

from backend.utils import common as wb_common
from backend.core.paths import SSPAI_JSON

FEED = "https://sspai.com/feed"
CANONICAL = "https://sspai.com"
OUT = SSPAI_JSON  # 钉在仓库根
LIMIT = 20


def build():
    """抓 RSS feed -> 映射到本仓统一 item；无有效条目抛异常（由 main 兜底跳过）。"""
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
            "source": "少数派",
        })
    if not items:
        raise ValueError("解析后无有效条目")
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "fetchedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": "少数派 (sspai.com RSS)",
        "canonical": CANONICAL,
        "count": len(items),
        "items": items,
        "warnings": [],
    }


def main():
    try:
        data = build()
    except Exception as e:
        print("[WARN] 少数派抓取失败，保留上一次结果：%s" % e)
        if os.path.isfile(OUT):
            print("       已有 %s，未覆盖" % OUT)
        return 1
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("[OK] 少数派 %s · %d 条 -> %s"
          % (data["date"], data["count"], OUT))
    for i, it in enumerate(data["items"][:5], 1):
        print("   %d. %s" % (i, it["title"][:40]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
