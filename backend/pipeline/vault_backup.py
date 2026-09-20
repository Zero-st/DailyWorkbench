# -*- coding: utf-8 -*-
"""Obsidian 知识库 git 自动备份：每天一次把 vault 的当下状态提交进它自己的 git 仓。

为什么不复用 self-hosted runner（路线图 §2 原本那样写）：那条线挂在
`runs-on: self-hosted` + `shell: cmd` 的 Windows 机上，本机既无 runner 也无
systemd timer，`local_refresh.log` 自 09-01 起 8 次运行全是手动。本机 crontab
已有多条在稳定跑，那才是现成的调度器。

红线：
- 路径从 `config.kb()` 取，不硬编码（宪章「环境绑定进配置」）。
- vault 不是 git 仓就**报错退出，绝不 git init**——在可能含凭据的目录里自动
  建仓是危险动作。
- 缺省**只提交不 push**。vault 的 origin 是公开仓，推送不可逆（fork/缓存收不回），
  故 push 必须由 `workbench.local.json` 的 `kb.backupPush` 显式打开。

用法：python -m backend.pipeline.vault_backup [--push]
"""
import os
import subprocess
import sys
from datetime import datetime

from backend.core import config as wb_config

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault_backup.log")
LOG_MAX = 512 * 1024
BIG_FILE_MB = 20


def log(msg):
    line = "[%s] %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    try:
        print(line)
    except Exception:
        pass
    try:
        if os.path.isfile(LOG) and os.path.getsize(LOG) > LOG_MAX:
            os.remove(LOG)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def _git(vault, *args):
    """在 vault 里跑一条 git，返回 (rc, stdout)。"""
    p = subprocess.run(["git", "-C", vault] + list(args),
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout or "").strip()


def _warn_big_files(vault):
    """只告警不拦截：大文件进 git 是不可逆的体积负担（参见 ADR 0014 的教训）。"""
    rc, out = _git(vault, "diff", "--cached", "--name-only")
    if rc != 0:
        return
    for rel in [x for x in out.splitlines() if x.strip()]:
        try:
            mb = os.path.getsize(os.path.join(vault, rel)) / 1048576.0
        except OSError:
            continue
        if mb > BIG_FILE_MB:
            log("警告：%s 有 %.1fMB，进 git 后体积不可回收" % (rel, mb))


def backup(vault=None, push=False):
    """提交 vault 当下状态。返回 0=有变更已提交 / 1=无变更 / 2=出错。"""
    vault = vault or wb_config.kb()[0]
    if not vault or not os.path.isdir(vault):
        log("未配置或路径不存在：%r" % vault)
        return 2
    rc, _ = _git(vault, "rev-parse", "--is-inside-work-tree")
    if rc != 0:
        log("不是 git 仓，拒绝自动建仓：%s" % vault)
        return 2

    rc, out = _git(vault, "add", "-A")
    if rc != 0:
        log("git add 失败：%s" % out)
        return 2
    if _git(vault, "diff", "--cached", "--quiet")[0] == 0:
        log("无变更，跳过（%s）" % vault)
        return 1
    _warn_big_files(vault)

    msg = "backup: " + datetime.now().strftime("%Y-%m-%d %H:%M")
    rc, out = _git(vault, "commit", "-m", msg)
    if rc != 0:
        log("git commit 失败：%s" % out)
        return 2
    log("已提交：%s" % msg)

    if push:
        rc, out = _git(vault, "push")
        log(("已推送 remote" if rc == 0 else "push 失败（本地提交仍在）：%s" % out))
    return 0


def main():
    push = "--push" in sys.argv[1:] or bool((wb_config._LOCAL.get("kb") or {}).get("backupPush"))
    return backup(push=push)


if __name__ == "__main__":
    sys.exit(0 if main() in (0, 1) else 1)
