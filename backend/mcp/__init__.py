# -*- coding: utf-8 -*-
"""DailyWorkbench MCP 集成层（工具层）。

把工作台的知识库能力（backend.clients.kb）暴露成 MCP tools，供 Claude Code 等
harness 驱动。**集成层，不进 App 运行时**：App 核心永不 import 本包，`mcp` 依赖
只在运行本包时才需要（见 backend/mcp/README.md 与 docs/adr/0008-mcp-integration-layer.md）。
"""
