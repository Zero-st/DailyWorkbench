# -*- coding: utf-8 -*-
"""本地定时刷新入口（路线 A：纯本地，无 git push）。

链路：抓 AI 日报 -> 抓每日新闻 -> 重新聚合 data.json -> 写入 sync 健康度。
由 Windows 计划任务 WorkbenchLocalRefresh（每小时）调用；
也可手动运行：python local_refresh.py

为什么是 .py 而不是 .cmd：cmd.exe 默认 GBK 代码页，跑含中文输出/UTF-8
源码的批处理可能崩溃（rc=-1073741510），且计划任务无终端窗口。
所有输出写入 local_refresh.log 便于排障。
"""
import os
import subprocess
import sys
from datetime import datetime

from backend.core.paths import ROOT, DATA_JSON

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable  # 与调用方同一解释器
LOG = os.path.join(HERE, "local_refresh.log")  # 后端私有日志，留 backend/pipeline
LOG_MAX = 512 * 1024  # 超过 512KB 轮转，防无限增长

# 以 package 模块名 spawn（python -m backend.pipeline.<x>，cwd=ROOT）
STEPS = [
    ("AI 日报", "fetch_ai_daily"),
    ("每日新闻", "fetch_daily_news"),
    ("数据聚合", "export_data"),
]


def log(msg):
    line = "[%s] %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    try:
        print(line)
    except Exception:
        pass  # 无控制台时忽略
    try:
        if os.path.isfile(LOG) and os.path.getsize(LOG) > LOG_MAX:
            os.remove(LOG)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def run_step(name, script):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"  # 子进程同样防编码问题
    try:
        p = subprocess.run(
            [PY, "-m", "backend.pipeline." + script],
            cwd=ROOT, env=env,
            capture_output=True, text=True,
            encoding="utf-8", errors="replace",
            timeout=300,
        )
        ok = p.returncode == 0
        log("%s: %s (rc=%d)" % (name, "OK" if ok else "FAIL", p.returncode))
        for ln in (p.stdout or "").strip().splitlines()[:6]:
            log("   | " + ln)
        for ln in (p.stderr or "").strip().splitlines()[:6]:
            log("   ! " + ln)
        return ok
    except Exception as e:
        log("%s: EXC %s" % (name, e))
        return False


def main():
    log("===== local refresh start =====")
    results = [run_step(n, s) for n, s in STEPS]

    # 资讯抓取失败不阻断（脚本自身保留旧数据）；
    # 整体健康度以 export_data.py 是否成功为准
    ok = results[-1]

    try:
        from backend.pipeline.sync_status import write_sync_status
        st = write_sync_status(
            DATA_JSON,
            ok=ok, interval_hours=1, stale_hours=2,
        )
        log("sync status -> %s (lastRun=%s)" % (
            "ok" if ok else "fail",
            st.get("lastRun") if st else "?",
        ))
    except Exception as e:
        log("sync status EXC %s" % e)
        ok = False

    log("===== local refresh end (ok=%s) =====" % ok)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
