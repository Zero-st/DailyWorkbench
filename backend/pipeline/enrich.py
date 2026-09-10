# -*- coding: utf-8 -*-
"""资讯理解层：对各源 item 生成「一句话摘要 + 标签」并写入向量库（Zilliz）。

在 local_refresh 的 STEPS 里位于全部 fetch_* 之后、export_data 之前：读各源 *.json，
对**新条目**（按 id=sha1(url|title+source) 去重、命中缓存即跳过）批量调 chat 出摘要/标签、
调 embedding 出向量 upsert 进 Zilliz，回写 aiSummary/aiTags 到各源 *.json 供 export 透传。

第一性原理（见计划「图先行」）：
- 幂等/省钱：缓存(enrich_cache.json)按 id 记 摘要/标签/已embed；每轮成本 ∝ 新增数而非总数。
- 可降级：未配置 chat -> 整步跳过（保留原始 summary）；未配置 zilliz -> 只写摘要/标签、不做向量。
  任何异常都不抛出到管线（返回 0），沿用各 fetch 步骤「失败不阻断」语义。
- 成本护栏：每轮 chat/embedding 处理条数硬上限（config.enrich_limits），超限记日志并停。

守北极星：只用标准库；密钥全在 workbench.local.json。见 ADR 0011。
"""
import hashlib
import json
import os
import sys

from backend.core.paths import (
    ROOT, DATA_JSON, AI_DAILY_JSON, DAILY_NEWS_JSON, HACKER_NEWS_JSON,
    GITHUB_TRENDING_JSON, PRODUCTHUNT_JSON, SSPAI_JSON,
)
from backend.core import config as wb_config
from backend.clients import llm
from backend.clients import zilliz
from backend.utils import common as wb_common

CACHE = os.path.join(ROOT, "enrich_cache.json")

# (路径, 结构种类)：sections=AI 日报(分节), items=扁平 items
SOURCES = [
    (AI_DAILY_JSON, "sections"),
    (DAILY_NEWS_JSON, "items"),
    (HACKER_NEWS_JSON, "items"),
    (GITHUB_TRENDING_JSON, "items"),
    (PRODUCTHUNT_JSON, "items"),
    (SSPAI_JSON, "items"),
]

SYS_PROMPT = (
    "你是中文科技资讯编辑。给定若干条资讯（每条含 title、source，可能含 raw 原始摘要，"
    "raw 有时只是分数/评论数等元信息，仅供参考，请以 title 为主）。为每条产出："
    "summary=一句话中文摘要（不超过 50 字，客观陈述信息点，不要营销腔、不要以“本文/该”开头）；"
    "tags=2~4 个中文短标签（优先从：模型、开源、产品、安全、硬件、融资、研究、工具、行业、效率 中选，"
    "也可自拟贴切标签）。"
    "只输出一个 JSON 数组，每个元素形如 {\"i\": 序号, \"summary\": \"...\", \"tags\": [\"..\"]}，"
    "i 与输入的 i 一一对应，不要输出任何其它文字。"
)


def _id(item):
    url = (item.get("url") or "").strip()
    basis = url if url else ((item.get("title") or "") + "|" + (item.get("source") or ""))
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()


def _iter_items(doc, kind):
    """产出 doc 里所有 item 的引用（可原地改写）。"""
    if kind == "sections":
        for sec in doc.get("sections") or []:
            for it in sec.get("items") or []:
                yield it
    else:
        for it in doc.get("items") or []:
            yield it


def _load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _seed_cache_from_data_json(cache):
    """兜底：从上轮 data.json 已有的 aiSummary/aiTags 回补缓存（缓存文件丢失时不白跑）。"""
    d = _load_json(DATA_JSON)
    if not d:
        return
    for key in ("aiDaily", "dailyNews", "hackerNews", "githubTrending", "productHunt", "sspai"):
        blk = d.get(key) or {}
        kind = "sections" if key == "aiDaily" else "items"
        for it in _iter_items(blk, kind):
            if it.get("aiSummary"):
                cid = _id(it)
                cache.setdefault(cid, {})
                cache[cid].setdefault("s", it.get("aiSummary"))
                cache[cid].setdefault("t", it.get("aiTags") or [])


def main():
    base_c, model_c, key_c = wb_config.enrich_chat()
    base_e, model_e, key_e, _dim = wb_config.enrich_embedding()
    max_items, batch = wb_config.enrich_limits()

    if not (base_c and model_c and key_c):
        print("enrich: 未配置 chat 模型（workbench.local.json.enrich.chat），跳过")
        return 0
    do_vector = bool(base_e and model_e and key_e and zilliz.configured())

    # 载入缓存（+ 从 data.json 兜底回补）
    cache = _load_json(CACHE) or {}
    if not isinstance(cache, dict):
        cache = {}
    _seed_cache_from_data_json(cache)

    # 载入各源、收集 item 引用
    docs = []            # [(path, kind, doc)]
    all_items = []       # [(cid, item)]
    dates = {}           # cid -> 源级 date（旁挂 map，避免污染各源 *.json）
    for path, kind in SOURCES:
        doc = _load_json(path)
        if not doc:
            continue
        docs.append((path, kind, doc))
        dd = doc.get("date") or ""
        for it in _iter_items(doc, kind):
            if it.get("title"):
                cid = _id(it)
                all_items.append((cid, it))
                if dd:
                    dates.setdefault(cid, dd)

    # 需要摘要的 = 缓存里没有 summary 的新条目（去重、限量）
    need, seen = [], set()
    for cid, it in all_items:
        if cid in seen:
            continue
        seen.add(cid)
        if not cache.get(cid, {}).get("s"):
            need.append((cid, it))
    capped = need[:max_items]
    if len(need) > max_items:
        print("enrich: 新条目 %d 超过每轮上限 %d，本轮只处理前 %d 条（下轮续）"
              % (len(need), max_items, max_items))

    # 批量调 chat 出 摘要+标签
    done = 0
    for i in range(0, len(capped), batch):
        chunk = capped[i:i + batch]
        payload = [{
            "i": j,
            "title": it.get("title", ""),
            "source": it.get("source", ""),
            "raw": (it.get("summary") or "")[:200],
        } for j, (cid, it) in enumerate(chunk)]
        try:
            arr = llm.chat_json(base_c, model_c, key_c, SYS_PROMPT,
                                json.dumps(payload, ensure_ascii=False))
        except Exception as e:
            print("enrich: chat 批次失败（保留原摘要）：%s" % e)
            arr = None
        if not isinstance(arr, list):
            continue
        by_i = {}
        for el in arr:
            if isinstance(el, dict) and "i" in el:
                by_i[el.get("i")] = el
        for j, (cid, it) in enumerate(chunk):
            el = by_i.get(j) or {}
            s = (el.get("summary") or "").strip()
            if not s:
                continue
            tags = el.get("tags") or []
            tags = [str(t).strip() for t in tags if str(t).strip()][:4] if isinstance(tags, list) else []
            cache[cid] = {"s": s, "t": tags, "e": cache.get(cid, {}).get("e", False)}
            done += 1

    # 回写 aiSummary/aiTags 到所有命中缓存的 item
    for cid, it in all_items:
        c = cache.get(cid)
        if c and c.get("s"):
            it["aiSummary"] = c["s"]
            it["aiTags"] = c.get("t") or []

    # 向量：对「有摘要但未 embed」的条目 embed + upsert（限量、可降级）
    up_ok = 0
    if do_vector:
        pend, seen2 = [], set()
        for cid, it in all_items:
            if cid in seen2:
                continue
            seen2.add(cid)
            c = cache.get(cid)
            if c and c.get("s") and not c.get("e"):
                pend.append((cid, it))
        pend = pend[:max_items]
        for i in range(0, len(pend), batch):
            chunk = pend[i:i + batch]
            texts = [(it.get("title", "") + " " + (cache[cid].get("s") or "")).strip()
                     for cid, it in chunk]
            try:
                vecs = llm.embed(base_e, model_e, key_e, texts)
            except Exception as e:
                print("enrich: embedding 批次失败（跳过本批向量）：%s" % e)
                vecs = []
            if len(vecs) != len(chunk):
                continue
            rows, row_cids = [], []
            for (cid, it), vec in zip(chunk, vecs):
                if not vec:
                    continue  # 空向量项不入 rows，也不标 embedded（下轮重试），见 code-review F1
                row_cids.append(cid)
                rows.append({
                    "id": cid, "vector": vec,
                    "url": (it.get("url") or "")[:1024],
                    "title": (it.get("title") or "")[:1024],
                    "summary": (cache[cid].get("s") or "")[:2048],
                    "tags": json.dumps(cache[cid].get("t") or [], ensure_ascii=False)[:512],
                    "source": (it.get("source") or "")[:128],
                    "date": dates.get(cid, ""),
                })
            if not rows:
                continue
            ok, res = zilliz.upsert(rows)
            if ok:
                for cid in row_cids:
                    cache[cid]["e"] = True
                up_ok += len(rows)
            else:
                print("enrich: zilliz upsert 失败（下轮重试）：%s" % res)
                break
    elif base_e and model_e and key_e:
        print("enrich: 未配置 Zilliz，跳过向量化（仅写摘要/标签）")

    # 落盘：缓存 + 各源 *.json（原子写）
    try:
        wb_common.write_json_atomic(CACHE, cache)
    except Exception as e:
        print("enrich: 写缓存失败：%s" % e)
    for path, _kind, doc in docs:
        try:
            wb_common.write_json_atomic(path, doc)
        except Exception as e:
            print("enrich: 回写 %s 失败：%s" % (os.path.basename(path), e))

    print("enrich: 摘要新增 %d 条，向量 upsert %d 条，缓存共 %d 条%s"
          % (done, up_ok, len(cache), "" if do_vector else "（未启用向量）"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
