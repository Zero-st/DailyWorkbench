# -*- coding: utf-8 -*-
"""Supabase 模型配置存取（model_configs 单行 jsonb）。从 server.py 抽出，高内聚。

配置(url/serviceKey)经 wb_config.supabase() 解析；本模块不关心 HTTP 路由。
未配置时 get_config()->None、upsert()->False，调用方据此判断 configured。
"""
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from backend.core import config as wb_config

URL, KEY = wb_config.supabase()


def configured():
    return bool(URL and KEY)


def _headers():
    return {
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
    }


def get_config():
    """读取 model_configs 单行；未配置返回 None，读取失败返回 'ERR'。"""
    if not configured():
        return None
    url = URL + "/rest/v1/model_configs?select=data&id=eq.default"
    req = Request(url, headers=_headers())
    try:
        with urlopen(req, timeout=10) as resp:
            arr = json.loads(resp.read().decode("utf-8"))
            if isinstance(arr, list) and arr and arr[0].get("data") is not None:
                return arr[0]["data"]
            return {}  # 配置了但还没有数据
    except Exception as e:
        sys.stderr.write("[sb] get: %s\n" % e)
        return "ERR"


def upsert(data):
    """写入/合并 model_configs 单行；失败返回 False。"""
    if not configured():
        return False
    url = URL + "/rest/v1/model_configs"
    body = json.dumps({"id": "default", "data": data}).encode("utf-8")
    req = Request(url, data=body, method="POST", headers=_headers())
    req.add_header("Prefer", "resolution=merge-duplicates")
    try:
        with urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201, 204)
    except HTTPError as e:
        sys.stderr.write("[sb] upsert: %s\n" % e.read().decode("utf-8", "ignore"))
        return False
    except Exception as e:
        sys.stderr.write("[sb] upsert: %s\n" % e)
        return False
