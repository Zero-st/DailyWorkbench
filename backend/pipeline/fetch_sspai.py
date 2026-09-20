# -*- coding: utf-8 -*-
"""抓取少数派（sspai.com）最新文章（官方 RSS 2.0 feed），生成 sspai.json。

数据源：https://sspai.com/feed  （公开 RSS 2.0，免登录/免 key）
  item: title(标题) / link(文章页) / description(摘要，含"查看全文"导流已剥)

设计要点（路 A · 纯 stdlib RSS/Atom，不经 OpenCLI、不上 Node）：
  - 抓取失败时**不覆盖**已有 sspai.json，保留上一次成功结果（优雅劣化）。
  - 解析用 wb_common.parse_feed（命名空间无关，RSS/Atom 通吃），与 Product Hunt 源共用。
  - 选它做「练产品感」的中文源：少数派是中文圈最好的效率工具/产品品味社区。
"""
from datetime import datetime

from backend.utils import common as wb_common
from backend.core.paths import SSPAI_JSON
from backend.pipeline.feeds import FEEDS, run_fetcher

SPEC = FEEDS["sspai"]  # 键名/文案/空壳/预览等随源而变的事实，见 feeds.py
FEED = "https://sspai.com/feed"
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
