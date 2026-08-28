# -*- coding: utf-8 -*-
"""核心纯函数测试（无需 WorkBuddy 环境、无网络）。让 CI 真正把关，不再是永远绿。

覆盖：原子写、frontmatter 解析、文件名清洗、sync 健康度补丁写、缓存版本 bump。
运行：python -m pytest -q
"""
import json
import os

import wb_common
import kb_service
import sync_status
import bump_version


# ---------- wb_common.write_json_atomic ----------
def test_atomic_write_roundtrip_and_no_tmp(tmp_path):
    p = str(tmp_path / "d.json")
    wb_common.write_json_atomic(p, {"a": 1, "中文": "值"})
    assert json.load(open(p, encoding="utf-8")) == {"a": 1, "中文": "值"}
    assert not [f for f in os.listdir(tmp_path) if ".tmp." in f]


def test_atomic_write_overwrites(tmp_path):
    p = str(tmp_path / "d.json")
    wb_common.write_json_atomic(p, {"v": 1})
    wb_common.write_json_atomic(p, {"v": 2})
    assert json.load(open(p, encoding="utf-8")) == {"v": 2}


# ---------- kb_service._parse_fm（故意不并入 wb_common 的那份） ----------
def test_parse_fm_basic():
    fm, body = kb_service._parse_fm("---\ntitle: Hi\ntags: [a, b]\n---\n正文\n")
    assert fm["title"] == "Hi"
    assert fm["tags"] == ["a", "b"]
    assert body.strip() == "正文"


def test_parse_fm_quoted_and_no_frontmatter():
    fm, _ = kb_service._parse_fm('---\nname: "带 空格"\n---\nx')
    assert fm["name"] == "带 空格"
    fm2, body2 = kb_service._parse_fm("没有 frontmatter 的正文")
    assert fm2 == {} and body2 == "没有 frontmatter 的正文"


def test_clean_title_sanitizes():
    assert kb_service._clean_title('a/b:c*?"<>|d') == "a-b-c-d"
    assert kb_service._clean_title("  多个   空格 ") == "多个-空格"
    assert kb_service._clean_title("") == ""


# ---------- sync_status.write_sync_status（补丁写，保留其余字段） ----------
def test_write_sync_status_preserves_fields(tmp_path):
    p = str(tmp_path / "data.json")
    wb_common.write_json_atomic(p, {"kpi": {"skills": 3}, "sync": {"status": "old"}})
    st = sync_status.write_sync_status(p, ok=True)
    data = json.load(open(p, encoding="utf-8"))
    assert st["status"] == "ok"
    assert data["kpi"] == {"skills": 3}          # 其余字段完好
    assert data["sync"]["status"] == "ok"        # sync 被更新
    assert not [f for f in os.listdir(tmp_path) if ".tmp." in f]


# ---------- bump_version（缓存戳自动同步） ----------
def _fake_frontend(base):
    (base / "app.js").write_text("console.log(1)", encoding="utf-8")
    (base / "styles.css").write_text("body{}", encoding="utf-8")
    (base / "index.html").write_text(
        '<link href="styles.css?v=1"><script src="app.js?v=1"></script>', encoding="utf-8")
    (base / "sw.js").write_text(
        'const CACHE = "workbench-v0";\nconst FILES=["./app.js?v=1","./styles.css?v=1"];',
        encoding="utf-8")


def test_bump_check_then_apply_makes_consistent(tmp_path):
    base = str(tmp_path)
    _fake_frontend(tmp_path)
    # 初始戳 v=1 与内容 hash 不符 → check 报不同步
    assert bump_version.check(base)
    changed, cache = bump_version.apply(base)
    assert set(changed) == {"index.html", "sw.js"}
    assert cache.startswith("workbench-")
    # apply 后 check 干净、且幂等（再 apply 无改动）
    assert bump_version.check(base) == []
    assert bump_version.apply(base)[0] == []
    # 版本戳确实等于内容 hash
    h = bump_version._hash_file(os.path.join(base, "app.js"))
    assert ("app.js?v=" + h) in open(os.path.join(base, "index.html"), encoding="utf-8").read()


def test_bump_detects_content_change(tmp_path):
    base = str(tmp_path)
    _fake_frontend(tmp_path)
    bump_version.apply(base)
    assert bump_version.check(base) == []
    # 改动 app.js 内容后必须重新报不同步（这正是防白屏的关键）
    (tmp_path / "app.js").write_text("console.log(2)", encoding="utf-8")
    assert "index.html" in bump_version.check(base)
    assert "sw.js" in bump_version.check(base)
