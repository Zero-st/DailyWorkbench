#!/usr/bin/env bash
# HITL(人在回路)复现循环。
# 复制这个文件,编辑下面的步骤,然后运行它。
# agent 负责跑这个脚本;用户在自己的终端里按提示操作。
#
# 用法:
#   bash hitl-loop.template.sh
#
# 两个辅助函数:
#   step "<指令>"          → 展示一条指令,等回车
#   capture VAR "<问题>"   → 展示一个问题,把回答读进 VAR
#
# 跑完之后,采集到的值会以 KEY=VALUE 的形式打印出来,供 agent 解析。
#
# `capture` 会把值打印回终端,agent 从那里读取——所以用它来采集
# 观察结果;至于让用户去登录这类动作,用 `step` 就够了。

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [做完后按回车] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- 以下内容按需编辑 ---------------------------------------------------------

step "打开 http://localhost:3000 并登录。"

capture ERRORED "点击 'Export' 按钮。有没有报错?(y/n)"

capture ERROR_MSG "把报错信息贴出来(没有就填 'none'):"

# --- 以上内容按需编辑 ---------------------------------------------------------

printf '\n--- 已采集 ---\n'
printf 'ERRORED=%s\n' "$ERRORED"
printf 'ERROR_MSG=%s\n' "$ERROR_MSG"
