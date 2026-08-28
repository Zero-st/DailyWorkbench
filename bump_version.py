# -*- coding: utf-8 -*-
"""前端缓存版本自动同步：按文件内容 hash 生成 ?v= 戳，杜绝人肉漏改导致的白屏。

原先改前端要手动同步三处版本号（index.html 的 ?v=、sw.js 的 FILES、sw.js 的
CACHE），漏一处用户端就吃旧缓存白屏。本脚本从文件内容算 hash 自动写这三处。

用法：
    python bump_version.py           # 按当前内容重写版本戳（改完前端后跑一次）
    python bump_version.py --check   # 只校验是否已同步，不一致则退出码 1（CI 用）

戳形如 app.js?v=<8位hash>；CACHE=workbench-<8位hash>（覆盖全部资产+index.html）。
"""
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# 带 ?v= 缓存戳的前端资产（index.html 与 sw.js 的 FILES 里都引用它们）
ASSETS = [
    "app.js",
    "styles.css",
    "schedule.js",
    "model-manager.js",
    "kb.js",
    "vendor/marked.min.js",
    "js/core/util.js",
    "js/core/state.js",
    "js/views/stats.js",
    "js/views/ov.js",
    "js/views/sess.js",
    "js/views/week.js",
    "js/views/info.js",
    "js/features/favs.js",
]


def _hash_bytes(b):
    return hashlib.md5(b).hexdigest()[:8]


def _hash_file(path):
    with open(path, "rb") as f:
        return _hash_bytes(f.read())


def compute_stamps(base=HERE):
    """每个资产的内容 hash（文件缺失则跳过）。"""
    stamps = {}
    for a in ASSETS:
        p = os.path.join(base, a)
        if os.path.isfile(p):
            stamps[a] = _hash_file(p)
    return stamps


def compute_cache(base, stamps):
    """CACHE 名：仅由全部资产内容 hash 决定（稳定、可收敛）。任一资产变化即换名，
    activate 时清旧缓存触发 SW 更新。index.html 自身的编辑由 SW 的 network-first
    导航策略兜底，无需并入（并入会与被改写的戳形成循环依赖，永不收敛）。"""
    h = hashlib.md5()
    for a in sorted(stamps):
        h.update(("%s:%s;" % (a, stamps[a])).encode("utf-8"))
    return "workbench-" + h.hexdigest()[:8]


def _stamp_asset(text, asset, ver):
    """把 text 中所有 `<asset>?v=xxx` 的戳替换为 ver，返回新文本。"""
    pat = re.compile(re.escape(asset) + r"\?v=[^\"'\s)]+")
    return pat.sub(asset + "?v=" + ver, text)


def _render(base, stamps, cache):
    """返回 {相对路径: 期望内容}，仅针对 index.html 与 sw.js。"""
    out = {}
    for rel in ("index.html", "sw.js"):
        p = os.path.join(base, rel)
        if not os.path.isfile(p):
            continue
        with open(p, "r", encoding="utf-8") as f:
            text = f.read()
        for a, v in stamps.items():
            text = _stamp_asset(text, a, v)
        if rel == "sw.js":
            text = re.sub(r'const CACHE = "[^"]*";',
                          'const CACHE = "%s";' % cache, text, count=1)
        out[rel] = text
    return out


def check(base=HERE):
    """返回不同步的文件列表（空=已同步）。"""
    stamps = compute_stamps(base)
    cache = compute_cache(base, stamps)
    stale = []
    for rel, expected in _render(base, stamps, cache).items():
        with open(os.path.join(base, rel), "r", encoding="utf-8") as f:
            if f.read() != expected:
                stale.append(rel)
    return stale


def apply(base=HERE):
    """把版本戳/CACHE 写成与当前内容一致，返回被改动的文件列表。"""
    stamps = compute_stamps(base)
    cache = compute_cache(base, stamps)
    changed = []
    for rel, expected in _render(base, stamps, cache).items():
        p = os.path.join(base, rel)
        with open(p, "r", encoding="utf-8") as f:
            if f.read() == expected:
                continue
        with open(p, "w", encoding="utf-8") as f:
            f.write(expected)
        changed.append(rel)
    return changed, cache


def main(argv):
    if "--check" in argv:
        stale = check()
        if stale:
            sys.stderr.write(
                "[bump] 版本戳未同步：%s\n  改完前端请先跑 `python bump_version.py` 再提交。\n"
                % ", ".join(stale))
            return 1
        print("[bump] 版本戳已同步 ✓")
        return 0
    changed, cache = apply()
    if changed:
        print("[bump] 已更新 %s；CACHE=%s" % (", ".join(changed), cache))
    else:
        print("[bump] 无需改动，已是最新（CACHE=%s）" % cache)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
