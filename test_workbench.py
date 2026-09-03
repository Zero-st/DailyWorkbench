# -*- coding: utf-8 -*-
"""核心纯函数测试（无需 WorkBuddy 环境、无网络）。让 CI 真正把关，不再是永远绿。

覆盖：原子写、frontmatter 解析、文件名清洗、沉淀写路径(kb.save/list_deposits)、sync 健康度补丁写、
缓存版本 bump（资产自动扫描 + sw.js FILES 校验）。
运行：python -m pytest -q
"""
import json
import os
import re

from backend.utils import common as wb_common
from backend.clients import kb as kb_service
from backend.pipeline import sync_status
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


# ---------- kb_service.save / list_deposits（飞轮唯一写路径） ----------
def _kb_sandbox(tmp_path, monkeypatch):
    # kb.py 在 import 时就读了真实 vault 配置（模块级常量 VAULT/DEPOSIT），必须直接 patch
    # 模块变量；改环境变量或 patch wb_config.kb 都已晚——否则测试会写进真实 Obsidian 库。
    vault = tmp_path / "vault"
    deposit = vault / "沉淀"
    deposit.mkdir(parents=True)
    monkeypatch.setattr(kb_service, "VAULT", str(vault))
    monkeypatch.setattr(kb_service, "DEPOSIT", str(deposit))
    return vault, deposit


def test_kb_save_writes_note_and_index_then_lists_card(tmp_path, monkeypatch):
    _, deposit = _kb_sandbox(tmp_path, monkeypatch)
    extra = {"platform": "bilibili", "author": "某UP", "url": "https://b23.tv/x",
             "topic": "提示词", "actionable": ["先看目录", "做笔记"]}
    res = kb_service.save("蒸馏库", "distill", "我的 笔记", "正文内容", extra)
    assert res["ok"] is True
    assert re.fullmatch(r"蒸馏库/\d{4}-\d{2}-\d{2}/我的-笔记\.md", res["path"])
    assert res["fileName"] == "我的-笔记.md"
    fpath = deposit / res["path"]
    assert fpath.is_file()
    fm, body = kb_service._parse_fm(fpath.read_text(encoding="utf-8"))
    assert fm["module"] == "蒸馏库" and fm["source"] == "distill"
    assert fm["title"] == "我的 笔记"                    # 原标题，不是清洗后的文件名
    assert fm["date"] == res["path"].split("/")[1]
    assert fm["savedAt"].endswith("+08:00")
    assert fm["tags"] == ["AI工作台", "蒸馏库"]
    assert fm["platform"] == "bilibili" and fm["author"] == "某UP"
    assert fm["url"] == "https://b23.tv/x"              # 含冒号的值按首个冒号切分
    assert fm["topic"] == "提示词"
    assert fm["actionable"] == ["先看目录", "做笔记"]
    assert body.strip() == "正文内容"
    # 索引在 depositRoot 根，不在模块目录下；恰 1 行
    idx = deposit / "_index.jsonl"
    assert idx.is_file() and not (deposit / "蒸馏库" / "_index.jsonl").exists()
    lines = idx.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    rec = json.loads(lines[0])
    assert set(rec) == {"savedAt", "module", "date", "relPath", "fileName", "title",
                        "source", "bytes", "platform", "topic"}
    assert rec["relPath"] == res["path"] and rec["title"] == "我的 笔记"
    assert rec["bytes"] == fpath.stat().st_size
    assert "author" not in rec and "url" not in rec      # 现状：索引只收 platform/topic
    # 读回：按模块过滤、含相对 vault 的 vaultPath
    cards = kb_service.list_deposits("蒸馏库")
    assert len(cards) == 1
    assert cards[0]["platform"] == "bilibili" and cards[0]["topic"] == "提示词"
    assert cards[0]["title"] == "我的 笔记"
    assert cards[0]["vaultPath"] == "沉淀/" + res["path"]
    assert kb_service.list_deposits("收件箱") == []


def test_kb_save_same_title_same_day_gets_numeric_suffix(tmp_path, monkeypatch):
    _, deposit = _kb_sandbox(tmp_path, monkeypatch)
    r1 = kb_service.save("蒸馏库", "distill", "重复", "v1", {"platform": "x"})
    r2 = kb_service.save("蒸馏库", "distill", "重复", "v2", {"platform": "x"})
    assert r1["fileName"] == "重复.md" and r2["fileName"] == "重复-2.md"
    assert (deposit / r1["path"]).read_text(encoding="utf-8").endswith("v1\n")   # 未被覆盖
    assert (deposit / r2["path"]).read_text(encoding="utf-8").endswith("v2\n")
    assert len((deposit / "_index.jsonl").read_text(encoding="utf-8").splitlines()) == 2
    assert [c["fileName"] for c in kb_service.list_deposits("蒸馏库")] == ["重复-2.md", "重复.md"]  # 新→旧


def test_kb_save_rejects_bad_module_and_neutralizes_traversal(tmp_path, monkeypatch):
    _, deposit = _kb_sandbox(tmp_path, monkeypatch)
    bad = kb_service.save("不存在的模块", "note", "t", "b")
    assert bad["ok"] is False and not (deposit / "_index.jsonl").exists()   # 拒绝时零副作用
    r = kb_service.save("蒸馏库", "bogus-source", "../../etc/passwd", "b")
    assert r["ok"] is True and r["fileName"] == "etc-passwd.md"
    assert kb_service._under(str(deposit / r["path"]), str(deposit))
    rec = json.loads((deposit / "_index.jsonl").read_text(encoding="utf-8").splitlines()[-1])
    assert rec["source"] == "note"                       # 非白名单 source 归 note


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
    # 资产按真实布局放在 js/ 与 css/ 子目录（落在 bump_version.ASSET_GLOBS 的扫描范围内）
    (base / "js").mkdir(exist_ok=True)
    (base / "css").mkdir(exist_ok=True)
    (base / "js" / "app.js").write_text("console.log(1)", encoding="utf-8")
    (base / "css" / "styles.css").write_text("body{}", encoding="utf-8")
    (base / "index.html").write_text(
        '<link href="css/styles.css?v=1"><script src="js/app.js?v=1"></script>', encoding="utf-8")
    (base / "sw.js").write_text(
        'const CACHE = "workbench-v0";\nconst FILES=["./js/app.js?v=1","./css/styles.css?v=1"];',
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
    h = bump_version._hash_file(os.path.join(base, "js", "app.js"))
    assert ("js/app.js?v=" + h) in open(os.path.join(base, "index.html"), encoding="utf-8").read()


def test_bump_detects_content_change(tmp_path):
    base = str(tmp_path)
    _fake_frontend(tmp_path)
    bump_version.apply(base)
    assert bump_version.check(base) == []
    # 改动 app.js 内容后必须重新报不同步（这正是防白屏的关键）
    (tmp_path / "js" / "app.js").write_text("console.log(2)", encoding="utf-8")
    assert "index.html" in bump_version.check(base)
    assert "sw.js" in bump_version.check(base)


# ---------- bump_version 资产自动扫描 + sw.js FILES 校验 ----------
def test_discover_assets_scans_tree_and_excludes_noise(tmp_path):
    _fake_frontend(tmp_path)
    (tmp_path / "js" / "core").mkdir()
    (tmp_path / "js" / "core" / "x.js").write_text("export const x=1;", encoding="utf-8")
    (tmp_path / "js" / "types").mkdir()
    (tmp_path / "js" / "types" / "g.d.ts").write_text("declare var x: number;", encoding="utf-8")
    (tmp_path / "lite").mkdir()
    (tmp_path / "lite" / "app.js").write_text("// 分叉", encoding="utf-8")
    (tmp_path / "vendor").mkdir()
    (tmp_path / "vendor" / "m.js").write_text("/* lib */", encoding="utf-8")
    (tmp_path / "data.json").write_text("{}", encoding="utf-8")
    assert bump_version.discover_assets(str(tmp_path)) == [
        "css/styles.css", "js/app.js", "js/core/x.js", "vendor/m.js"]


def test_check_sw_files_reports_missing_and_ghost(tmp_path):
    base = str(tmp_path)
    _fake_frontend(tmp_path)
    assert bump_version.check_sw_files(base) == []
    # 新模块没加进 FILES → 报缺少
    (tmp_path / "js" / "core").mkdir()
    (tmp_path / "js" / "core" / "new.js").write_text("export {};", encoding="utf-8")
    probs = bump_version.check_sw_files(base)
    assert len(probs) == 1 and "js/core/new.js" in probs[0]
    # FILES 补上新模块、但又引用了一个不存在的文件 → 只剩幽灵一条
    (tmp_path / "sw.js").write_text(
        'const CACHE = "workbench-v0";\nconst FILES = [\n  "./js/app.js?v=1",\n  "./css/styles.css?v=1",\n'
        '  "./js/core/new.js",\n  "./js/gone.js"\n];', encoding="utf-8")
    probs = bump_version.check_sw_files(base)
    assert len(probs) == 1 and "js/gone.js" in probs[0]


def test_new_module_rotates_cache(tmp_path):
    # inbox.js/platforms.js 事故的回归钉：新增一个不带 ?v= 的 ES 模块也必须换 CACHE
    base = str(tmp_path)
    _fake_frontend(tmp_path)
    _, c1 = bump_version.apply(base)
    assert bump_version.check(base) == []
    (tmp_path / "js" / "core").mkdir()
    (tmp_path / "js" / "core" / "new.js").write_text("export {};", encoding="utf-8")
    assert bump_version.check(base) == ["sw.js"]          # index.html 无该文件的 ?v=，不受影响
    _, c2 = bump_version.apply(base)
    assert c1 != c2
