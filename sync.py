# -*- coding: utf-8 -*-
"""工作台同步：本机 self-hosted runner 上生成 data.json，通过 GitHub API 推回仓库。

设计要点：
- 不依赖本地 git 仓库状态（避免复用工作区 checkout 后 git 命令报
  "not in a git directory"）。推送走 GitHub Contents API + GITHUB_TOKEN。
- deploy-pages.yml 在 push 到 main（或本工作流 completed）时自动重新部署 Pages，
  所以线上面板会拿到最新 data.json。
- 诊断日志写到仓库外的工作区目录（sync_diag.log），避免被 checkout 的
  git clean 清掉，方便失败时本地排查。
"""
import os
import sys
import subprocess
from datetime import datetime

import wb_config
import wb_common

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
ENV = dict(os.environ)
ENV["PYTHONIOENCODING"] = "utf-8"

REPO = "Zero-st/DailyWorkbench"
DIAG = wb_config.diag_log()


def diag(msg):
    try:
        with open(DIAG, "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (datetime.now().strftime("%H:%M:%S"), msg))
    except Exception:
        pass


def run_py(script, timeout=300):
    p = subprocess.run([PY, script], cwd=HERE, env=ENV, capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    return p.returncode, out.strip()


def push_file(token, relpath, msg):
    """把仓库相对路径 relpath 的本地文件推送到仓库（Contents API 统一通道）。"""
    return wb_common.github_push(token, relpath, msg, REPO, HERE, log=diag)


def main():
    diag("==== sync 开始 cwd=%s HERE=%s ====" % (os.getcwd(), HERE))
    token = os.environ.get("GITHUB_TOKEN")
    diag("GITHUB_TOKEN 存在=%s" % bool(token))
    if not token:
        diag("ERROR: 缺少 GITHUB_TOKEN，无法推送 data.json")
        return 1

    from sync_status import write_sync_status
    lines = ["==== sync %s ====" % datetime.now().strftime("%Y-%m-%d %H:%M:%S")]
    data_path = os.path.join(HERE, "data.json")

    rc, out = run_py("export_data.py")
    lines.append("[export_data.py] rc=%d\n%s" % (rc, out))
    diag("[export_data.py] rc=%d" % rc)
    export_ok = (rc == 0)

    push1_ok = push_file(token, "data.json",
                         "chore: auto-sync data %s" % datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
    diag("push1_ok=%s" % push1_ok)

    # 把同步健康度（成功/失败/陈旧告警）写回 data.json
    try:
        st = write_sync_status(data_path, ok=(export_ok and push1_ok))
        lines.append("[sync status] %s" % st)
    except Exception as e:
        lines.append("[sync status 错误] %s" % e)

    # 再推一次，让线上的 sync.status 也最新（刷新按钮据此判断成功/失败）
    push2_ok = push_file(token, "data.json", "chore: update sync health status")
    diag("push2_ok=%s" % push2_ok)

    ok = export_ok and push1_ok and push2_ok
    lines.append("==== done %s %s ====" % ("OK" if ok else "FAIL", datetime.now().strftime("%H:%M:%S")))
    wb_common.write_log(os.path.join(HERE, "sync.log"), lines)
    diag("==== sync 结束 ok=%s ====" % ok)
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        code = main()
    except Exception as e:
        diag("FATAL: %s" % e)
        import traceback
        diag(traceback.format_exc())
        code = 1
    raise SystemExit(code)
