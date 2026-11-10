---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "scripts/**/*.test.ts"
---
하네스 기능의 테스트 이름에는 명세의 수용 기준 id 를 넣는다. 예: `it('AC-3 같은 이름은 대소문자만 달라도 거절한다', ...)`.
명세에 없는 동작을 테스트로 추가하려면 먼저 명세(`docs/features/<id>/03-spec.md`)에 AC 를 추가한다.
테스트를 지우거나 기대값을 구현에 맞춰 바꾸는 것은 명세 변경과 사용자 승인이 있을 때만 한다.
순수 레이어 테스트는 DOM 없이 돈다. 소리와 시계는 `src/adapters/fakes/` 의 대역을 쓴다.
골든 스냅샷(`src/engine/__snapshots__/`)은 diff 를 읽고 의도된 변화일 때만 갱신한다.
Supabase 를 쓰는 코드의 테스트는 `vi.mock('../supabase', ...)` 로 호출 기록을 남기는 기존 패턴을 따른다.
