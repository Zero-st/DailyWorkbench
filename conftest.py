# -*- coding: utf-8 -*-
"""pytest 引导：把仓库根加入 sys.path，使 `from backend.* import ...` 可解析。

后端脚本已收敛为 backend/ 分层 package；测试留在仓库根。pytest 一般会把 rootdir
加入 sys.path，这里显式插入以保证在各种调用方式下都稳。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
