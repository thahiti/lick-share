#!/usr/bin/env bash
# 세션 시작 시 환경을 준비한다. 여러 번 실행해도 안전하다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v node >/dev/null || { echo "node 가 없다" >&2; exit 1; }
[ -d node_modules ] || npm ci
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo ".env.local 을 .env.example 에서 만들었다. VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 채운다"
fi
echo "준비 완료. 개발 서버는 'npm run dev' 로 띄운다. 게이트는 harness/check.sh"
