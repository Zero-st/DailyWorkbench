# -*- coding: utf-8 -*-
"""前端缓存版本自动同步：按文件内容 hash 生成 ?v= 戳，杜绝人肉漏改导致的白屏。

原先改前端要手动同步三处版本号（index.html 的 ?v=、sw.js 的 FILES、sw.js 的
CACHE），漏一处用户端就吃旧缓存白屏。本脚本从文件内容算 hash 自动写 index.html
与 sw.js 的 ?v= 及 CACHE。

资产清单不再手写，按 ASSET_GLOBS 自动扫描——手写清单曾漂移（含 4 个已删文件、
漏 inbox.js/platforms.js 两个新模块），漏掉的模块改了不换 CACHE，CI 还检不出。

sw.js 的 FILES（预缓存列表）仍是手写，但 --check / apply 都会校验它：
  · 扫描到的资产必须都在 FILES 里（漏了 → 新模块不进预缓存，离线首开 404）；
  · FILES 不得引用不存在的文件（幽灵 → addAll 404 → 新 SW 永远装不上）。

用法：
    python bump_version.py           # 按当前内容重写版本戳（改完前端后跑一次）
    python bump_version.py --check   # 只校验是否已同步，不一致则退出码 1（CI 用）

戳形如 app.js?v=<8位hash>；CACHE=workbench-<8位hash>（由全部扫描到的资产决定）。
"""
import glob
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# 资产发现：白名单 glob。白名单目录天然排除 data.json / *.local.json / docs/ / 测试；
# *.d.ts 因后缀不匹配被排除。index.html / sw.js 自身不纳入（见 compute_cache 说明）。
ASSET_GLOBS = ("js/**/*.js", "css/*.css", "vendor/*.js", "manifest.json", "icons/*")


def discover_assets(base=HERE):
    """扫描 base 下的前端资产，返回排序后的 '/' 分隔相对路径列表（跨平台、确定性）。"""
    out = set()
    for pat in ASSET_GLOBS:
        for p in glob.glob(os.path.join(base, pat), recursive=True):
            if os.path.isfile(p):
                out.add(os.path.relpath(p, base).replace("\\", "/"))
    return sorted(out)


def _hash_bytes(b):
    return hashlib.md5(b).hexdigest()[:8]


def _hash_file(path):
    with open(path, "rb") as f:
        return _hash_bytes(f.read())


def compute_stamps(base=HERE):
    """每个资产的内容 hash（扫描期间被删的文件跳过）。"""
    stamps = {}
    for a in discover_assets(base):
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


# ---------- sw.js FILES 校验（手写清单的机器守卫） ----------
_FILES_RE = re.compile(r"const FILES\s*=\s*\[(.*?)\];", re.DOTALL)


def sw_files(base=HERE):
    """解析 sw.js 的 FILES：去 './' 前缀与 ?v= 后的相对路径列表；找不到返回 None。
    用 search 而非 match——sw.js 首字节是 BOM。"""
    p = os.path.join(base, "sw.js")
    if not os.path.isfile(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        m = _FILES_RE.search(f.read())
    if not m:
        return None
    return re.findall(r'"\./([^"?]+)(?:\?v=[^"]*)?"', m.group(1))


def check_sw_files(base=HERE):
    """校验 sw.js FILES 与扫描结果一致。返回问题描述列表（空=OK）。"""
    files = sw_files(base)
    if files is None:
        return ["sw.js: 未找到 const FILES = [...]"]
    missing = sorted(set(discover_assets(base)) - set(files))
    ghost = [f for f in files if not os.path.isfile(os.path.join(base, f))]
    return (["sw.js FILES 缺少 %s（新文件不进预缓存，离线首开 404）" % a for a in missing]
            + ["sw.js FILES 幽灵条目 %s（文件不存在，addAll 404 → 新 SW 装不上）" % f for f in ghost])


def main(argv):
    if "--check" in argv:
        stale = check()
        probs = check_sw_files()
        if stale:
            sys.stderr.write(
                "[bump] 版本戳未同步：%s\n  改完前端请先跑 `python bump_version.py` 再提交。\n"
                % ", ".join(stale))
        for msg in probs:
            sys.stderr.write("[bump] %s\n" % msg)
        if stale or probs:
            return 1
        stamps = compute_stamps()
        print("[bump] 版本戳已同步 ✓（%d 个资产，CACHE=%s）" % (len(stamps), compute_cache(HERE, stamps)))
        return 0
    changed, cache = apply()
    if changed:
        print("[bump] 已更新 %s；CACHE=%s" % (", ".join(changed), cache))
    else:
        print("[bump] 无需改动，已是最新（CACHE=%s）" % cache)
    probs = check_sw_files()
    if probs:
        for msg in probs:
            sys.stderr.write("[bump] %s\n" % msg)
        sys.stderr.write("[bump] 请手动增/删 sw.js 的 FILES 条目后重跑（apply 不代改预缓存列表）。\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
