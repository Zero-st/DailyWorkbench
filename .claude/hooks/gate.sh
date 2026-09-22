#!/usr/bin/env bash
# Stop hook 入口：只负责挑解释器，逻辑全在 gate.py。
#
# 候选顺序（照仓库既有的 WB_PYTHON 约定，见 scripts/refresh.cmd:6、README.md:282）：
#   $WB_PYTHON → 仓内 .venv/venv → python3 → python
#
# **本文件刻意不含任何机器绝对路径**——「硬编码环境绑定（E:\ 路径，换机即废）」
# 是 docs/开发测试规范.md §3.1 记过的坑。本机解释器请设 WB_PYTHON，
# 位置在 .claude/settings.local.json 的 env（该文件本机私有、不进仓库）。
#
# 择优规则：优先选**装了 pytest** 的那个解释器——本机实测 /usr/bin/python3 没有
# pytest，选错会让测试门每轮假红。都没有就用第一个存在的，让 gate.py 如实报
# 「pytest 跑不起来」而不是静默跳过（宪章维度三：禁假绿）。

CANDIDATES=("$WB_PYTHON" "$(dirname "$0")/../../.venv/bin/python" \
            "$(dirname "$0")/../../venv/bin/python" "python3" "python")

FALLBACK=""
for c in "${CANDIDATES[@]}"; do
  [ -z "$c" ] && continue
  command -v "$c" >/dev/null 2>&1 || [ -x "$c" ] || continue
  [ -z "$FALLBACK" ] && FALLBACK="$c"
  if "$c" -c "import pytest" >/dev/null 2>&1; then
    exec "$c" "$(dirname "$0")/gate.py"
  fi
done

# 没有任何解释器 → 静默放行（门禁是拦错的，不该把人的工作卡死）
[ -z "$FALLBACK" ] && exit 0

exec "$FALLBACK" "$(dirname "$0")/gate.py"
