# -*- coding: utf-8 -*-
"""Stop hook 收尾门禁：不让这一轮带着红门禁结束。

缘起
----
2026-09-21 用户问「踩过的坑是不是该单独写个文档，AI 写代码前先扫描」。
查证：坑点台账早就存在（docs/开发测试规范.md §3.1），而且「写文档让 AI 读」
这条路在本仓**有实测反证**——emoji 豆腐块的规则同时写进 5 个文档、每次会话
都注入得到，仍复发 3 次。§3.0 据此立下红线：复发第 2 次即禁止再写第 3 份文档，
必须升级为门禁。

缺的不是文档，是**反馈时机**：门禁此前只在 CI 跑（push 后才红，而 agent
在会话里根本看不到 CI 结果）。本 hook 把它们前移到会话内——Claude 每次准备
结束回复时全跑一遍，红了就把失败原文喂回去让它当场修。

与 .githooks/pre-commit 的分工：两者跑**同一份** check_all.py，只是时机不同——
本 hook 在每轮回复收尾（只覆盖 Claude 会话，反馈最早），pre-commit 在每次提交前
（覆盖所有提交，含人手敲的）。

实测依据（2026-09-21，用一次性探针验的，非文档推断）：
  command 类型 Stop hook 输出 {"decision":"block","reason":...} 时，
  reason 确实进入 Claude 上下文并阻止回合结束；不需要 continueOnBlock。

防循环
------
输入 JSON 的 stop_hook_active 为真时立即放行（官方字段名）。另有 Claude Code
自带的兜底：连续 block 8 次后强制放行（CLAUDE_CODE_STOP_HOOK_BLOCK_CAP 可调）。

刻意不做
--------
不提供「临时关掉」的豁免开关。照 check_design_tokens.py 的判断：豁免会让门禁
失效。真要停就删 .claude/settings.json 里的这一段，让它显式可见。
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# 只有一项：清单的唯一真源是 check_all.py，这里绝不再枚举一份。
#
# 为什么：本文件初版自带 4 项清单，而 check_all.py 有 6 项——副本当场就漂了
# （少了 flake8 与 tsc）。docs/开发测试规范.md §3.1「活文档漂移」记的就是这个坑，
# §3.0 的判据是「禁止再写第 3 份文档」。改门禁清单 = 改 check_all.py，不改这里。
GATES = [
    ("check_all",
     [sys.executable, "check_all.py", "--check"],
     "门禁聚合（缓存戳 / 设计令牌 / 文档 / flake8 / pytest / 类型契约）。"
     "清单真源：check_all.py；各项修法见其输出"),
]

MAX_OUTPUT = 1800          # 每条失败输出的截断长度，避免 reason 撑爆上下文
TIMEOUT = 120


def run_gate(cmd):
    """跑一条门禁，返回 (是否通过, 输出文本)。"""
    try:
        p = subprocess.run(cmd, cwd=ROOT, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, "超时 %d 秒未返回" % TIMEOUT
    except Exception as exc:                       # 解释器/依赖缺失等
        return False, "无法执行：%s" % exc
    out = p.stdout.decode("utf-8", "replace").strip()
    if len(out) > MAX_OUTPUT:
        out = out[:MAX_OUTPUT] + "\n…（输出已截断，自己跑一遍看全文）"
    return p.returncode == 0, out


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    if data.get("stop_hook_active"):               # 防无限循环
        return 0

    failed = []
    for name, cmd, hint in GATES:
        ok, out = run_gate(cmd)
        if not ok:
            failed.append((name, hint, out, cmd))

    if not failed:
        return 0                                   # 全绿：静默放行，无感知

    parts = [
        "收尾门禁未通过（%d/%d 项）——这一轮不能就这么结束。" % (len(failed), len(GATES)),
        "",
        "逐条修完再收尾；若你判断某项是本轮之外的既有问题，**说出来让用户决定**，别默默放过。",
        "",
    ]
    for name, hint, out, cmd in failed:
        parts.append("─" * 60)
        parts.append("✗ %s —— %s" % (name, hint))
        parts.append("  复现：%s" % " ".join(
            [os.path.basename(cmd[0])] + cmd[1:]))
        parts.append("")
        parts.append(out)
        parts.append("")

    sys.stdout.write(json.dumps(
        {"decision": "block", "reason": "\n".join(parts)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
