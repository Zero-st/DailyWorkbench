# -*- coding: utf-8 -*-
"""设计令牌门禁：让 docs/design/界面设计准则.md 从「愿望」变成「契约」。

准则 v1.1 写着「只用 --space-*，别写裸像素」「别硬编码颜色」，但 2026-09-04 实测
css/styles.css：间距/字号声明裸 px 四百多处、走令牌几十处；77 个令牌里 19 个全仓
无人引用（化石，含 v4 玻璃拟态残留 --glass* / --glow*）；二十来行硬编码 #hex。
文档写了没人查就会漂移——本脚本就是那个「查」。

规则（违反即退出码 1，CI 会红）：
  · 孤儿 = 有 var(--x) 引用却没定义 —— 该属性直接失效，是真 bug，必须为 0；
  · 化石 = 定义了却全仓无人引用 —— 数量只许降不许升（棘轮：FOSSIL_BASELINE）。
    清掉一批就把基线调低；别调高。
只统计不阻塞（历史欠账太多，先立基线让它可见、只许变好）：
  · 裸像素：padding / margin / gap / font-size 直接写 px 的声明数 vs 走 --space-* / --text-* 的；
  · 硬编码色：令牌定义与注释之外出现 #hex 的行数。

用法：
    python check_design_tokens.py           # 打印报告；违反规则退出码 1
    python check_design_tokens.py --check   # 同上（接受该参数只为与 bump_version.py 的 CI 写法一致）

只用标准库；与 bump_version.py 同位同形。
"""
import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = "css/styles.css"
# 引用扫描范围：样式本身、全部前端脚本（含 style 字符串拼接）、入口页内联样式。
REF_GLOBS = ("css/*.css", "js/**/*.js", "index.html")

# 化石棘轮基线：2026-09-04 实测 19。只许下调，不许上调。
FOSSIL_BASELINE = 19

_COMMENT = re.compile(r"/\*.*?\*/", re.S)
# 定义：`--name:`，前面不是字母/`(`/`-`（排除 var(--x) 与 --a--b 这类）。按出现位置匹配，同一行多个令牌全抓。
_DEF = re.compile(r"(?<![\w(-])(--[A-Za-z0-9_-]+)\s*:")
_REF = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)")
_REF_JS = re.compile(r"(?:getPropertyValue|setProperty|removeProperty)\(\s*['\"](--[A-Za-z0-9_-]+)")
_SPACING_PROP = r"(?:padding|margin|(?:row-|column-)?gap|font-size)(?:-[a-z]+)*"
_BARE_PX = re.compile(_SPACING_PROP + r"\s*:[^;{}]*?\b\d+(?:\.\d+)?px")
_TOKENED = re.compile(_SPACING_PROP + r"\s*:[^;{}]*?var\(--(?:space|text)-")
# 只认「值」位置上的 hex（前面是 : , 空格 或 (），避开 #id 选择器。
_HEX = re.compile(r"(?<=[:,\s(])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b")
_TOKEN_DECL = re.compile(r"--[A-Za-z0-9_-]+\s*:[^;]*;?")


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _strip_comments(css):
    return _COMMENT.sub("", css)


def definitions(css_text):
    """styles.css 里定义的令牌名集合（去注释后按出现位置匹配，不按行）。"""
    return set(_DEF.findall(_strip_comments(css_text)))


def references(base=HERE):
    """全仓被引用的令牌名集合：CSS/HTML 的 var(--x)，以及 JS 里按名读写自定义属性的调用。"""
    out = set()
    for pat in REF_GLOBS:
        for p in glob.glob(os.path.join(base, pat), recursive=True):
            if not os.path.isfile(p):
                continue
            t = _read(p)
            out.update(_REF.findall(t))
            if p.endswith(".js"):
                out.update(_REF_JS.findall(t))
    return out


def spacing_stats(css_text):
    """(裸 px 声明数, 走 --space-*/--text-* 令牌的声明数)，只看 padding/margin/gap/font-size。"""
    t = _strip_comments(css_text)
    return len(_BARE_PX.findall(t)), len(_TOKENED.findall(t))


def hardcoded_hex_lines(css_text):
    """令牌定义与注释之外含 #hex 的行数（一行同时有令牌定义与别的声明时，先剔掉定义段再查）。"""
    n = 0
    for line in _strip_comments(css_text).splitlines():
        s = line.strip()
        if not s or s.startswith("--"):
            continue
        if _HEX.search(_TOKEN_DECL.sub("", s)):
            n += 1
    return n


def report(base=HERE):
    css_text = _read(os.path.join(base, CSS))
    defs = definitions(css_text)
    refs = references(base)
    bare, tokened = spacing_stats(css_text)
    return {
        "defined": len(defs),
        "referenced": len(refs & defs) + len(refs - defs),
        "fossils": sorted(defs - refs),
        "orphans": sorted(refs - defs),
        "bare_px": bare,
        "tokened": tokened,
        "hex_lines": hardcoded_hex_lines(css_text),
    }


def main(argv):
    r = report()
    n_f, n_o = len(r["fossils"]), len(r["orphans"])
    print("[design-tokens] %s: 定义 %d · 被引用 %d · 化石 %d（基线 %d）· 孤儿 %d"
          % (CSS, r["defined"], r["referenced"], n_f, FOSSIL_BASELINE, n_o))
    if r["fossils"]:
        print("  化石（定义了但全仓无人引用）: " + " ".join(r["fossils"]))
    if r["orphans"]:
        print("  孤儿（引用了但没定义 → 属性失效）: " + " ".join(r["orphans"]))
    print("  信息·间距/字号声明: 裸 px %d vs 走令牌 %d（准则 §5 要求只用令牌；先立基线，暂不阻塞）"
          % (r["bare_px"], r["tokened"]))
    print("  信息·硬编码色: 令牌定义外含 #hex 的行 %d（准则 §2 禁止；暂不阻塞）" % r["hex_lines"])

    bad = []
    if n_o:
        bad.append("孤儿 %d 个：引用了未定义的 CSS 变量，先在 css/styles.css 的 :root 补定义或改回已有令牌" % n_o)
    if n_f > FOSSIL_BASELINE:
        bad.append("化石 %d > 基线 %d：新加了没人用的令牌。要么真用起来，要么别加（基线只许降）" % (n_f, FOSSIL_BASELINE))
    if bad:
        for b in bad:
            print("  FAIL " + b)
        return 1
    if n_f < FOSSIL_BASELINE:
        print("  提示: 化石已降到 %d，把 FOSSIL_BASELINE 下调到 %d 锁住成果" % (n_f, n_f))
    print("  OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
