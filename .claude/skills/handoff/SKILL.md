---
name: handoff
description: 把当前对话压缩成一份交接文档,供另一个 agent 接手。
argument-hint: "下一次会话打算用来做什么?"
disable-model-invocation: true
---

写一份交接文档,总结当前这次对话,好让一个全新的 agent 能接着往下做。存到用户操作系统的临时目录里——不要存到当前工作区。

文档里加一个"建议 skill"小节,点名下一个 agent 该用 Skill 工具调用哪些 skill。

不要重复已经记录在其他产出物里的内容(规格说明、计划、ADR、issue、commit、diff)。改成引用它们的路径或 URL。

把任何敏感信息脱敏,比如 API key、密码、或者个人身份信息。

如果用户传了参数,把它当作"下一次会话要聚焦什么"的说明,据此调整文档内容。
