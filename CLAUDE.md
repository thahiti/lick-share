# CLAUDE.md — ScoreLink (TypeScript + React 재작성)

## 프로젝트 컨텍스트
프로토타입(docs/prototype-reference.html)으로 검증 완료된 악보 공유 앱을 제품 코드로 재작성한다.
문서 우선순위: docs/superpowers/specs/2026-07-12-ts-react-rewrite-design.md(구조) > docs/SPEC.md(기능·알고리즘) > docs/DESIGN.md(스타일) > 프로토타입(동작 참고).
진행은 설계 문서 §4의 Phase(P0~P10) 순서를 따르고, 각 Phase의 DoD(docs/IMPLEMENTATION_PLAN.md 수치)를 전부 만족한 뒤 다음으로 넘어간다.

## 레이어 규칙 (컴파일러·린터로 강제됨)
- 의존 방향: `ui → adapters → ports`, `engine → core`. 화살표는 항상 안쪽. core/engine/ports는 완전 순수.
- 순수 레이어(core/engine/ports)에서 금지: react, DOM, Web Audio, zustand import / Date, setTimeout, window, document, AudioContext, Math.random.
- Step, Midi, Sec, BarIndex는 branded type — 맨 number를 섞어 쓰지 말 것 (src/core/types.ts).

## 절대 규칙
- SMP 유니코드 음악 기호(U+1D100~U+1D1FF: 𝄞 𝄽 𝅗𝅥 등) 사용 금지. 악보 기호는 전부 SVG 패스. (Android 폰트 부재)
- 오디오 게인에 불연속 점프(감쇠 중 setValueAtTime) 금지 — 팝 노이즈의 원인. setTargetAtTime 기반 엔벨로프 유지.
- 조판/레이아웃 수치는 core constants의 LAYOUT 한 곳에만 정의.
- 기존 프로토타입 URL 해시(v1., 구버전 포함)와의 하위 호환을 깨지 말 것. 미래 버전 해시는 조용히 깨지지 말고 명시적으로 거부.
- 쉼표는 데이터로 저장하지 않는다 — 항상 파생.
- 코드가 없는 구간(첫 코드 이전)의 반주는 완전 무음 (SPEC §5.5).
- 골든 스냅샷(FakeAudioSink 로그)은 갱신 전 반드시 diff를 확인하고, 의도된 변화인지 검토 후에만 갱신.

## 작업 방식
- TDD 필수: 테스트 먼저 작성 → RED 확인 → 구현 → GREEN.
- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` — 커밋 전 전부 통과.
- 커밋 단위: Phase 단위. 메시지: "Phase N: <요약>".

## 명령
- 개발: `npm run dev`
- 이벤트 덤프: `npm run dump -- "#v1.…"` (P3에서 구현 — 이벤트 테이블 + ASCII 피아노롤)

## 스타일
- UI 텍스트는 한국어. 코드 주석은 한국어, 식별자는 영어.
- 디자인 토큰은 src/styles/tokens.css의 CSS 변수만 사용. 하드코딩 색상 금지.
