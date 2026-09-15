---
name: git-guardrails-claude-code
description: 配置 Claude Code 的 hook,在执行前拦截并阻止危险的 git 命令(push、reset --hard、clean、branch -D 等)。当用户想防止破坏性的 git 操作、想加一层 git 安全 hook、或想在 Claude Code 里彻底封死 git push/reset 时使用。
---

# 配置 Git 护栏

配置一个 `PreToolUse` hook,在 Claude 真正执行危险 git 命令之前把它拦截并阻止掉。

## 会被拦截的命令

- `git push`(含所有变体,包括 `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

被拦截时,Claude 会看到一条消息,告诉它没有权限执行这些命令。

## 步骤

### 1. 先问清楚安装范围

问用户:装到**仅本项目**(`.claude/settings.json`)还是**全部项目**(`~/.claude/settings.json`)?

### 2. 复制 hook 脚本

内置脚本在:[scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh)

按选定的范围,把它复制到对应位置:

- **本项目**:`.claude/hooks/block-dangerous-git.sh`
- **全局**:`~/.claude/hooks/block-dangerous-git.sh`

用 `chmod +x` 给它加上可执行权限。

### 3. 把 hook 加进 settings

加到对应的 settings 文件里:

**本项目**(`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

**全局**(`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

如果 settings 文件已经存在,把这个 hook 合并进已有的 `hooks.PreToolUse` 数组里,不要覆盖掉其他配置。

### 4. 问要不要自定义

问用户要不要给拦截清单加减模式(pattern)。按需求编辑复制过去的那份脚本。

### 5. 验证

跑一个简单测试:

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | <脚本路径>
```

应该以退出码 2 结束,并往 stderr 打印一条 `BLOCKED` 消息。
