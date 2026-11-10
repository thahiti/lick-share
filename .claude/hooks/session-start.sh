#!/usr/bin/env bash
# 세션 시작 시 인수인계 문서, 진행 중 기능, 최근 커밋을 컨텍스트로 넣는다.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

CTX="$(
  echo "## 하네스 세션 시작 컨텍스트"
  echo
  echo "### harness/PROGRESS.md"
  cat harness/PROGRESS.md
  echo
  echo "### 진행 중 기능"
  node harness/feature.mjs current 2>&1
  echo
  echo "### 시작 가능한 기능"
  node harness/feature.mjs next 2>&1 | head -10
  echo
  echo "### 최근 커밋"
  git log --oneline -10 2>&1
  echo
  echo "### 워킹트리"
  CHANGED="$(git status --porcelain | wc -l | tr -d ' ')"
  echo "미커밋 변경 파일 수: $CHANGED"
  echo
  echo "다음 행동: /session-start 스킬을 따른다."
)"

jq -n --arg ctx "$CTX" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
