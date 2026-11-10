#!/usr/bin/env bash
# 응답이 끝날 때 미커밋 변경이 있으면 알린다. 막지는 않는다(무한 루프 방지).
set -uo pipefail
INPUT="$(cat)"
ACTIVE="$(echo "$INPUT" | jq -r '.stop_hook_active // false')"
[ "$ACTIVE" = "true" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

CHANGED="$(git status --porcelain 2>/dev/null)"
[ -z "$CHANGED" ] && exit 0
COUNT="$(echo "$CHANGED" | wc -l | tr -d ' ')"
jq -n --arg msg "미커밋 변경 파일 $COUNT 개. 논리 단위가 끝났으면 커밋하고 harness/PROGRESS.md 를 갱신한다 (/session-end)." '{systemMessage: $msg}'
