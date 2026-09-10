# -*- coding: utf-8 -*-
"""一次性/幂等：探测 embedding 维度并在 Zilliz 建资讯 collection。

用法：python -m backend.pipeline.build_zilliz_collection
- 读 workbench.local.json 的 enrich.embedding 探测向量维度（对称：与 enrich/查询同一模型）；
- 幂等建库（已存在则跳过）；metric=COSINE，AUTOINDEX，varchar 主键 + 标量字段 + 动态字段。
缺配置即报错退出（非 0），不影响其它。见 ADR 0011。
"""
from backend.core import config as wb_config
from backend.clients import llm
from backend.clients import zilliz


def main():
    endpoint, token, coll = wb_config.zilliz()
    if not endpoint or not token:
        print("未配置 zilliz（workbench.local.json.zilliz.endpoint/token）")
        return 1
    base_e, model_e, key_e, dim_cfg = wb_config.enrich_embedding()
    if not (base_e and model_e and key_e):
        print("未配置 enrich.embedding，无法探测维度")
        return 1

    dim = dim_cfg or llm.probe_dim(base_e, model_e, key_e)
    if dim <= 0:
        print("探测 embedding 维度失败（检查 embedding base_url/model/key）")
        return 1
    print("embedding 维度 = %d，collection = %s" % (dim, coll))

    ok, res = zilliz.create_collection(dim)
    if ok:
        print("collection 就绪：%s" % (res if isinstance(res, str) else "created"))
        return 0
    print("建库失败：%s" % res)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
