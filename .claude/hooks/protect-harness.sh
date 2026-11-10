#!/usr/bin/env bash
# 레지스트리와 검증 캐시는 스크립트로만 바꾼다.
# 평가자 판정문은 평가자 서브에이전트만 쓸 수 있다.
set -uo pipefail
INPUT="$(cat)"
FILE="$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')"
AGENT="$(echo "$INPUT" | jq -r '.agent_type // empty')"
[ -z "$FILE" ] && exit 0

deny() {
  jq -n --arg reason "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$FILE" in
  */harness/features.json)
    deny "harness/features.json 은 직접 편집하지 않는다. node harness/feature.mjs <add|start|approve|stage|finish> 를 쓴다" ;;
  */harness/.last-check)
    deny "harness/.last-check 는 harness/check.sh 만 쓴다" ;;
  */harness/evidence/*/verdict.md)
    case "$AGENT" in
      evaluator|evaluator-light) exit 0 ;;
      *) deny "verdict.md 는 evaluator 또는 evaluator-light 서브에이전트만 쓴다. /feature-verify 스킬을 따른다" ;;
    esac ;;
esac
exit 0
