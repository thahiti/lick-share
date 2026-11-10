#!/usr/bin/env bash
# 공통 게이트를 한 번에 돌린다: typecheck, lint, test, check-smp.
# 워킹트리가 깨끗한 상태에서 통과하면 HEAD 해시를 .last-check 에 남긴다.
# feature.mjs 는 done 전환 때 이 해시가 HEAD 와 같은지 본다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run typecheck
npm run lint
npm test
npm run check-smp

if [ -n "$(git status --porcelain)" ]; then
  echo "통과. 다만 워킹트리에 미커밋 변경이 있어 .last-check 를 갱신하지 않는다. 커밋 후 다시 실행한다"
  exit 0
fi

git rev-parse HEAD > harness/.last-check
echo "통과. .last-check = $(cut -c1-7 harness/.last-check)"
