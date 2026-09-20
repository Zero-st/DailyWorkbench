# -*- coding: utf-8 -*-
"""聚合 7 个资讯源的抓取结果，生成 data.json（前端唯一数据契约）。

每个源的抓取由各自的 fetch_<源>.py 负责，本模块只做两件事：
- 调 feeds.merge_history 把「当次抓取」并进「最近 14 个日份」的历史；
- 把 7 个源装配成 data.json 并原子写出。

失败语义随 merge_history：源文件缺失/损坏时该源静默沿用上一次结果（或空壳），
不影响其余源，也不会把 data.json 写成半成品。

注：`sync` 键不由本模块写——它由 backend/pipeline/sync_status.py 在本模块之后补写。
裸跑本模块会让 data.json 短暂缺少 sync 键，正常路径请走 backend.pipeline.local_refresh。

历史：本模块原先还从本机 WorkBuddy 抓 skills/自动化/模型/记忆/会话/知识库/MCP 等遥测，
生成 kpi/skills/status/sessions/knowledge/weekly/guide/quickActions 八个顶层键。
这些键的消费视图（ov/cap/sess/stats/week）已于 c7b14ad、28cd805 全部删除，数据线随后空转，
于 2026-09-20 连同契约一并切除，见 docs/adr/0013-drop-workbuddy-telemetry.md。
"""
from datetime import datetime

from backend.utils import common as wb_common
from backend.core.paths import (
    DATA_JSON, AI_DAILY_JSON, DAILY_NEWS_JSON, HACKER_NEWS_JSON, GITHUB_TRENDING_JSON,
    PRODUCTHUNT_JSON, SSPAI_JSON, X_JSON,
)
from backend.pipeline.feeds import FEEDS, merge_history

OUT = DATA_JSON  # 钉在仓库根：前端 fetch / server 静态服务 / sync 推送都在根


def get_ai_daily():
    """AI 日报：读 ai_daily.json + 累积历史日份（骨架见 feeds.merge_history）。"""
    return merge_history(AI_DAILY_JSON, DATA_JSON, FEEDS["aiDaily"])


def get_daily_news():
    """每日新闻（每日60秒）：同上，额外透传 tip。"""
    return merge_history(DAILY_NEWS_JSON, DATA_JSON, FEEDS["dailyNews"])


def get_hacker_news():
    """Hacker News：同上。OpenCLI 缺失时源文件保持旧值/缺失，该源静默沿用上一次（或空壳）。"""
    return merge_history(HACKER_NEWS_JSON, DATA_JSON, FEEDS["hackerNews"])


def get_github_trending():
    """GitHub Trending：同上，优雅劣化同 get_hacker_news。"""
    return merge_history(GITHUB_TRENDING_JSON, DATA_JSON, FEEDS["githubTrending"])


def get_producthunt():
    """Product Hunt：同上（路 A · stdlib Atom，无 Node 依赖）。"""
    return merge_history(PRODUCTHUNT_JSON, DATA_JSON, FEEDS["productHunt"])


def get_sspai():
    """少数派：同上（路 A · stdlib RSS，无 Node 依赖）。"""
    return merge_history(SSPAI_JSON, DATA_JSON, FEEDS["sspai"])


def get_x():
    """X/推特：同上。grok-cli / xAI key 缺失时该源静默沿用上一次（或空壳），见 ADR 0012。"""
    return merge_history(X_JSON, DATA_JSON, FEEDS["x"])


def main():
    aid = get_ai_daily()
    dn = get_daily_news()
    hn = get_hacker_news()
    gt = get_github_trending()
    ph = get_producthunt()
    sp = get_sspai()
    xp = get_x()
    now = datetime.now()

    data = {
        "generatedAt": now.strftime("%Y-%m-%d %H:%M"),
        "aiDaily": aid,
        "dailyNews": dn,
        "hackerNews": hn,
        "githubTrending": gt,
        "productHunt": ph,
        "sspai": sp,
        "x": xp,
    }
    wb_common.write_json_atomic(OUT, data)  # 原子替换，前端轮询不会读到半写文件
    print("✅ 已生成 data.json")
    print("   AI日报 : %s · %d 条" % (aid.get("date") or "无", aid.get("count") or 0))
    print("   每日新闻: %s · %d 条" % (dn.get("date") or "无", dn.get("count") or 0))
    print("   ProductHunt: %s · %d 条" % (ph.get("date") or "无", ph.get("count") or 0))
    print("   少数派 : %s · %d 条" % (sp.get("date") or "无", sp.get("count") or 0))
    print("   X/推特 : %s · %d 条" % (xp.get("date") or "无", xp.get("count") or 0))
    print("   输出   : %s" % OUT)


if __name__ == "__main__":
    main()
