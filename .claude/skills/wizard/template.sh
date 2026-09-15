#!/usr/bin/env bash
#
# 向导(wizard)会一步步带一个真人走完一套手动流程。
# 由 /wizard 这个 skill 生成。
#
# "STAGES" 标记以上的部分是向导的库代码:不要手动改动它。
# 请在标记以下编写各个阶段(per-step stages)。

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# 向导库:每个向导都一样的、讨喜一致的交互体验。
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# 作者在 stages 区块顶部设置这个值。
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # 本次运行写入的 KEY 列表
WRITTEN_SECRET=() # 本次运行设置的 secret 名称
SKIPPED=()        # 没能自动完成的事项(比如缺 gh 命令)

# _clear 清空终端,让屏幕上只留当前这一步。非终端环境下是空操作,
# 这样管道输出的日志依然可读。
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

# banner "标题" 展示开场画面:说明这个向导是做什么的。
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  共 %s 个阶段%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  由你来操作浏览器;这个向导会精确告诉你该做什么、\n' "$DIM"
  printf '  并把你复制回来的值采集下来。随时可以 Ctrl-C 中断,以后\n'
  printf '  再重新运行——它会记住已经保存过的值。%s\n' "$RESET"
  pause "准备好开始了吗?"
}

# stage "名称" 清屏,然后公告一个阶段并显示进度。
# 清屏是为了让屏幕上只留当前这一步。
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ 阶段 %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "……" 打印一行纯说明文字。
say()  { printf '  %s\n' "$1"; }
# step "……" 是人在浏览器里要做的、带编号感的一个动作。
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL 跨平台打开浏览器(含 WSL)。
open_url() {
  local url="$1"
  printf '  %s↗ 正在打开%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "打不开浏览器,请手动访问:$url"; fi
  } >/dev/null 2>&1 || warn "打不开浏览器,请手动访问:$url"
}

# pause "提示语" 等人确认已经完成了手动操作的部分。
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-按回车继续}" "$RESET"
  read -r _ || true
}

# confirm "问题" 是一个 y/N 关卡;回答 yes 才算通过。
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY:读出 ENV_FILE 里 KEY 当前的值(如果有的话)。
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "提示语" 把一个值读进 $KEY。重复运行时,如果 .env 里已有值,
# 会把它当作默认值展示(直接回车即保留)。这是非密钥、可见输入。
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[回车保留当前值]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "提示语" 和 ask 类似,但输入内容会被隐藏。
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[回车保留当前值]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE 把 KEY=VALUE 幂等地 upsert 进 ENV_FILE
# (文件不存在就创建;已有的同名行会被替换)。
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ 已写入%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE 通过 gh 设置一个 GitHub Actions 仓库 secret。
# 如果 gh 不可用或未登录,退化为打印一条警告并记下这件事。
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ 已设置%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name(请手动设置:gh secret set $name)")
  warn "跳过了 GitHub secret $name:gh 还没就绪,稍后自己设置"
}

# set_var NAME VALUE 设置一个 GitHub Actions 仓库变量(非密钥)。
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ 已设置%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "跳过了 GitHub variable $name,gh 还没就绪,稍后自己设置"
}

# finish 清屏,然后展示这次配置好的所有内容的收尾汇总。
finish() {
  _clear
  printf '\n%s%s  ✓ 配置完成%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "写入了 ${#WRITTEN_ENV[@]} 个值到 $ENV_FILE:${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "设置了 ${#WRITTEN_SECRET[@]} 个 GitHub secret:${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "还需要你手动完成:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES:在这里编写各个阶段。人要走的每一步对应一个 stage()。
# 替换掉下面这个示例,并把 TOTAL_STAGES 改成你实际写的阶段数。
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=1

banner "Stripe 配置"

# ── 示例阶段:替换成你自己的真实步骤 ───────────────────────────
stage "Stripe:API keys"
say "我们要拿到你的 Stripe 测试密钥,存起来给本地开发和 CI 用。"
open_url "https://dashboard.stripe.com/test/apikeys"
step "在 API keys 页面,复制 Publishable key(以 pk_test_ 开头)。"
ask STRIPE_PUBLISHABLE_KEY "粘贴 publishable key:"
step "点击 Secret key 那一行的 'Reveal test key',然后复制它。"
ask_secret STRIPE_SECRET_KEY "粘贴 secret key:"
write_env STRIPE_PUBLISHABLE_KEY "$STRIPE_PUBLISHABLE_KEY"
write_env STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"
set_secret STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"   # CI 需要这一个
# ──────────────────────────────────────────────────────────────────────────

finish
