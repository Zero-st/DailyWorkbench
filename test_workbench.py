# -*- coding: utf-8 -*-
"""核心纯函数测试（无需 WorkBuddy 环境、无网络）。让 CI 真正把关，不再是永远绿。

覆盖：原子写、frontmatter 解析、文件名清洗、沉淀写路径(kb.save/list_deposits)、sync 健康度补丁写、
缓存版本 bump（资产自动扫描 + sw.js FILES 校验）。
运行：python -m pytest -q
"""
import json
import os
import sys
from datetime import datetime
import re

import pytest

from backend.utils import common as wb_common
from backend.clients import kb as kb_service
from backend.pipeline import sync_status
import bump_version
import check_docs
import check_all


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


def test_kb_list_deposits_skips_ghost_rows(tmp_path, monkeypatch):
    """账本 append-only，而删卡发生在 Obsidian 里 → 两边天然不同步。读侧必须校验
    文件还在，否则幽灵卡照样进蒸馏库与今日温故卡，点开 404（复盘卡 D1）。"""
    _, deposit = _kb_sandbox(tmp_path, monkeypatch)
    r1 = kb_service.save("蒸馏库", "distill", "被删掉的卡", "v1", {"platform": "x"})
    kb_service.save("蒸馏库", "distill", "还在的卡", "v2", {"platform": "x"})
    os.remove(str(deposit / r1["path"]))
    # 账本一行不删（历史留痕），但列表里不该再出现它
    assert len((deposit / "_index.jsonl").read_text(encoding="utf-8").splitlines()) == 2
    assert [c["fileName"] for c in kb_service.list_deposits("蒸馏库")] == ["还在的卡.md"]


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
    wb_common.write_json_atomic(p, {"generatedAt": "2026-09-20 11:45", "sync": {"status": "old"}})
    st = sync_status.write_sync_status(p, ok=True)
    data = json.load(open(p, encoding="utf-8"))
    assert st["status"] == "ok"
    assert data["generatedAt"] == "2026-09-20 11:45"   # 其余字段完好（用契约内真实键做样本）
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


# ---------------------------------------------------------------- 捕获收件箱
# 收件箱是飞轮捕获环的**唯一写路径**（浏览器扩展 + 工作台都往这写），
# 故对去重、字段白名单、状态枚举、损坏恢复做回归覆盖。

from backend.clients import inbox as inbox_service


@pytest.fixture
def _inbox_sandbox(tmp_path, monkeypatch):
    """把收件箱数据文件指到 tmp，避免测试碰真实 inbox.local.json。"""
    fp = tmp_path / "inbox.json"
    monkeypatch.setattr(inbox_service, "path", lambda: str(fp))
    return str(fp)


def test_inbox_add_fills_server_side_fields(_inbox_sandbox):
    r = inbox_service.add({"url": "https://www.xiaohongshu.com/explore/1",
                           "excerpt": "精华一段", "note": "感悟", "tags": "RAG 检索",
                           "source": "ext"})
    assert r["ok"] is True
    it = r["item"]
    assert it["id"] and it["at"] and it["updatedAt"]
    assert it["status"] == "待处理"      # 服务端定初始状态
    assert it["type"] == "clip"          # 有 url 推断为剪藏
    assert it["source"] == "ext"
    assert it["tags"] == ["RAG", "检索"]  # 字符串标签被规整成列表


def test_inbox_add_infers_idea_when_no_url(_inbox_sandbox):
    r = inbox_service.add({"note": "只是一个想法"})
    assert r["item"]["type"] == "idea"


def test_inbox_add_rejects_empty_capture(_inbox_sandbox):
    r = inbox_service.add({})
    assert r["ok"] is False


def test_inbox_add_dedupes_same_url_and_excerpt(_inbox_sandbox):
    p = {"url": "https://b23.tv/x", "excerpt": "同一段摘录"}
    first = inbox_service.add(dict(p))
    again = inbox_service.add(dict(p))
    assert again.get("deduped") is True
    assert again["item"]["id"] == first["item"]["id"]
    assert len(inbox_service.list_items()) == 1


def test_inbox_add_keeps_both_when_excerpt_differs(_inbox_sandbox):
    inbox_service.add({"url": "https://b23.tv/x", "excerpt": "第一段"})
    inbox_service.add({"url": "https://b23.tv/x", "excerpt": "第二段"})
    assert len(inbox_service.list_items()) == 2   # 同一帖的不同高亮各自成条


def test_inbox_update_only_patches_whitelisted_fields(_inbox_sandbox):
    iid = inbox_service.add({"url": "https://weibo.com/1", "excerpt": "x"})["item"]["id"]
    r = inbox_service.update(iid, {"status": "已蒸馏", "note": "改后感悟",
                                   "url": "https://hacked", "id": "spoof"})
    assert r["ok"] is True
    assert r["item"]["status"] == "已蒸馏"
    assert r["item"]["note"] == "改后感悟"
    assert r["item"]["url"] == "https://weibo.com/1"   # 白名单外字段改不动
    assert r["item"]["id"] == iid


def test_inbox_update_rejects_unknown_status(_inbox_sandbox):
    iid = inbox_service.add({"note": "x"})["item"]["id"]
    assert inbox_service.update(iid, {"status": "瞎写"})["ok"] is False


def test_inbox_update_and_delete_missing_id(_inbox_sandbox):
    assert inbox_service.update("nope", {"status": "已归档"})["ok"] is False
    assert inbox_service.delete("nope")["ok"] is False


def test_inbox_delete_removes_item(_inbox_sandbox):
    iid = inbox_service.add({"note": "待删"})["item"]["id"]
    assert inbox_service.delete(iid)["ok"] is True
    assert inbox_service.list_items() == []


def test_inbox_truncates_overlong_excerpt(_inbox_sandbox):
    long = "字" * (inbox_service.EXCERPT_MAX + 500)
    it = inbox_service.add({"url": "https://x.com/1", "excerpt": long})["item"]
    assert len(it["excerpt"]) == inbox_service.EXCERPT_MAX


def test_inbox_list_is_newest_first(_inbox_sandbox):
    a = inbox_service.add({"note": "老"})["item"]
    b = inbox_service.add({"note": "新"})["item"]
    ids = [x["id"] for x in inbox_service.list_items()]
    assert ids.index(b["id"]) < ids.index(a["id"])


def test_inbox_recovers_from_corrupt_file(_inbox_sandbox):
    # 损坏的数据文件不能让工作台起不来：备份 .bak 后空启动
    with open(_inbox_sandbox, "w", encoding="utf-8") as f:
        f.write("{ 这不是合法 JSON")
    assert inbox_service.list_items() == []
    assert inbox_service.add({"note": "灾后第一条"})["ok"] is True
    assert os.path.isfile(_inbox_sandbox + ".bak")


def test_inbox_write_leaves_no_tmp_file(_inbox_sandbox):
    inbox_service.add({"note": "x"})
    d = os.path.dirname(_inbox_sandbox)
    assert not [f for f in os.listdir(d) if ".tmp" in f]


def test_inbox_two_distinct_ideas_are_not_deduped(_inbox_sandbox):
    """回归：纯想法 url/excerpt 皆空，若去重不看 note 会静默丢掉第二个想法。"""
    inbox_service.add({"note": "想法一"})
    inbox_service.add({"note": "想法二"})
    notes = [x["note"] for x in inbox_service.list_items()]
    assert sorted(notes) == ["想法一", "想法二"]


def test_inbox_same_idea_twice_is_deduped(_inbox_sandbox):
    inbox_service.add({"note": "手抖提交两次"})
    r = inbox_service.add({"note": "手抖提交两次"})
    assert r.get("deduped") is True
    assert len(inbox_service.list_items()) == 1


def test_inbox_concurrent_adds_lose_nothing(_inbox_sandbox):
    """回归：ThreadingHTTPServer 下并发 add（前端 _flush 并行补推 / 扩展连点）。

    加锁前的失效模式有两种，都出现过：
      ① 两写者抢同一个 `.tmp`，后 os.replace 找不到源 → 返回"写入失败"(HTTP 400)；
      ② 各自读到旧列表再覆写 → **静默丢条目**（更危险，用户以为存上了）。
    """
    import threading as _th

    N = 25
    errors = []

    def worker(i):
        r = inbox_service.add({"note": "并发第%d条" % i})
        if not r.get("ok"):
            errors.append(r)

    ts = [_th.Thread(target=worker, args=(i,)) for i in range(N)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()

    assert errors == [], "并发写出现失败: %r" % (errors[:3],)
    notes = {x["note"] for x in inbox_service.list_items()}
    assert len(notes) == N, "并发丢条目：期望 %d 条，实到 %d" % (N, len(notes))
    ids = [x["id"] for x in inbox_service.list_items()]
    assert len(set(ids)) == len(ids), "并发产生了重复 id"


def test_inbox_no_tmp_residue_after_concurrent_writes(_inbox_sandbox):
    import threading as _th
    ts = [_th.Thread(target=inbox_service.add, args=({"note": "t%d" % i},)) for i in range(10)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    d = os.path.dirname(_inbox_sandbox)
    assert not [f for f in os.listdir(d) if ".tmp" in f], "并发写后残留 tmp 文件"


# ---------- Hacker News 源（OpenCLI 取数层）----------
from backend.pipeline import fetch_hacker_news  # noqa: E402
from backend.pipeline import export_data  # noqa: E402


def test_hn_build_maps_columns_to_unified_items(monkeypatch):
    # 喂假 OpenCLI 行对象，验证映射成本仓统一 item {title,summary,url,source}
    rows = [
        {"rank": 1, "id": 111, "title": "Show HN: cool thing", "score": 240,
         "author": "pg", "comments": 88, "url": "https://example.com/x"},
        {"rank": 2, "id": 222, "title": "Ask HN: no url", "score": 12,
         "author": "alice", "comments": 3, "url": ""},          # 无 url -> 回退 HN 讨论页
        {"rank": 3, "id": 333, "title": "", "score": 5, "author": "bob",
         "comments": 0, "url": "https://drop.me"},               # 无标题 -> 丢弃
    ]
    monkeypatch.setattr(fetch_hacker_news, "fetch", lambda: rows)
    out = fetch_hacker_news.build()
    assert out["count"] == 2                                     # 空标题被丢
    assert out["source"].startswith("Hacker News")
    it0, it1 = out["items"]
    assert it0["title"] == "Show HN: cool thing"
    assert it0["url"] == "https://example.com/x"
    assert it0["source"] == "Hacker News"
    assert "▲240" in it0["summary"] and "pg" in it0["summary"] and "88" in it0["summary"]
    assert it1["url"] == "https://news.ycombinator.com/item?id=222"  # 回退


def test_hn_build_raises_when_no_valid_items(monkeypatch):
    monkeypatch.setattr(fetch_hacker_news, "fetch", lambda: [{"title": ""}])
    with pytest.raises(Exception):
        fetch_hacker_news.build()


# ---- 资讯源（Feed）表驱动回归：一份参数化覆盖全部 7 源 ----
# 此前是逐源手写 8 个近同构测试、只覆盖 5 源（aiDaily/dailyNews 零覆盖）。
# 现在遍历 feeds.FEEDS，加新源即自动纳入；骨架逻辑见 backend/pipeline/feeds.py。
from backend.pipeline.feeds import FEEDS, HISTORY_DAYS  # noqa: E402

# key -> export_data 里的 getter 名（productHunt 的函数名没有下划线，故显式写表）
FEED_GETTERS = {
    "aiDaily": "get_ai_daily", "dailyNews": "get_daily_news",
    "hackerNews": "get_hacker_news", "githubTrending": "get_github_trending",
    "productHunt": "get_producthunt", "sspai": "get_sspai", "x": "get_x",
}


def _feed_payload(spec, date_s, title):
    d = {"date": date_s, "fetchedAt": date_s + " 10:00", "count": 1,
         spec.kind: [{"title": title}], "canonical": spec.canonical}
    if spec.source:
        d["source"] = spec.source
    return d


def test_feed_table_matches_getters():
    # 加了新资讯源却忘了配 getter（或反之）→ 这里红，不会等到线上才发现
    assert set(FEED_GETTERS) == set(FEEDS)


@pytest.mark.parametrize("key", list(FEEDS))
def test_feed_accumulates_history(key, tmp_path, monkeypatch):
    spec = FEEDS[key]
    src, data = tmp_path / "src.json", tmp_path / "data.json"
    data.write_text(json.dumps({key: {"history": [
        {"date": "2026-09-06", "count": 1, spec.kind: [{"title": "old"}]},
    ]}}), encoding="utf-8")
    src.write_text(json.dumps(_feed_payload(spec, "2026-09-07", "new")), encoding="utf-8")
    monkeypatch.setattr(export_data, spec.path_attr, str(src))
    monkeypatch.setattr(export_data, "DATA_JSON", str(data))
    out = getattr(export_data, FEED_GETTERS[key])()
    assert [h["date"] for h in out["history"]] == ["2026-09-07", "2026-09-06"]  # 新日份在前
    assert out["count"] == 1 and out[spec.kind][0]["title"] == "new"


@pytest.mark.parametrize("key", list(FEEDS))
def test_feed_missing_file_is_safe(key, tmp_path, monkeypatch):
    # 抓取器没跑过 / 依赖缺失（OpenCLI、grok-cli…）→ 空壳、不抛，不影响其余源（优雅劣化）
    spec = FEEDS[key]
    monkeypatch.setattr(export_data, spec.path_attr, str(tmp_path / "nope.json"))
    monkeypatch.setattr(export_data, "DATA_JSON", str(tmp_path / "nodata.json"))
    out = getattr(export_data, FEED_GETTERS[key])()
    assert out["count"] == 0 and out[spec.kind] == [] and out["history"] == []
    assert out["canonical"] == spec.canonical


def test_feed_history_upserts_same_day_and_caps(tmp_path, monkeypatch):
    # 同一天重复抓 → 覆盖不追加；历史只留最近 HISTORY_DAYS 个日份
    spec = FEEDS["hackerNews"]
    src, data = tmp_path / "src.json", tmp_path / "data.json"
    old_hist = [{"date": "2026-08-%02d" % (d + 1), "count": 1, "items": []} for d in range(20)]
    old_hist.append({"date": "2026-09-07", "count": 99, "items": [{"title": "旧的同一天"}]})
    data.write_text(json.dumps({"hackerNews": {"history": old_hist}}), encoding="utf-8")
    src.write_text(json.dumps(_feed_payload(spec, "2026-09-07", "新的同一天")), encoding="utf-8")
    monkeypatch.setattr(export_data, spec.path_attr, str(src))
    monkeypatch.setattr(export_data, "DATA_JSON", str(data))
    hist = getattr(export_data, FEED_GETTERS["hackerNews"])()["history"]
    assert len(hist) == HISTORY_DAYS == 14  # 「留最近 14 天」是产品决定，连常量值一起钉住
    assert [h["date"] for h in hist].count("2026-09-07") == 1  # upsert，不是追加
    assert hist[0]["items"][0]["title"] == "新的同一天"  # 留下的是新抓的那份


def test_opencli_cmd_none_when_unconfigured(monkeypatch):
    # 未配置任何来源时应返回 None，抓取器据此优雅跳过
    from backend.core import config as wb_config
    monkeypatch.delenv("WB_OPENCLI_CMD", raising=False)
    monkeypatch.setattr(wb_config, "_LOCAL", {})
    monkeypatch.setattr(wb_config.shutil, "which", lambda _n: None)
    assert wb_config.opencli_cmd() is None


def test_opencli_cmd_parses_string_and_list(monkeypatch):
    from backend.core import config as wb_config
    monkeypatch.setenv("WB_OPENCLI_CMD", "node /p/main.js")
    assert wb_config.opencli_cmd() == ["node", "/p/main.js"]
    monkeypatch.delenv("WB_OPENCLI_CMD", raising=False)
    monkeypatch.setattr(wb_config, "_LOCAL", {"opencliCmd": ["opencli", "--x"]})
    assert wb_config.opencli_cmd() == ["opencli", "--x"]


# ---------- GitHub Trending 源（OpenCLI 取数层，镜像 HN）----------
from backend.pipeline import fetch_github_trending  # noqa: E402


def test_gt_build_maps_columns_to_unified_items(monkeypatch):
    rows = [
        {"rank": 1, "repo": "microsoft/markitdown", "description": "files to Markdown",
         "language": "Python", "stars": 180479, "forks": 13271, "starsSince": 886,
         "url": "https://github.com/microsoft/markitdown"},
        {"rank": 2, "repo": "owner/no-url", "description": "", "language": "",
         "stars": 12, "forks": 0, "starsSince": 0, "url": ""},          # 无 url -> 由 repo 拼
        {"rank": 3, "repo": "", "description": "x", "stars": 5, "url": "u"},  # 无 repo -> 丢弃
    ]
    monkeypatch.setattr(fetch_github_trending, "fetch", lambda: rows)
    out = fetch_github_trending.build()
    assert out["count"] == 2                                            # 空 repo 被丢
    assert out["source"].startswith("GitHub Trending")
    it0, it1 = out["items"]
    assert it0["title"] == "microsoft/markitdown"
    assert it0["url"] == "https://github.com/microsoft/markitdown"
    assert it0["source"] == "GitHub Trending"
    assert "180,479" in it0["summary"] and "886" in it0["summary"] and "Python" in it0["summary"]
    assert it1["url"] == "https://github.com/owner/no-url"             # 无 url 由 repo 兜底


def test_gt_build_raises_when_no_valid_items(monkeypatch):
    monkeypatch.setattr(fetch_github_trending, "fetch", lambda: [{"repo": ""}])
    with pytest.raises(Exception):
        fetch_github_trending.build()


from backend.pipeline import fetch_producthunt  # noqa: E402
from backend.pipeline import fetch_sspai  # noqa: E402

_ATOM_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Product Hunt</title>
  <entry>
    <title>Diiverge</title>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/diiverge"/>
    <content type="html">&lt;p&gt;Turn any picture into a playable AI adventure&lt;/p&gt;&lt;p&gt;&lt;a href="x"&gt;Discussion&lt;/a&gt; | &lt;a href="y"&gt;Link&lt;/a&gt;&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>NoLink Product</title>
    <content type="html">&lt;p&gt;just a tagline&lt;/p&gt;</content>
  </entry>
</feed>"""

_RSS_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>少数派</title><link>https://sspai.com</link>
<item><title>派早报：某某发布</title><link>https://sspai.com/post/1</link>
<description>摘要正文。&lt;a href="https://sspai.com/post/1"&gt;查看全文&lt;/a&gt;</description></item>
<item><title>一图流</title><link>https://sspai.com/post/2</link><description>看点回顾</description></item>
</channel></rss>"""


def test_parse_feed_atom_maps_title_altlink_and_strips_html():
    rows = wb_common.parse_feed(_ATOM_SAMPLE, limit=20)
    assert len(rows) == 2
    r0 = rows[0]
    assert r0["title"] == "Diiverge"
    assert r0["url"] == "https://www.producthunt.com/products/diiverge"  # rel=alternate href
    assert r0["summary"] == "Turn any picture into a playable AI adventure"  # 标签/Discussion|Link 已剥
    assert "Discussion" not in r0["summary"] and "<" not in r0["summary"]


def test_parse_feed_rss_maps_title_link_and_strips_readmore():
    rows = wb_common.parse_feed(_RSS_SAMPLE, limit=20)
    assert len(rows) == 2
    r0 = rows[0]
    assert r0["title"] == "派早报：某某发布"
    assert r0["url"] == "https://sspai.com/post/1"  # RSS <link> 文本
    assert r0["summary"] == "摘要正文。"  # "查看全文" 与 <a> 已剥
    assert "查看全文" not in r0["summary"]


def test_parse_feed_bad_xml_is_safe():
    assert wb_common.parse_feed("not xml at all") == []
    assert wb_common.parse_feed("") == []


def test_producthunt_build_maps_to_unified_items(monkeypatch):
    monkeypatch.setattr(fetch_producthunt.wb_common, "http_get_text", lambda *a, **k: _ATOM_SAMPLE)
    out = fetch_producthunt.build()
    assert out["count"] == 2
    assert out["source"].startswith("Product Hunt")
    it0 = out["items"][0]
    assert it0["title"] == "Diiverge" and it0["source"] == "Product Hunt"
    assert it0["url"].endswith("/diiverge")


def test_producthunt_build_raises_when_empty(monkeypatch):
    monkeypatch.setattr(fetch_producthunt.wb_common, "http_get_text", lambda *a, **k: "<feed></feed>")
    with pytest.raises(Exception):
        fetch_producthunt.build()


def test_sspai_build_maps_to_unified_items(monkeypatch):
    monkeypatch.setattr(fetch_sspai.wb_common, "http_get_text", lambda *a, **k: _RSS_SAMPLE)
    out = fetch_sspai.build()
    assert out["count"] == 2
    assert out["source"].startswith("少数派")
    assert out["items"][0]["source"] == "少数派"
    assert out["items"][0]["url"] == "https://sspai.com/post/1"


def test_kb_module_whitelist_includes_teardown():
    # 产品拆解沉淀线：module 与 source 均已进白名单（否则 kb.save 报错）
    assert "产品拆解" in kb_service.MODULES
    assert "teardown" in kb_service.SOURCES


# ---------- X/推特取数引擎 grok.py 的纯解析（无 subprocess、无网络，见 ADR 0012） ----------
from backend.clients import grok as grok_client


def test_grok_extract_text_shapes():
    # 直接文本字段
    assert grok_client._extract_text({"type": "result", "result": "hi"}) == "hi"
    assert grok_client._extract_text({"text": "world"}) == "world"
    # assistant/message.content 块数组
    ev = {"type": "assistant",
          "message": {"content": [{"type": "text", "text": "a"}, {"type": "tool_use"}, {"type": "text", "text": "b"}]}}
    assert grok_client._extract_text(ev) == "a\nb"
    # 裸字符串 / 未知事件
    assert grok_client._extract_text("raw line") == "raw line"
    assert grok_client._extract_text({"type": "noise"}) == ""


def test_grok_parse_posts_plain_array():
    text = '[{"title":"t1","url":"https://x.com/a","summary":"s1"},{"title":"t2","url":"","summary":"s2"}]'
    posts = grok_client._parse_posts(text, 20)
    assert len(posts) == 2
    assert posts[0] == {"title": "t1", "summary": "s1", "url": "https://x.com/a"}


def test_grok_parse_posts_strips_fence_and_prose():
    text = "好的，结果如下：\n```json\n[{\"title\":\"x\",\"url\":\"u\",\"summary\":\"y\"}]\n```\n完毕"
    posts = grok_client._parse_posts(text, 20)
    assert posts == [{"title": "x", "summary": "y", "url": "u"}]


def test_grok_parse_posts_respects_limit_and_skips_empty():
    text = '[{"title":"a"},{"title":"","summary":""},{"title":"b"},{"title":"c"}]'
    posts = grok_client._parse_posts(text, 2)
    assert [p["title"] for p in posts] == ["a", "b"]  # 空项被跳过、超限截断


def test_grok_parse_posts_raises_without_array():
    with pytest.raises(ValueError):
        grok_client._parse_posts("这里没有任何 JSON 数组", 20)
    with pytest.raises(ValueError):
        grok_client._parse_posts("[]", 20)  # 空数组 = 无有效帖子


def test_grok_configured_gating(monkeypatch):
    monkeypatch.setattr(grok_client.wb_config, "grok_cmd", lambda: None)
    monkeypatch.setattr(grok_client.wb_config, "grok_api_key", lambda: "")
    assert grok_client.configured() is False
    with pytest.raises(RuntimeError):
        grok_client.search_x("test")  # 未配置 → 抛异常，供上游优雅跳过
    monkeypatch.setattr(grok_client.wb_config, "grok_cmd", lambda: ["grok"])
    monkeypatch.setattr(grok_client.wb_config, "grok_api_key", lambda: "k")
    assert grok_client.configured() is True

# ---------- vault_backup（Obsidian 库自动备份） ----------
from backend.pipeline import vault_backup  # noqa: E402


def _git_sandbox(tmp_path):
    """造一个最小 git 仓当假 vault（绝不碰真实 Obsidian 库）。"""
    import subprocess
    v = tmp_path / "vault"
    v.mkdir()
    for args in (["init", "-q"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]):
        subprocess.run(["git", "-C", str(v)] + args, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return v


def test_vault_backup_commits_then_is_idempotent(tmp_path, monkeypatch):
    v = _git_sandbox(tmp_path)
    monkeypatch.setattr(vault_backup, "LOG", str(tmp_path / "bk.log"))
    (v / "笔记.md").write_text("hello", encoding="utf-8")
    assert vault_backup.backup(str(v)) == 0          # 有变更 → 提交
    assert vault_backup.backup(str(v)) == 1          # 再跑一次 → 无变更，不空转提交


def test_vault_backup_refuses_non_git_dir(tmp_path, monkeypatch):
    """在可能含凭据的目录里自动 git init 是危险动作，必须拒绝而不是好心帮忙。"""
    monkeypatch.setattr(vault_backup, "LOG", str(tmp_path / "bk.log"))
    plain = tmp_path / "plain"
    plain.mkdir()
    assert vault_backup.backup(str(plain)) == 2
    assert not (plain / ".git").exists()
    assert vault_backup.backup(str(tmp_path / "不存在")) == 2

# ---------- usage 埋点（ADR 0015：尺子本身也要经得起追问） ----------
from backend.clients import usage as usage_service  # noqa: E402


def _usage_sandbox(tmp_path, monkeypatch):
    fp = tmp_path / "usage.local.jsonl"
    monkeypatch.setattr(usage_service.wb_config, "usage_path", lambda: str(fp))
    return fp


def _rows(fp):
    return [json.loads(x) for x in fp.read_text(encoding="utf-8").splitlines() if x.strip()]


def test_usage_rejects_unknown_event_with_no_side_effect(tmp_path, monkeypatch):
    fp = _usage_sandbox(tmp_path, monkeypatch)
    assert usage_service.track({"ev": "页面加载", "cid": "a1"})["ok"] is False
    assert usage_service.track({})["ok"] is False
    assert not fp.exists()          # 拒了就该一个字节都不落盘


def test_usage_drops_free_text_fields(tmp_path, monkeypatch):
    """隐私红线的回归钉：复盘正文/URL 这类自由文本一律不得进日志。"""
    fp = _usage_sandbox(tmp_path, monkeypatch)
    usage_service.track({"ev": "review_save", "cid": "a1",
                         "text": "今天心情很差，和某某吵架了", "url": "https://x.com/secret",
                         "k": "不该被记的键"})
    r = _rows(fp)[0]
    assert set(r) == {"at", "day", "ev", "cid"}     # k 只对 recall_/kb_/distill_ 生效
    assert "吵架" not in json.dumps(r, ensure_ascii=False)


def test_usage_app_use_deduped_per_day_but_others_not(tmp_path, monkeypatch):
    fp = _usage_sandbox(tmp_path, monkeypatch)
    for _ in range(3):
        usage_service.track({"ev": "app_use", "cid": "a1"})
    usage_service.track({"ev": "app_use", "cid": "b2"})      # 另一台设备照记
    for _ in range(2):
        usage_service.track({"ev": "todo_add", "cid": "a1"})  # 真手势不去重
    evs = [r["ev"] + ":" + r["cid"] for r in _rows(fp)]
    assert evs == ["app_use:a1", "app_use:b2", "todo_add:a1", "todo_add:a1"]


def test_usage_server_stamps_day_and_keeps_recall_key(tmp_path, monkeypatch):
    """day 由服务端盖戳（前端时区不可信）；recall_* 才保留卡路径。"""
    fp = _usage_sandbox(tmp_path, monkeypatch)
    usage_service.track({"ev": "recall_open", "cid": "a1", "k": "蒸馏库/2026-09-01/x.md",
                         "day": "1999-01-01"})
    r = _rows(fp)[0]
    assert r["day"] == datetime.now().strftime("%Y-%m-%d")
    assert r["k"] == "蒸馏库/2026-09-01/x.md"


def test_usage_read_events_filters_since_and_skips_bad_lines(tmp_path, monkeypatch):
    fp = _usage_sandbox(tmp_path, monkeypatch)
    fp.write_text('{"day":"2026-09-01","ev":"app_use"}\n坏行\n{"day":"2026-09-20","ev":"app_use"}\n',
                  encoding="utf-8")
    assert len(usage_service.read_events()) == 2
    assert [e["day"] for e in usage_service.read_events("2026-09-10")] == ["2026-09-20"]


def test_usage_report_excludes_selftest_and_ghost_cards(tmp_path, monkeypatch):
    """真卡流量不能被自测卡和幽灵卡刷高——否则这把尺子自己就在作弊。"""
    from backend.pipeline import usage_report
    _usage_sandbox(tmp_path, monkeypatch)
    deposit = tmp_path / "vault" / "沉淀"
    (deposit / "蒸馏库").mkdir(parents=True)
    (deposit / "蒸馏库" / "真.md").write_text("x", encoding="utf-8")
    M = "蒸馏库"
    rows = [{"savedAt": "2026-09-20T10:00:00", "module": M, "title": "真卡", "relPath": "蒸馏库/真.md"},
            {"savedAt": "2026-09-20T10:00:00", "module": M, "title": "【MCP测试】自测", "relPath": "蒸馏库/真.md"},
            {"savedAt": "2026-09-20T10:00:00", "module": M, "title": "幽灵", "relPath": "蒸馏库/没了.md"},
            {"savedAt": "2026-09-20T10:00:00", "module": "产品拆解", "title": "拆解", "relPath": "蒸馏库/真.md"}]
    (deposit / "_index.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows), encoding="utf-8")
    monkeypatch.setattr(usage_report.wb_config, "kb", lambda: (str(tmp_path / "vault"), str(deposit)))
    assert usage_report._real_cards("2026-09-01") == (1, 1)     # 蒸馏库：1 张真卡 + 1 条幽灵
    assert usage_report._real_cards("2026-09-01", module=None)[0] == 2   # 含产品拆解
    assert usage_report._real_cards("2026-09-25") == (0, 1)     # 区间外不计入流量


def test_usage_report_max_window_counts_days_not_events():
    from backend.pipeline import usage_report
    assert usage_report._max_window([]) == 0
    assert usage_report._max_window(["2026-09-01", "2026-09-02", "2026-09-09"]) == 2
    assert usage_report._max_window(["2026-09-0%d" % i for i in range(1, 6)]) == 5

def test_usage_report_sync_health_parses_real_log_marker(tmp_path, monkeypatch):
    """日志收尾行的措辞若和报表里的匹配串对不上，这个数会永远是 0 而没人发现。"""
    from backend.pipeline import usage_report
    monkeypatch.setattr(usage_report, "ROOT", str(tmp_path))
    (tmp_path / "data.json").write_text(
        json.dumps({"sync": {"lastRun": "2026-09-20T15:03:44", "status": "ok"}}), encoding="utf-8")
    log = tmp_path / "backend" / "pipeline"
    log.mkdir(parents=True)
    (log / "local_refresh.log").write_text(
        "[2026-09-19 10:00:00] ===== local refresh end (ok=True) =====\n"
        "[2026-09-20 15:03:44] ===== local refresh end (ok=True) =====\n"
        "[2026-09-20 16:00:00] ===== local refresh end (ok=False) =====\n"   # 失败的不算
        "[2026-08-01 10:00:00] ===== local refresh end (ok=True) =====\n",   # 区间外不算
        encoding="utf-8")
    last, hours, runs = usage_report._sync_health("2026-09-01")
    assert last == "2026-09-20T15:03:44" and runs == 2 and hours is not None


# ---------- 工作构成（注意力预算：一人项目的「成本管理」这一格） ----------
def test_work_mix_classifies_conventional_commit_types():
    """i18n 这类带数字的 type 曾被 isalpha() 扫进「其它」——这条是那次的回归锁。"""
    from backend.pipeline import usage_report
    got = usage_report.classify_commits([
        "feat(usage): 埋点",
        "feat: 无 scope 也认",
        "chore(skills)!: 破坏性标记不该吃掉 type",
        "docs: 文档",
        "i18n(app): 带数字的 type 要保住",
        "Initial snapshot from upstream main",   # 没冒号 → 不硬猜
        "",                                      # 空行不计数
    ])
    assert got == {"feat": 2, "chore": 1, "docs": 1, "i18n": 1, "其它": 1}


def test_work_mix_ratio_and_empty_window():
    from backend.pipeline import usage_report
    total, meta, ratio = usage_report.meta_ratio({"docs": 5, "chore": 1, "feat": 3, "fix": 1})
    assert (total, meta) == (10, 6) and round(ratio, 2) == 0.6
    assert usage_report.meta_ratio({}) == (0, 0, None)    # 0 条提交是「没得算」，不是 0%


def test_work_mix_warns_only_over_half_and_never_fails():
    """只提示不判红——判红会变成新的假绿动力（同宪章禁 `|| true`）。"""
    from backend.pipeline import usage_report
    over = "\n".join(usage_report.format_mix({"docs": 6, "feat": 4}, "2026-09-14"))
    under = "\n".join(usage_report.format_mix({"docs": 4, "feat": 6}, "2026-09-14"))
    empty = "\n".join(usage_report.format_mix({}, "2026-09-14"))
    assert "60%" in over and "⚠" in over
    assert "40%" in under and "✓" in under and "⚠" not in under
    assert "没有提交" in empty


def test_work_mix_survives_missing_git(monkeypatch):
    """拿不到 git 历史时报表要照常出，不能整条挂掉。"""
    from backend.pipeline import usage_report
    monkeypatch.setattr(usage_report, "ROOT", "/nonexistent-path-for-test")
    assert usage_report._git_subjects("2026-09-01") is None


# ---------- 项目进度解析（ADR 0016：页面上零手打数字，解析错了必须看得出来） ----------
from backend.clients import progress as progress_svc  # noqa: E402

_BOARD_MD = """# 作战板 · 测试期

## ⓪ 计划总表

### 层一 · 项目阶段（方向）

| 阶段 | 内容 | 门性 | 状态 | 完成日 / 依赖 |
|---|---|---|---|---|
| Phase 1 | 甲 | 双向门 | ✅ | 2026-08-31 |
| Phase 2 | 乙 | 双向门 | 🔧 | 半拉子 |

### 层二 · 当期四周（执行）

| 周 | 区间 | 计划内容 | 周门 | 状态 |
|---|---|---|---|---|
| W0 | 09-20 → 09-22 | 清障碍 | 6 条全绿 | 🔧 2/6 |
| W1 | 09-23 → 09-29 | 契约 | ≥4 天 | ⏳ |

## ① 本期承诺

随便写点什么，不该被解析成表。

## ② 出口门禁

- [x] **1 · 甲** — 验收：已办
- [~] **2 · 乙** — 验收：半拉
- [ ] **3 · 丙** — 验收：没动
- [-] **4 · 丁** — 放弃：不做了

## ③ 本周任务

- [x] T1 干完了
- [ ] T2 没干

## ④ 风险与假设登记册

| # | 风险 / 假设 | 触发信号 | 应对 | 状态 |
|---|---|---|---|---|
| 1 | 会翻车 | 翻了 | 扶起来 | 🔴 |

## ⑤ 偏离记录

| 时间 | 做了什么 / 发生了什么 | 为什么 |
|---|---|---|
| 09-21 | 插了一件计划外的 | 用户要 |
"""


def _write(tmp_path, name, text):
    f = tmp_path / name
    f.write_text(text, encoding="utf-8")
    return str(f)


def test_progress_board_counts_four_checkbox_states_and_reads_both_tables(tmp_path):
    p = _write(tmp_path, "作战板-测试.md", _BOARD_MD)
    b = progress_svc.parse_board(p)
    assert b["ok"] is True
    assert b["gate"] == dict(b["gate"], done=1, doing=1, open=1, dropped=1, total=4, pct=25)
    assert b["task"]["done"] == 1 and b["task"]["total"] == 2
    assert [r["阶段"] for r in b["phases"]] == ["Phase 1", "Phase 2"]
    assert [r["周"] for r in b["weeks"]] == ["W0", "W1"]
    assert len(b["risks"]) == 1 and b["deviations"] == 1


def test_progress_status_taken_by_column_name_not_position(tmp_path):
    """阶段表的「状态」不是最后一列——首版按 r[-1] 取，四行状态全 None。"""
    p = _write(tmp_path, "作战板-测试.md", _BOARD_MD)
    b = progress_svc.parse_board(p)
    assert [r["_status"] for r in b["phases"]] == ["ok", "doing"]
    assert [r["_status"] for r in b["weeks"]] == ["doing", "wait"]


def test_progress_picks_right_table_when_section_has_several(tmp_path):
    """一个小节里有多张表时不能按位置取第一张——周五仪式那节就是四问表在前。"""
    md = ("## 2 · 周五 15 分钟仪式 · 四问\n\n"
          "| # | 问 | 怎么答 |\n|---|---|---|\n| 1 | 这周使用量 | 粘表 |\n\n"
          "| 周 | 区间 | 门 | 结果 |\n|---|---|---|---|\n"
          "| W1 | 09-23 → 09-29 | ≥4 天 | 过 |\n| W2 | 09-30 → 10-06 | ≥4 天 | |\n")
    w = progress_svc.parse_weekly(_write(tmp_path, "周表.md", md))
    assert w["ok"] is True
    assert [x["week"] for x in w["weeks"]] == ["W1", "W2"]
    assert w["judged"] == 1 and w["passed"] == 1


def test_progress_refuses_to_guess_when_header_changed(tmp_path):
    """表头被改 → 返回 None + note。**绝不静默填 0**——页面说谎正是砍掉上批遥测视图的原因。"""
    md = _BOARD_MD.replace("| 阶段 | 内容 | 门性 | 状态 | 完成日 / 依赖 |",
                           "| 阶段 | 内容 | 状态 |")
    b = progress_svc.parse_board(_write(tmp_path, "作战板-测试.md", md))
    assert b["phases"] is None
    assert "表头" in b["phasesNote"] or "未找到" in b["phasesNote"]
    assert b["weeks"] is not None          # 另一张表不受影响


def test_progress_missing_files_degrade_not_raise(tmp_path):
    assert progress_svc.parse_board(str(tmp_path / "没有.md"))["ok"] is False
    assert progress_svc.parse_ledger(str(tmp_path / "没有.md"))["ok"] is False
    assert progress_svc.parse_weekly(str(tmp_path / "没有.md"))["ok"] is False


def test_progress_ledger_completion_excludes_cut_items(tmp_path):
    md = ("## 4 · 一眼看盘\n\n| 状态 | 条数 | 编号 |\n|---|---|---|\n"
          "| ✅ 完成可用 | 16 | … |\n| 🔧 部分可用 | 3 | … |\n| 🚧 未开始 | 3 | … |\n"
          "| ⏸ 推迟 | 1 | … |\n| ✂ 已砍 | 6 | … |\n| **合计** | **29** | |\n")
    d = progress_svc.parse_ledger(_write(tmp_path, "台账.md", md))
    assert (d["done"], d["cut"], d["total"], d["denom"], d["pct"]) == (16, 6, 29, 23, 70)


def test_progress_deadline_days_crosses_month():
    from datetime import date
    assert progress_svc.deadline_days("2026-10-17", date(2026, 9, 21)) == 26
    assert progress_svc.deadline_days("2026-10-17", date(2026, 10, 18)) == -1
    assert progress_svc.deadline_days("不是日期") is None


# ---------- 防烂保险（ADR 0016）：表头是契约，改坏了必须红 ----------
def test_progress_parses_the_current_real_board():
    """直接解析**真实的当期作战板**——改坏表头 pytest 就红。

    这是「表头是契约」的 CI 硬门禁，不靠人记得。只断言表头与三段非空，
    **不断言具体数值**：内容随便改，改表头才红（否则改文档要改测试，摩擦太大）。
    10-17 若整条线被放弃线删掉，本测试随之删。
    """
    from backend.core import config as wb_config
    p = wb_config.board_path()
    if not p:
        pytest.skip("当期没有作战板（整条线可能已按放弃线删除）")
    b = progress_svc.parse_board(p)
    assert b["ok"] is True, b.get("note")
    assert b["phases"] is not None, "§⓪ 层一表头被改坏：%s" % b.get("phasesNote")
    assert b["weeks"] is not None, "§⓪ 层二表头被改坏：%s" % b.get("weeksNote")
    assert b["gate"] and b["gate"]["total"] > 0, "§② 出口门禁读不到勾选框"
    assert b["deadline"], "作战板头部缺「对表日：YYYY-MM-DD」——页面倒计时会退回兜底"
    assert b["weeklyPath"], "作战板头部缺「周表：[..](..)」链接——周门段会读不到"


def test_board_path_only_accepts_period_named_boards(tmp_path, monkeypatch):
    """模板/归档不能被当成当期板。

    中文「模板」的码位高于数字，早先用 sorted(glob("作战板-*.md"))[-1] 时
    `作战板-模板.md` 会排在 `作战板-2026-09.md` 后面被选中。
    """
    from backend.core import config as wb_config
    plan = tmp_path / ".claude" / "plan"
    plan.mkdir(parents=True)
    for name in ["作战板-2026-09.md", "作战板-2026-10.md", "作战板-模板.md", "作战板-草稿.md"]:
        (plan / name).write_text("# x", encoding="utf-8")
    monkeypatch.setattr(wb_config, "ROOT", str(tmp_path))
    monkeypatch.delenv("WB_BOARD_PATH", raising=False)
    monkeypatch.setattr(wb_config, "_LOCAL", {}, raising=False)
    assert os.path.basename(wb_config.board_path()) == "作战板-2026-10.md"


def test_progress_takes_deadline_and_weekly_from_board_not_from_code(tmp_path):
    """对表日与周表路径都来自板子——代码里写死过一次，换期即烂。"""
    board = tmp_path / "作战板-2026-11.md"
    board.write_text(
        "# 作战板 · 下一期\n\n"
        "> 建板：2026-10-18　对表日：**2026-11-14**\n"
        "> 周表：[周表.md](周表.md)\n\n"
        "## ② 出口门禁\n\n- [ ] **1 · 甲** — 验收：x\n", encoding="utf-8")
    (tmp_path / "周表.md").write_text(
        "## 2 · 周五 15 分钟仪式\n\n| 周 | 区间 | 门 | 结果 |\n|---|---|---|---|\n"
        "| W1 | 11-01 → 11-07 | ≥4 天 | |\n", encoding="utf-8")
    b = progress_svc.parse_board(str(board))
    assert b["deadline"] == "2026-11-14"
    assert b["weeklyPath"] == str(tmp_path / "周表.md")
    assert progress_svc.parse_weekly(b["weeklyPath"])["ok"] is True


def test_progress_deadline_marks_fallback_when_board_silent(tmp_path, monkeypatch):
    """板子没写对表日时，页面要能说「这是兜底值」，而不是假装准确。"""
    from backend.core import config as wb_config
    board = tmp_path / "作战板-2026-12.md"
    board.write_text("# 板\n\n## ② 出口门禁\n\n- [x] **1 · 甲** — 验收：y\n", encoding="utf-8")
    monkeypatch.setattr(wb_config, "board_path", lambda: str(board))
    snap = progress_svc.snapshot(fallback_deadline="2026-12-31")
    assert snap["deadline"]["source"] == "fallback"
    assert snap["deadline"]["date"] == "2026-12-31"
    snap2 = progress_svc.snapshot()
    assert snap2["deadline"]["source"] == "none" and snap2["deadline"]["daysLeft"] is None


# ---------- 进度视图写侧（只开 §⑤ 偏离 / §④ 风险，见 ADR 0016） ----------
def _board_sandbox(tmp_path, monkeypatch):
    """拿真实作战板的副本当沙箱——真板子绝不参与测试。"""
    from backend.core import config as wb_config
    src = wb_config.board_path()
    if not src:
        pytest.skip("当期没有作战板")
    dst = tmp_path / "作战板-2026-09.md"
    dst.write_text(open(src, encoding="utf-8").read(), encoding="utf-8")
    monkeypatch.setattr(wb_config, "board_path", lambda: str(dst))
    return str(dst)


def test_progress_deviation_escapes_pipes_and_round_trips(tmp_path, monkeypatch):
    """写进去的 `|` 必须能原样读回来。

    首版把 `|` 转义成 `\\|` 却没让解析器认这个转义，单元格被截断成「试写一条 \\」
    ——写得对、读不回，整张表还多一列。这条是那个 bug 的回归锁。
    """
    fp = _board_sandbox(tmp_path, monkeypatch)
    text = "摩擦 | 带竖线\n还带换行"
    r = progress_svc.add_deviation(text, "为什么 | 也带", expect_hash=progress_svc.board_hash())
    assert r["ok"] is True and r["changed"] is True
    b = progress_svc.parse_board(fp)
    assert b["deviationRows"][-1][1] == "摩擦 | 带竖线 还带换行"
    # 表没被撑坏：其它段照常解析
    assert b["phases"] and b["weeks"] and b["gate"]["total"] > 0 and len(b["risks"]) > 0


def test_progress_write_rejects_stale_hash(tmp_path, monkeypatch):
    """页面加载后文件被改过（多半是你在编辑器里动了）→ 宁可拒绝也不覆盖。"""
    _board_sandbox(tmp_path, monkeypatch)
    h0 = progress_svc.board_hash()
    assert progress_svc.add_deviation("第一条", expect_hash=h0)["ok"] is True
    r = progress_svc.add_deviation("拿旧 hash 再写", expect_hash=h0)
    assert r["ok"] is False and r["error"] == "stale"
    assert r["hash"] != h0          # 回传当前 hash，页面可据此刷新后重试


def test_progress_deviation_rejects_empty(tmp_path, monkeypatch):
    _board_sandbox(tmp_path, monkeypatch)
    assert progress_svc.add_deviation("", expect_hash=progress_svc.board_hash())["ok"] is False
    assert progress_svc.add_deviation("   \n ", expect_hash=progress_svc.board_hash())["ok"] is False


def test_progress_risk_status_whitelist_and_update(tmp_path, monkeypatch):
    fp = _board_sandbox(tmp_path, monkeypatch)
    assert progress_svc.set_risk_status("6", "💀", expect_hash=progress_svc.board_hash())["ok"] is False
    assert progress_svc.set_risk_status("999", "🟢", expect_hash=progress_svc.board_hash())["ok"] is False
    assert progress_svc.set_risk_status("6", "🟢", expect_hash=progress_svc.board_hash())["ok"] is True
    b = progress_svc.parse_board(fp)
    assert [r["状态"] for r in b["risks"] if r["#"] == "6"] == ["🟢"]
    assert len(b["risks"]) == 9 and b["gate"]["total"] == 6     # 别的行没被动


def test_progress_writes_never_touch_checkboxes(tmp_path, monkeypatch):
    """§②③ 勾选**刻意不开**——一键勾会架空 DoD 四款（指南 §3）。

    锁的是不变量而非命名：跑完所有被允许的写之后，勾选框逐字不变。
    将来若真要开勾选，得先改 ADR 0016 并想清楚怎么强制「一句可验证的验收事实」。
    """
    fp = _board_sandbox(tmp_path, monkeypatch)
    before = [ln for ln in open(fp, encoding="utf-8").read().splitlines()
              if re.match(r"^\s*-\s*\[[ x~-]\]", ln)]
    progress_svc.add_deviation("写一条偏离", "理由", expect_hash=progress_svc.board_hash())
    progress_svc.set_risk_status("6", "🟢", expect_hash=progress_svc.board_hash())
    after = [ln for ln in open(fp, encoding="utf-8").read().splitlines()
             if re.match(r"^\s*-\s*\[[ x~-]\]", ln)]
    assert before == after, "写操作动到了勾选框——§②③ 必须只能在编辑器里改"
    assert len(before) == 11          # §② 6 条 + §③ 5 条


# ---------- check_docs（文档门禁的解析器守卫） ----------
# 只测 parse_vocab / match_vocab：C1/C3/C4 是「对真仓库跑正则」，CI 那行 --check 就是
# 它们的测试。但 parse_vocab 有一个致命失败模式——静默失败 → 规则集为空 → 所有文件
# 都不违规 → 永远绿。这个 bug 在真仓库上表现为「通过」，CI 永远发现不了，必须测。

_VOCAB_MINI = """# mini
<!-- check_docs:vocab:begin -->
| 目录 | 位置 | 词 | 说明 |
|---|---|---|---|
| `.` | 尾 | `规范` | 治理 |
| `.` | 整名 | `README` | 标准名 |
| `adr/` | 正则 | `^\\d{4}-[a-z0-9]+(-[a-z0-9]+)*$` | 编号 |
| `design/` | 尾 | `设计` `评审` `准则` | 设计说明 |
| `planning/` | 首 | `复盘` `总览` | 复盘 |
| `guides/` | 尾 | `指南` | how-to |
| `reference/devhtml/` | 豁免 | `-` | 产物 |
<!-- check_docs:vocab:end -->
"""


def _spec_sandbox(tmp_path, body):
    (tmp_path / "docs").mkdir(exist_ok=True)
    (tmp_path / "docs" / "文档规范.md").write_text(body, encoding="utf-8")
    return str(tmp_path)


def test_parse_vocab_reads_table_and_positions(tmp_path):
    """五种位置都要解析出来，且「一格多词」要拆开。"""
    rules, errors = check_docs.parse_vocab(_spec_sandbox(tmp_path, _VOCAB_MINI))
    assert errors == []
    assert ("尾", "规范") in rules["."] and ("整名", "README") in rules["."]
    assert [p for p, _ in rules["adr/"]] == ["正则"]
    assert {w for _, w in rules["design/"]} == {"设计", "评审", "准则"}   # 一格三词拆开
    assert {p for p, _ in rules["planning/"]} == {"首"}
    assert rules["reference/devhtml/"] == [("豁免", "")]


def test_parse_vocab_fails_closed(tmp_path):
    """最重要的一条：解析不出词表时必须红，绝不能「空规则集 → 全绿」。"""
    # 哨兵缺失
    _, e1 = check_docs.parse_vocab(_spec_sandbox(tmp_path, "# 没有哨兵\n| a | b |\n"))
    assert e1 and "哨兵" in e1[0]
    # 真源文件不存在
    (tmp_path / "docs" / "文档规范.md").unlink()
    _, e2 = check_docs.parse_vocab(str(tmp_path))
    assert e2 and "不存在" in e2[0]
    # 规则数低于下限 → 判定为格式坏了
    thin = _VOCAB_MINI.split("| `.` | 尾")[0] + "| `.` | 尾 | `规范` | 治理 |\n" + \
        check_docs.VOCAB_END + "\n"
    rules, e3 = check_docs.parse_vocab(_spec_sandbox(tmp_path, thin))
    assert len(rules.get(".", [])) < check_docs.MIN_VOCAB_ROWS
    assert e3 and "fail closed" in e3[-1]
    # 且 report() 在有 vocab_errors 时不得给出「C2 全过」的假象
    r = check_docs.report(_spec_sandbox(tmp_path, thin))
    assert r["vocab_errors"] and r["naming"] == [] and r["copies"] == []


def test_parse_vocab_rejects_unknown_position(tmp_path):
    """位置列 typo 会悄悄关掉一条规则，比报错危险——必须报错，不许静默跳过。"""
    bad = _VOCAB_MINI.replace("| `guides/` | 尾 |", "| `guides/` | 末尾 |")
    rules, errors = check_docs.parse_vocab(_spec_sandbox(tmp_path, bad))
    assert any("末尾" in e for e in errors)
    assert "guides/" not in rules


def test_match_vocab_strips_serial_and_handles_prefix_form(tmp_path):
    """追认现状的三种真实形态：版本尾巴、期次尾巴、前缀词。"""
    rules, errors = check_docs.parse_vocab(_spec_sandbox(tmp_path, _VOCAB_MINI))
    assert errors == []
    m = lambda d, s: check_docs.match_vocab(d, s, rules)      # noqa: E731
    assert m("design/", "工作台走查评审-v0.8.0")               # 剥 -v0.8.0 → 尾词 评审
    assert m("planning/", "复盘-dogfood冲刺-W2-W4")            # 剥 -W2-W4 → 首词 复盘
    assert m("planning/", "复盘-项目自评打分-2026-09")          # 剥 -2026-09 → 首词 复盘
    assert m("planning/", "项目总览-需求与进度")                # 首段 项目总览 以 总览 结尾
    assert m("design/", "界面设计准则") and m("adr/", "0016-in-app-progress-view")
    assert m("reference/devhtml/", "ai-resume-diagrams.rendered")   # 豁免
    assert m("design/", "随手记") is None                      # 野文件必须抓到
    assert m("adr/", "0016-中文标题") is None                   # ADR 必须英文 kebab


# ---------- check_all（门禁聚合器）----------
# 注意：这些测试**绝不调用真门禁**——check_all 自己会跑 pytest，真调就递归了。
# 所以要么只查结构，要么把 GATES 换成秒回的替身。

def test_check_all_downstream_always_passes_check_flag():
    """下游一律带 --check —— 这是实测踩过的两个语义陷阱，必须锁死。

    · check_docs.py 无参是报告模式**恒退 0**：不带 --check 就是假绿；
    · bump_version.py 无参会**写盘**：在 pre-commit hook 里误调会改工作区。
    """
    by_key = {g[0]: g[2] for g in check_all.GATES}
    assert "--check" in by_key["docs"], "check_docs.py 不带 --check 会恒退 0（假绿）"
    assert "--check" in by_key["bump"], "bump_version.py 不带 --check 会写盘"
    assert "bump_version.py" in " ".join(by_key["bump"])


def test_check_all_gate_keys_unique_and_nonempty():
    keys = [g[0] for g in check_all.GATES]
    assert len(keys) == len(set(keys)) and all(keys)


def test_check_all_unknown_skip_fails_closed(capsys):
    """--skip 误拼必须红，而不是「没匹配上就当没排除」然后照常放行。"""
    assert check_all.main(["--check", "--skip=tscc"]) == 1
    assert "不存在的门禁" in capsys.readouterr().out


def _fake_gate(monkeypatch, cmd=None, probe=None):
    monkeypatch.setattr(check_all, "GATES",
                        [("fake", "替身门禁", cmd or [sys.executable, "-c", "pass"],
                          probe, True)])


def test_check_all_strict_treats_missing_tool_as_failure(monkeypatch, tmp_path):
    """--strict 下工具缺失 = 失败。禁 `|| true` 假绿（宪章维度三）。"""
    monkeypatch.setattr(check_all, "HERE", str(tmp_path))
    _fake_gate(monkeypatch, probe=lambda: False)
    assert check_all.main(["--check", "--strict"]) == 1     # 缺工具即红
    assert check_all.main(["--check"]) == 0                 # 不加 --strict 则只跳过


def test_check_all_failing_gate_sets_exit_and_records(monkeypatch, tmp_path):
    monkeypatch.setattr(check_all, "HERE", str(tmp_path))
    _fake_gate(monkeypatch, cmd=[sys.executable, "-c", "import sys;sys.exit(3)"])
    assert check_all.main(["--check"]) == 1
    # 报告模式恒退 0，但仍如实打印失败
    assert check_all.main([]) == 0
    rows = [json.loads(ln) for ln in
            open(os.path.join(str(tmp_path), check_all.HITS), encoding="utf-8")
            if ln.strip()]
    assert len(rows) == 2
    assert rows[0]["gate"] == "fake" and rows[0]["exit"] == 3 and rows[0]["ts"]


def test_check_all_record_survives_unwritable_dir(monkeypatch, tmp_path):
    """记账失败绝不能影响门禁结论——门禁是主业，记账是附带。"""
    monkeypatch.setattr(check_all, "HERE", str(tmp_path / "不存在的目录"))
    check_all.record("x", 1)        # 不抛异常即可


def test_check_all_stats_reports_zero_hit_gates(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(check_all, "HERE", str(tmp_path))
    with open(str(tmp_path / check_all.HITS), "w", encoding="utf-8") as f:
        f.write(json.dumps({"ts": "2026-09-22T00:00:00", "gate": "docs", "exit": 1}) + "\n")
        f.write("坏行，应被跳过而不是崩\n")
    assert check_all.main(["--stats"]) == 0
    out = capsys.readouterr().out
    assert "docs" in out and "1 次" in out
    # 零命中的门禁要被点名为「候选复核对象」，给 §3.0 反向判据当输入
    assert "从未拦下任何事故" in out
    # 但不能鼓励机械删除
    assert "零命中 != 无用" in out
