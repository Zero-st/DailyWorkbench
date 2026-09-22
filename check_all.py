# -*- coding: utf-8 -*-
"""门禁聚合器：把「提交前该跑什么」收敛成唯一一份清单。

缘起
----
2026-09-21 实测：门禁脚本齐全，但**只在 push 之后的 CI 跑**——
  · .git/hooks 为空、无 core.hooksPath、无 Claude Code hooks；
  · docs/版本管理规范.md §4 的「提交前手跑清单」只列了 bump_version + pytest，
    漏掉 check_design_tokens.py 和 check_docs.py，与 ci.yml 的五步已经漂移。
后者正是 docs/开发测试规范.md §3.1「活文档漂移」那条坑的新实例：
**清单存在两份副本，就一定会漂**。本脚本是那份清单的唯一副本，CI 与本地 hook 都调它。

为什么不是「记得跑这几个脚本」
------------------------------
照 §3.0 升级判据：靠人记 = 📄 文档档 = 复发第 2 次即判定失效。
本脚本 + .githooks/pre-commit 是把它升到 🤖 门禁档。

被聚合的门禁（顺序 = 从快到慢，先炸最便宜的）
----------------------------------------------
  bump    python bump_version.py --check            前端缓存戳同步 + sw.js FILES 校验
  tokens  python check_design_tokens.py --check     孤儿令牌 / 化石棘轮 / index.html emoji
  docs    python check_docs.py --check              索引一致性 / 命名词表 / 副本冲突 / 行长
  flake8  python -m flake8 --select=E9,F63,F7,F82   语法错与未定义名（阻塞）
  pytest  python -m pytest -q                       全量纯函数测试（零网络）
  tsc     npx tsc --noEmit -p jsconfig.json         state.js/net.js 的 JSDoc 类型契约

**下游一律带 --check**：check_docs.py 无参是报告模式恒退 0（不带 = 假绿），
bump_version.py 无参会**写盘**（在 hook 里误调会改工作区）。这两条是实测踩过的语义陷阱，
所以本脚本从不给下游「可能说谎」的模式，只让自己的退出码随 --check 变。

用法
----
    python check_all.py                # 报告模式：跑全部、打印现状，恒退 0
    python check_all.py --check        # 硬门：任一项违规退出 1（pre-commit hook 用）
    python check_all.py --check --strict  # 再加严：外部工具缺失也算失败（CI 用）
    python check_all.py --check --strict --skip=tsc   # CI python job：tsc 归独立 types job
    python check_all.py --stats        # 读记账，按命中次数排序，供 §3.0 反向判据决策

--skip 是**显式**排除：被排除项会打印 EXCLUDED 并计数，不会伪装成通过。
之所以要它而不是靠「工具不在就跳过」：CI 的 python job 没有 Node，靠静默跳过
等于让 --strict 形同虚设——那就是宪章维度三禁的假绿。

只用标准库；与 bump_version.py / check_design_tokens.py / check_docs.py 同位同形，
兼容 Python 3.10。禁 `|| true`：跳过必须显式打印 SKIPPED，绝不静默转绿（宪章维度三）。
"""

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
HITS = "gate-hits.local.jsonl"   # 命中记账（.gitignore；只用于排序，不自动删门禁）

OK, FAIL, SKIPPED, EXCLUDED = "OK", "FAIL", "SKIPPED", "EXCLUDED"


def _has_module(name):
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


# 每项：key, 一句话说明, 命令, 可用性探测（None = 总是可用）, 是否阻塞
GATES = [
    ("bump", "前端缓存戳同步 + sw.js 预缓存清单",
     [sys.executable, "bump_version.py", "--check"], None, True),
    ("tokens", "设计令牌：孤儿 / 化石棘轮 / index.html emoji",
     [sys.executable, "check_design_tokens.py", "--check"], None, True),
    ("docs", "文档：索引一致性 / 命名词表 / 副本冲突 / 索引行长",
     [sys.executable, "check_docs.py", "--check"], None, True),
    ("flake8", "Python 语法错与未定义名",
     [sys.executable, "-m", "flake8", ".", "--select=E9,F63,F7,F82", "--show-source"],
     lambda: _has_module("flake8"), True),
    ("pytest", "全量纯函数测试（零网络）",
     [sys.executable, "-m", "pytest", "-q"],
     lambda: _has_module("pytest"), True),
    ("tsc", "前端类型契约（state.js / net.js + data.json 的 WBData）",
     ["npx", "-y", "-p", "typescript@latest", "tsc", "--noEmit", "-p", "jsconfig.json"],
     lambda: shutil.which("npx") is not None, True),
]

# 可用性探测失败时告诉人怎么补，而不是只说「跳过」
FIXES = {
    "flake8": "pip install flake8",
    "pytest": "pip install pytest",
    "tsc": "装 Node 20+（本地可不装，CI 的 types job 会跑）",
}


def record(gate, code):
    """失败落盘一行。零命中 != 无用（可能是威慑），故只记账、不自动删门禁。"""
    line = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "gate": gate, "exit": code}
    try:
        with open(os.path.join(HERE, HITS), "a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    except OSError:
        pass   # 记账失败绝不能影响门禁结论


def run_gate(key, desc, cmd, probe, verbose):
    if probe is not None and not probe():
        return SKIPPED, 0, 0.0
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    except OSError as e:
        print("  ! 无法执行：%s" % e)
        return SKIPPED, 0, time.time() - t0
    dt = time.time() - t0
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0 or verbose:
        for ln in out.rstrip("\n").split("\n"):
            if ln.strip():
                print("  | " + ln)
    return (OK if p.returncode == 0 else FAIL), p.returncode, dt


def cmd_stats():
    path = os.path.join(HERE, HITS)
    if not os.path.exists(path):
        print("还没有记账文件（%s）——说明自启用以来门禁一次都没红过。" % HITS)
        print("注意：零命中 != 无用。门禁可能正因为有威慑力而无人触犯。")
        return 0
    counts, last = {}, {}
    with open(path, encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            g = r.get("gate", "?")
            counts[g] = counts.get(g, 0) + 1
            last[g] = r.get("ts", "")
    print("门禁命中记账（供 开发测试规范 §3.0 反向判据排序用）")
    print("=" * 66)
    known = [g[0] for g in GATES]
    for g in sorted(set(known) | set(counts), key=lambda k: (-counts.get(k, 0), k)):
        n = counts.get(g, 0)
        tail = ("最近 %s" % last[g]) if n else "从未拦下任何事故 —— 候选复核对象"
        print("  %-8s %4d 次   %s" % (g, n, tail))
    print("=" * 66)
    print("判据（§3.0 反向）：拦不住任何真实事故的门禁是废话，该删。")
    print("但零命中 != 无用 —— 可能正因有威慑力而无人触犯。本表只用于**排序**，删不删由人拍板。")
    return 0


def main(argv):
    if "--stats" in argv:
        return cmd_stats()

    strict_exit = "--check" in argv      # 自己的退出码是否随违规变
    strict_tools = "--strict" in argv    # 外部工具缺失是否算失败
    verbose = not strict_exit            # 报告模式下把下游输出全打出来

    print("门禁聚合 · %d 项（下游一律带 --check，绝不给可能说谎的模式）" % len(GATES))
    print("=" * 66)

    skip_keys = set()
    for a in argv:
        if a.startswith("--skip="):
            skip_keys |= {k.strip() for k in a[len("--skip="):].split(",") if k.strip()}
    unknown = skip_keys - {g[0] for g in GATES}
    if unknown:
        print("✗ --skip 指名了不存在的门禁：%s" % "、".join(sorted(unknown)))
        print("  可选：%s" % "、".join(g[0] for g in GATES))
        return 1

    results, fails, skips, excluded = [], 0, 0, 0
    for key, desc, cmd, probe, _blocking in GATES:
        print("▸ %-7s %s" % (key, desc))
        if key in skip_keys:
            excluded += 1
            results.append((key, EXCLUDED, 0.0))
            print("  ⊗ EXCLUDED —— 由 --skip 显式排除（须另有地方跑它，否则就是漏检）")
            continue
        status, code, dt = run_gate(key, desc, cmd, probe, verbose)
        results.append((key, status, dt))
        if status == FAIL:
            fails += 1
            record(key, code)
            print("  ✗ FAIL（退出码 %d，耗时 %.1fs）" % (code, dt))
        elif status == SKIPPED:
            skips += 1
            print("  ⊘ SKIPPED —— 工具不可用。补法：%s" % FIXES.get(key, "见上"))
        else:
            print("  ✓ OK（%.1fs）" % dt)

    print("=" * 66)
    total = sum(dt for _, _, dt in results)
    print("合计 %.1fs · 通过 %d · 失败 %d · 跳过 %d · 排除 %d"
          % (total, len(results) - fails - skips - excluded, fails, skips, excluded))
    if excluded:
        print("提醒：排除项**没有被检查过**。CI 里 tsc 归 types job；本地请别长期排除。")

    if skips and strict_tools:
        print("✗ --strict：有 %d 项因工具缺失被跳过，视为失败（禁 `|| true` 假绿）" % skips)
        return 1
    if skips:
        print("注意：跳过项**没有被检查过**，不是通过。CI 跑的是 --check --strict，那里会红。")

    if fails:
        print("%d 项未通过。修完再提交；确需绕过用 `git commit --no-verify`（代价：CI 仍会红）。" % fails)
        if not strict_exit:
            print("注意：本次为报告模式（恒退 0）。hook 与 CI 跑的是 "
                  "`python check_all.py --check`，当前会红。")
        return 1 if strict_exit else 0

    print("全部通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
