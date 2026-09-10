# -*- coding: utf-8 -*-
"""Zilliz Cloud（托管 Milvus）REST v2 瘦客户端。纯标准库 urlopen。

只覆盖资讯语义检索所需的最小面：建库(幂等) / upsert / search / 计数。
不引 pymilvus（守「依赖极简且可撤回」北极星，ADR 0010/0011）——REST v2 足够。

端点：{endpoint}/v2/vectordb/...   认证：Authorization: Bearer <token>
成功响应形如 {"code":0,"data":...}；code!=0 视为失败。
配置经 backend.core.config.zilliz() 读，缺失时上层优雅停用。
"""
import json
import ssl
import urllib.request
import urllib.error

from backend.core import config as wb_config

# 标量字段（供过滤与回显）；向量字段名固定 vector，主键 id=sha1(url)
VECTOR_FIELD = "vector"
OUTPUT_FIELDS = ["url", "title", "summary", "tags", "source", "date"]


def configured():
    endpoint, token, _ = wb_config.zilliz()
    return bool(endpoint and token)


def _req(path, payload, timeout=30):
    """POST {endpoint}{path}；返回 (ok, data_or_err)。"""
    endpoint, token, _ = wb_config.zilliz()
    if not endpoint or not token:
        return False, "zilliz not configured"
    url = endpoint + path
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return False, e.read().decode("utf-8", "replace")[:300]
        except Exception:
            return False, "http %d" % e.code
    except Exception as e:
        return False, str(e)
    if data.get("code") not in (0, 200, None):
        return False, data.get("message") or json.dumps(data)[:300]
    return True, data.get("data")


def collection() -> str:
    return wb_config.zilliz()[2]


def has_collection():
    ok, data = _req("/v2/vectordb/collections/list", {})
    if not ok:
        return False
    return collection() in (data or [])


def create_collection(dim):
    """幂等建库：已存在则跳过。schema=varchar 主键 + FloatVector(dim) + 若干标量 + 动态字段。"""
    if dim <= 0:
        return False, "invalid dim %s" % dim
    if has_collection():
        return True, "exists"
    # 注：Milvus/Zilliz REST v2 字段参数键是 elementTypeParams（不是 params）；
    # max_length / dim 用整数。indexParams 里才是 params.index_type。
    schema = {
        "fields": [
            {"fieldName": "id", "dataType": "VarChar", "isPrimary": True, "elementTypeParams": {"max_length": 64}},
            {"fieldName": VECTOR_FIELD, "dataType": "FloatVector", "elementTypeParams": {"dim": dim}},
            {"fieldName": "url", "dataType": "VarChar", "elementTypeParams": {"max_length": 1024}},
            {"fieldName": "title", "dataType": "VarChar", "elementTypeParams": {"max_length": 1024}},
            {"fieldName": "summary", "dataType": "VarChar", "elementTypeParams": {"max_length": 2048}},
            {"fieldName": "tags", "dataType": "VarChar", "elementTypeParams": {"max_length": 512}},
            {"fieldName": "source", "dataType": "VarChar", "elementTypeParams": {"max_length": 128}},
            {"fieldName": "date", "dataType": "VarChar", "elementTypeParams": {"max_length": 32}},
        ],
        "enableDynamicField": True,
    }
    index_params = [{
        "fieldName": VECTOR_FIELD,
        "indexName": "vector_index",
        "metricType": "COSINE",
        "params": {"index_type": "AUTOINDEX"},
    }]
    return _req("/v2/vectordb/collections/create", {
        "collectionName": collection(),
        "schema": schema,
        "indexParams": index_params,
        "params": {"consistencyLevel": "Bounded"},
    }, timeout=90)  # serverless DDL 建表较慢，放宽超时


def drop_collection():
    """删除 collection（回滚/重建用）。"""
    return _req("/v2/vectordb/collections/drop", {"collectionName": collection()})


def upsert(rows):
    """rows: [{id, vector, url, title, summary, tags, source, date}]。分批 upsert。"""
    if not rows:
        return True, {"upserted": 0}
    total = 0
    for i in range(0, len(rows), 100):
        ok, data = _req("/v2/vectordb/entities/upsert", {
            "collectionName": collection(),
            "data": rows[i:i + 100],
        })
        if not ok:
            return False, data
        total += len(rows[i:i + 100])
    return True, {"upserted": total}


def search(vector, topk=20, expr=None):
    """向量近邻搜索，返回命中列表 [{id, score, url, title, summary, tags, source, date}]。"""
    payload = {
        "collectionName": collection(),
        "data": [vector],
        "annsField": VECTOR_FIELD,
        "limit": int(topk),
        "outputFields": OUTPUT_FIELDS,
        "searchParams": {"metricType": "COSINE"},
    }
    if expr:
        payload["filter"] = expr
    ok, data = _req("/v2/vectordb/entities/search", payload)
    if not ok:
        return False, data
    hits = []
    for h in (data or []):
        tags = h.get("tags") or ""
        try:
            tags = json.loads(tags) if isinstance(tags, str) and tags else (tags or [])
        except Exception:
            tags = []
        hits.append({
            "id": h.get("id"),
            "score": h.get("distance"),
            "url": h.get("url", ""),
            "title": h.get("title", ""),
            "summary": h.get("summary", ""),
            "tags": tags,
            "source": h.get("source", ""),
            "date": h.get("date", ""),
        })
    return True, hits
