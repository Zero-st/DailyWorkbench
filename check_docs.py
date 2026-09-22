# -*- coding: utf-8 -*-
"""文档门禁：让 docs/文档规范.md 从「愿望」变成「契约」。

缘起
----
2026-09-21 实测：同一套文档规则在仓里有 3 份副本且已打架——
  · docs/README.md §1 说治理「三篇」，doc-filing/SKILL.md 说「两篇」；
  · SKILL.md 的压缩版词表漏了 台账/演进史、心法/总纲、图解-、NNNN- 四类；
  · 仓根 README.md §十 的 ADR 枚举停在 0010，磁盘已到 0016；
  · 词表写的 `-复盘` 后缀实际一篇都没有（5 篇全是 `复盘-XXX` 前缀）。
照 docs/开发测试规范.md §3.0：「活文档漂移」复发多次，已达升级线——文档档升门禁档。

规则（--check 下违反即退出码 1）
--------------------------------
  C1 索引一致性   docs/ 下每篇 .md 都在 docs/README.md 有索引行；索引链接都能解析
  C2 命名词表符合 目录 ↔ 文件名 匹配词表；**词表从 docs/文档规范.md §2 解析，本脚本不留副本**
  C3 副本冲突     doc-filing/SKILL.md 与仓根 README.md 若长回规则正文即红
  C4 索引行长上限 docs/README.md 索引单行 ≤ 200 字符（按字符数，非字节）

用法
----
    python check_docs.py           # 报告模式：打印现状，恒退 0
    python check_docs.py --check   # CI 硬门：任一项违规退出 1

只用标准库；与 bump_version.py / check_design_tokens.py 同位同形，兼容 Python 3.10。
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

DOCS = "docs"
SPEC = "docs/文档规范.md"      # 词表唯一真源
INDEX = "docs/README.md"       # 索引宿主（C1/C4 的被检对象）
POINTER_ONLY = (".claude/skills/doc-filing/SKILL.md", "README.md")  # 只许留指针

VOCAB_BEGIN = "<!-- check_docs:vocab:begin -->"
VOCAB_END = "<!-- check_docs:vocab:end -->"
POSITIONS = ("尾", "首", "整名", "正则", "豁免")

LINE_LIMIT = 200        # C4 阈值：分布上的自然断点（150→200 掉 5 行，200→250 只掉 2 行）
MIN_VOCAB_ROWS = 10     # 解析出的规则少于这个数 = 解析失败，fail closed
LINE_VOCAB_HITS = 3     # C3 行级：同行 ≥3 个不同词表词 且 ≥1 个目录名
FILE_VOCAB_HITS = 3     # C3 文件级：全文累计 ≥3 个「与目录名同行」的词表词
#   为什么只数「同行共现」而不是全文词数：规则副本的本质是「词 → 目录」的映射，
#   而散文里天然会零散提到 复盘/账本/数据流 等词（实测仓根 README 有 6 个，全是
#   产品描述与索引链接，无一构成映射）。只数共现，误报从 1 降到 0，且仍堵得住
#   「把词表拆成每行一个词」的绕过。照 开发测试规范 §3.0 反向判据：宁可门小而真。

# 版本 / 期次尾巴：-v0.8.0 / -W1 / -W2-W4 / -2026-09 / -2026-09-21
_SERIAL_TAIL = re.compile(r"(-(?:v?\d[\w.]*|W\d+(?:-W\d+)?|\d{4}(?:-\d{2}){1,2}))+$")
_LINK = re.compile(r"\]\(([^)]+)\)")
_DIRNAME = re.compile(
    r"(?<![A-Za-z0-9_])(adr|guides|design|planning|research|reference|requirements|principles)"
    r"(?![A-Za-z0-9_])"
)
_FILE_TOKEN = re.compile(r"\S+\.(?:md|sql|html|json|opml|py|yml)\b")


# ---------- 基础工具 ----------

def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _norm(cell):
    """表格单元格归一：剥反引号 / 全角空格 / NBSP / 首尾空白。"""
    return cell.replace("　", " ").replace(" ", " ").replace("`", "").strip()


def docs_md_files(base=HERE):
    """docs/ 下全部 .md，相对 docs/ 的 / 分隔路径，排序（确定性）。"""
    root = os.path.join(base, DOCS)
    out = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            if not name.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            out.append(rel.replace(os.sep, "/"))
    return sorted(out)


def _strip_serial(stem):
    return _SERIAL_TAIL.sub("", stem)


# ---------- 词表解析（C2 的核心；fail closed） ----------

def parse_vocab(base=HERE):
    """从 docs/文档规范.md 两个哨兵之间解析词表表格。

    返回 (rules, errors)：
      rules  = {目录 -> [(位置, 词), ...]}，目录已归一（根为 "."，子目录带尾 "/"）
      errors = [str]，非空即视为解析失败 → --check 必须红
    """
    rules = {}
    errors = []
    path = os.path.join(base, SPEC)
    if not os.path.exists(path):
        return rules, ["词表真源不存在：%s" % SPEC]

    text = _read(path)
    if VOCAB_BEGIN not in text or VOCAB_END not in text:
        return rules, ["%s 缺哨兵注释（%s / %s）" % (SPEC, VOCAB_BEGIN, VOCAB_END)]

    block = text.split(VOCAB_BEGIN, 1)[1].split(VOCAB_END, 1)[0]
    for raw in block.splitlines():
        line = raw.strip()
        if not line.startswith("|"):
            continue
        if set(line) <= set("|-: "):          # 分隔行
            continue
        cells = [_norm(c) for c in line.strip("|").split("|")]
        if cells and cells[0] in ("目录", "dir"):  # 表头
            continue
        if len(cells) != 4:
            errors.append("表格行不是 4 列（实际 %d 列）：%s" % (len(cells), line))
            continue
        dirname, position, words, _desc = cells
        if position not in POSITIONS:
            errors.append("未知「位置」取值 %r（合法：%s）：%s" % (position, "/".join(POSITIONS), line))
            continue
        key = "." if dirname in (".", "docs", "docs/", "") else dirname.rstrip("/") + "/"
        if position == "豁免":
            rules.setdefault(key, []).append(("豁免", ""))
            continue
        for word in words.split():
            word = word.lstrip("-")
            if not word or word == "-":
                continue
            rules.setdefault(key, []).append((position, word))

    total = sum(len(v) for v in rules.values())
    if total < MIN_VOCAB_ROWS:
        errors.append(
            "只解析出 %d 条规则（下限 %d）——极可能是表格格式坏了。"
            "拒绝以空规则集放行（fail closed）。" % (total, MIN_VOCAB_ROWS)
        )
    return rules, errors


def match_vocab(filedir, stem, rules):
    """单篇文档对所在目录求命中；命中返回规则描述，否则 None。

    只回答「你放错地方了吗」，不回答「这是唯一正确的地方吗」——
    后者靠人和 doc-filing skill。
    """
    applicable = list(rules.get(filedir, []))
    for rdir, rlist in rules.items():          # 豁免向下继承
        if rdir != "." and filedir.startswith(rdir):
            applicable += [r for r in rlist if r[0] == "豁免"]
    if not applicable:
        return None

    stripped = _strip_serial(stem)
    head = stripped.split("-")[0]
    for position, word in applicable:
        if position == "豁免":
            return "豁免（生成产物）"
        if position == "尾" and stripped.endswith(word):
            return "尾词 %s" % word
        if position == "首" and head.endswith(word):
            return "首词 %s" % word
        if position == "整名" and stem == word:
            return "整名 %s" % word
        if position == "正则" and re.match(word, stem):
            return "正则 %s" % word
    return None


# ---------- C1 索引一致性 ----------

def check_index(base=HERE):
    path = os.path.join(base, INDEX)
    text = _read(path)
    targets = []
    for m in _LINK.finditer(text):
        t = m.group(1).split("#")[0].strip()
        if not t or t.startswith(("http://", "https://", "mailto:")):
            continue
        targets.append(t)

    filelinks = {t for t in targets if not t.endswith("/")}
    dirlinks = {t for t in targets if t.endswith("/")}

    missing = []
    for rel in docs_md_files(base):
        if rel == "README.md":
            continue
        if rel in filelinks:
            continue
        if any(rel.startswith(d) for d in dirlinks):   # 目录链接递归覆盖
            continue
        missing.append(rel)

    dead = sorted({t for t in targets if not os.path.exists(os.path.join(base, DOCS, t))})
    return {"missing": missing, "dead": dead, "links": len(targets)}


# ---------- C2 命名词表符合 ----------

def check_naming(base, rules):
    bad = []
    for rel in docs_md_files(base):
        if rel == "README.md":
            continue
        parts = rel.rsplit("/", 1)
        filedir = "." if len(parts) == 1 else parts[0] + "/"
        stem = os.path.splitext(parts[-1])[0]
        if match_vocab(filedir, stem, rules) is None:
            if filedir not in rules and not any(
                filedir.startswith(d) for d in rules if d != "."
            ):
                bad.append((rel, "目录 %s 在词表里没有任何规则" % filedir))
            else:
                bad.append((rel, "文件名 %r 不匹配 %s 的任何词" % (stem, filedir)))
    return bad


# ---------- C3 副本冲突 ----------

def _scrub(line):
    """抹掉链接目标与文件名 token——误报的唯一来源是文件名自带词表词。"""
    line = _LINK.sub("]()", line)
    return _FILE_TOKEN.sub(" ", line)


def check_copies(base, rules):
    words = sorted({w for rs in rules.values() for pos, w in rs if pos in ("尾", "首")})
    if not words:
        return []
    hits = []
    for rel in POINTER_ONLY:
        path = os.path.join(base, rel)
        if not os.path.exists(path):
            continue
        mapped = set()          # 与目录名同行出现过的词
        for lineno, raw in enumerate(_read(path).splitlines(), 1):
            line = _scrub(raw)
            lw = {w for w in words if w in line}
            ld = set(_DIRNAME.findall(line))
            if not ld:
                continue
            mapped |= lw
            if len(lw) >= LINE_VOCAB_HITS:
                hits.append((rel, lineno, "行级：同行 %d 个词表词 + 目录名 %s"
                             % (len(lw), "/".join(sorted(ld))), raw.strip()[:80]))
        if len(mapped) >= FILE_VOCAB_HITS:
            hits.append((rel, 0, "文件级：累计 %d 个词与目录名同行出现（疑似拆行的词表）"
                         % len(mapped), "词：" + "/".join(sorted(mapped))))
    return hits


# ---------- C4 索引行长上限 ----------

def check_line_length(base=HERE):
    over = []
    for lineno, raw in enumerate(_read(os.path.join(base, INDEX)).splitlines(), 1):
        line = raw.rstrip()
        if not line.startswith("|") or set(line) <= set("|-: "):
            continue
        if len(line) > LINE_LIMIT:
            first = line.strip("|").split("|")[0].strip()[:40]
            over.append((lineno, len(line), first))
    return over


# ---------- 汇总 ----------

def report(base=HERE):
    """四项检查的唯一数据出口（测试打这里）。

    索引文件缺失走 fatal，而不是让 open() 抛 traceback——CI 里要的是一条能读懂的
    红，不是堆栈。
    """
    fatal = []
    if not os.path.exists(os.path.join(base, INDEX)):
        fatal.append("索引宿主不存在：%s（C1/C4 无法执行）" % INDEX)
    rules, vocab_errors = parse_vocab(base)
    return {
        "fatal": fatal,
        "vocab_errors": vocab_errors,
        "vocab_rules": sum(len(v) for v in rules.values()),
        "index": check_index(base) if not fatal else {"missing": [], "dead": [], "links": 0},
        "naming": check_naming(base, rules) if not vocab_errors else [],
        "copies": check_copies(base, rules) if not vocab_errors else [],
        "length": check_line_length(base) if not fatal else [],
        "total_md": len(docs_md_files(base)),
    }


def main(argv):
    strict = "--check" in argv
    r = report()
    fails = 0

    print("文档门禁 · docs/ 共 %d 篇 .md，词表解析出 %d 条规则"
          % (r["total_md"], r["vocab_rules"]))
    print("=" * 66)

    if r["fatal"]:
        for e in r["fatal"]:
            print("✗ %s" % e)
        print("=" * 66)
        print("1 项未通过。")
        return 1 if strict else 0

    # 词表解析（fail closed）
    if r["vocab_errors"]:
        fails += 1
        print("✗ 词表解析失败 —— C2/C3 已停摆，拒绝放行：")
        for e in r["vocab_errors"]:
            print("    %s" % e)
        print("  修法：检查 %s §2 两个哨兵之间的表格（4 列 · 位置列取值 %s）。"
              % (SPEC, "/".join(POSITIONS)))
    else:
        print("✓ 词表解析正常（真源 %s §2）" % SPEC)

    # C1
    idx = r["index"]
    if idx["missing"] or idx["dead"]:
        fails += 1
        print("✗ C1 索引一致性（%s 共 %d 条链接）" % (INDEX, idx["links"]))
        for p in idx["missing"]:
            print("    漏收：docs/%s 没有索引行" % p)
        for p in idx["dead"]:
            print("    死链：%s 指向不存在的路径" % p)
    else:
        print("✓ C1 索引一致性：无漏收、无死链（%d 条链接）" % idx["links"])

    # C2
    if r["naming"]:
        fails += 1
        print("✗ C2 命名词表符合")
        for p, why in r["naming"]:
            print("    docs/%s —— %s" % (p, why))
        print("  修法：改文件名，或在 %s §2 词表加一行（加词前先问：真是新品类还是旧词换皮？）" % SPEC)
    elif not r["vocab_errors"]:
        print("✓ C2 命名词表符合：全部命中")

    # C3
    if r["copies"]:
        fails += 1
        print("✗ C3 副本冲突 —— 这些文件应只留指针，不放规则正文")
        for f, ln, sig, ex in r["copies"]:
            where = "%s:%d" % (f, ln) if ln else f
            print("    %s —— %s" % (where, sig))
            print("        %s" % ex)
        print("  修法：删掉规则正文，换成「见 %s §N」。规则只在真源维护。" % SPEC)
    elif not r["vocab_errors"]:
        print("✓ C3 副本冲突：%s 均只剩指针" % "、".join(POINTER_ONLY))

    # C4
    if r["length"]:
        fails += 1
        print("✗ C4 索引行长上限（> %d 字符）" % LINE_LIMIT)
        for ln, length, first in r["length"]:
            print("    %s:%d  %d 字符  %s" % (INDEX, ln, length, first))
        print("  修法：索引是路牌不是摘要——把长描述挪回文档自身，这里只留一句话。")
    else:
        print("✓ C4 索引行长上限：最长行 ≤ %d 字符" % LINE_LIMIT)

    print("=" * 66)
    if fails:
        print("%d 项未通过。" % fails)
        if not strict:
            print("注意：本次为报告模式（恒退 0）。CI 跑的是 "
                  "`python check_docs.py --check`，当前会红。")
        return 1 if strict else 0
    print("全部通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
