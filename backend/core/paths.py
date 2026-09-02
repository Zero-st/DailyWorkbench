# -*- coding: utf-8 -*-
"""仓库根路径与根级数据文件的单一来源。

前端（GitHub Pages 从仓库根部署）与本地 server 都在**仓库根**读写 data.json 等；
后端脚本移入 backend/ 后 __file__ 不再等于仓库根，故统一从这里取 ROOT，
避免每个脚本各自 dirname(dirname(...)) 算错。后端私有文件（日志）仍可留脚本自身目录。
"""
import os

# backend/core/paths.py -> backend/core -> backend -> 仓库根
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_JSON = os.path.join(ROOT, "data.json")
AI_DAILY_JSON = os.path.join(ROOT, "ai_daily.json")
DAILY_NEWS_JSON = os.path.join(ROOT, "daily_news.json")
