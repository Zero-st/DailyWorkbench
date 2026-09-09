# -*- coding: utf-8 -*-
"""使 `python -m backend.mcp` 可运行（cwd = 仓库根时）。

注：更稳的拉起方式是用绝对路径直接跑 server.py（server.py 顶部会把仓库根塞进
sys.path，绕开 cwd 依赖）；`-m` 形式要求 cwd 在仓库根、backend 可被 import。
"""
from backend.mcp.server import main

main()
