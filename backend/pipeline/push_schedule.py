# -*- coding: utf-8 -*-
"""把本地课程表文件 schedule.local.json 推送到 GitHub 仓库的 schedule.json。

用法：
  python push_schedule.py            # 读取 schedule.local.json 推送
  python push_schedule.py my.json    # 指定文件推送

需要环境变量 GITHUB_TOKEN（仅 repo 权限），或交互输入。
用于：本机维护课程表，不想走网页 Token 时，由命令行 / 定时任务推送。
"""
import os
import sys
import json

from backend.utils import common as wb_common
from backend.core.paths import ROOT, SCHEDULE_LOCAL_JSON

REPO = "Zero-st/DailyWorkbench"


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SCHEDULE_LOCAL_JSON
    if not os.path.isfile(src):
        print("源文件不存在：%s" % src)
        return 1
    with open(src, "r", encoding="utf-8") as f:
        list_data = json.load(f)

    token = os.environ.get("GITHUB_TOKEN") or input("GitHub Token: ").strip()
    if not token:
        print("未提供 Token")
        return 1

    # 源文件名(schedule.local.json)≠仓库目标名(schedule.json)，用 src_path 指定读取源
    ok = wb_common.github_push(token, "schedule.json", "chore: update schedule from local",
                               REPO, ROOT, log=lambda m: print(m), src_path=src)
    if ok:
        print("✅ 已推送 %d 条课程到 GitHub schedule.json" % len(list_data))
        return 0
    print("推送失败")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
