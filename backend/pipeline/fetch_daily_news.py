# -*- coding: utf-8 -*-
"""抓取每日中文/国内新闻（「每日60秒读懂世界」开源 API），生成 daily_news.json。

数据源：https://github.com/vikiboss/60s  （公开、免 key）
  - 主：https://60s-api.viki.moe/v2/60s
  - 备：https://60s.viki.moe/v2/60s
  返回：data.date / data.news(头条列表) / data.tip(每日一言) / data.cover

设计要点（与 fetch_ai_daily.py 对齐）：
  - 必须带浏览器 User-Agent，否则偶发被拦。
  - 抓取失败时**不覆盖**已有 daily_news.json，保留上一次成功的结果。
  - 主域名失败时自动回退备用域名。
"""
from datetime import datetime

from backend.utils import common as wb_common
from backend.core.paths import DAILY_NEWS_JSON
from backend.pipeline.feeds import FEEDS, run_fetcher

SPEC = FEEDS["dailyNews"]  # 键名/文案/空壳/预览等随源而变的事实，见 feeds.py

PRIMARY = "https://60s-api.viki.moe/v2/60s"
BACKUP = "https://60s.viki.moe/v2/60s"
OUT = DAILY_NEWS_JSON  # 钉在仓库根


def _get(url, timeout=25):
    return wb_common.http_get_json(url, timeout=timeout)


def fetch():
    """依次试主/备域名，返回解析后的 data 字典；都失败抛异常。"""
    last_err = None
    for url in (PRIMARY, BACKUP):
        try:
            d = _get(url)
            if not isinstance(d, dict):
                raise ValueError("返回非 JSON 对象")
            data = d.get("data")
            if not isinstance(data, dict) or not data.get("news"):
                raise ValueError("data.news 为空")
            return data
        except Exception as e:
            last_err = e
            print("  [try %s] 失败：%s" % (url, e))
    raise RuntimeError("所有域名都失败：" + str(last_err))


def build():
    data = fetch()
    news = [str(x).strip() for x in (data.get("news") or []) if str(x).strip()]
    items = [{"title": t, "summary": "", "url": "", "source": "每日60秒"} for t in news]
    return {
        "date": data.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "fetchedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": SPEC.source,
        "canonical": SPEC.canonical,
        "count": len(items),
        "items": items,
        "tip": (data.get("tip") or "").strip(),
        "cover": data.get("cover") or "",
        "warnings": [],
    }


def main():
    return run_fetcher(SPEC, build, OUT)


if __name__ == "__main__":
    raise SystemExit(main())
