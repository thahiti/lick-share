#!/usr/bin/env bash
# TypeScript 파일을 고치면 타입체크(일반 + 순수 레이어)와 해당 파일 린트를 돌린다.
# 실패하면 exit 2 로 에러 내용을 Claude 에게 돌려준다.
# TDD 의 RED 단계에서는 실패가 정상이다. 그때는 다음 편집(구현)으로 넘어간다.
set -uo pipefail
INPUT="$(cat)"
FILE="$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

case "$FILE" in
  "$ROOT"/src/*.ts|"$ROOT"/src/*.tsx|"$ROOT"/scripts/*.ts) ;;
  *) exit 0 ;;
esac
[ -d "$ROOT/node_modules" ] || {
  jq -n '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "node_modules 가 없어 타입체크를 건너뛰었다. harness/init.sh 를 실행한다"}}'
  exit 0
}

cd "$ROOT"
OUT="$(npm run --silent typecheck 2>&1)" || {
  echo "타입체크 실패:" >&2
  echo "$OUT" | head -40 >&2
  exit 2
}
LINT="$(npx eslint "$FILE" 2>&1)" || {
  echo "린트 실패 ($FILE):" >&2
  echo "$LINT" | head -40 >&2
  exit 2
}
exit 0
