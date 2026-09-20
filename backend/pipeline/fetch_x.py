# -*- coding: utf-8 -*-
"""抓取 X/推特高相关近期帖子，生成 x.json（经 grok-cli 取数引擎）。

数据源：backend/clients/grok.py 的 search_x()（subprocess grok-cli，底层 xAI search_x）。
对 wb_config.x_queries() 里每个查询各检索一次，合并去重成统一 item 列表。

设计要点（与 fetch_hacker_news.py 对齐 + grok-cli 特有约束，见 ADR 0012）：
  - grok-cli 需 Bun 运行时 + xAI 付费 key，仅在**取数层**被调用，**不进 App 运行时**（守北极星）。
    命令经 wb_config.grok_cmd()、key 经 grok_api_key() 取；未配置 → 该源静默跳过。
  - 抓取失败时**不覆盖**已有 x.json，保留上一次成功结果（优雅劣化）；不抛异常到管线、
    不影响 export_data 与其余资讯源。
  - grok-cli 是 Agent，输出结构化帖子靠 grok.py 的 PROMPT 强约束 + 容错解析，非契约级稳定。
"""
from datetime import datetime

from backend.core import config as wb_config
from backend.core.paths import X_JSON
from backend.clients import grok
from backend.pipeline.feeds import FEEDS, run_fetcher

SPEC = FEEDS["x"]  # 键名/文案/空壳/预览等随源而变的事实，见 feeds.py
OUT = X_JSON
PER_QUERY = 12  # 每个 query 取多少条，乘以 query 数即上限；控成本


def build():
    """对每个查询词调 grok.search_x，合并去重，映射到统一 item：{title, summary, url, source}。"""
    if not grok.configured():
        raise RuntimeError(
            "grok-cli 未配置（grokCmd / grokApiKey 缺失）——本机未装 Bun+grok-cli 或无 xAI key，该源自动跳过")
    queries = wb_config.x_queries()
    items = []
    seen = set()          # 去重键：url 优先，回退 title
    warnings = []
    for q in queries:
        try:
            posts = grok.search_x(q, limit=PER_QUERY)
        except Exception as e:
            warnings.append("query「%s」失败：%s" % (q, e))
            continue
        for p in posts:
            key = (p.get("url") or "").strip() or (p.get("title") or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            items.append({
                "title": p.get("title") or "",
                "summary": p.get("summary") or "",
                "url": p.get("url") or "",
                "source": "X",
            })
    if not items:
        raise ValueError("所有查询均无有效帖子（warnings: %s）" % "; ".join(warnings) if warnings else "无有效帖子")
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "fetchedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": SPEC.source,
        "canonical": SPEC.canonical,
        "count": len(items),
        "items": items,
        "warnings": warnings,
    }


def main():
    return run_fetcher(SPEC, build, OUT)


if __name__ == "__main__":
    raise SystemExit(main())
