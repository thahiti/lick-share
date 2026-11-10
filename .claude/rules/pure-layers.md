---
paths:
  - "src/core/**"
  - "src/engine/**"
  - "src/ports/**"
---
이 디렉터리는 완전 순수 레이어다. react, DOM, Web Audio, zustand 를 import 하지 않고 Date, setTimeout, window, document, AudioContext, Math.random 을 쓰지 않는다. `tsconfig.pure.json` 과 ESLint 가 막지만, 막히기 전에 설계를 바꾼다.
Step, Midi, Sec, BarIndex 는 branded type 이다. 맨 number 를 섞지 않는다(`src/core/types.ts`).
조판과 레이아웃 수치는 `src/core/constants.ts` 의 LAYOUT 한 곳에만 둔다.
쉼표는 데이터로 저장하지 않고 항상 파생한다.
`engine/schedule()` 의 출력은 골든 스냅샷으로 고정돼 있다. 바뀌면 diff 를 읽고 이유를 커밋 본문에 적는다.
