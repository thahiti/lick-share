# 피아노 레코딩 입력 설계 (2026-07-16)

편집 화면에서 ● Rec을 누르면 예비박 1마디 후 피아노 건반 터치로 노트를 실시간 입력하는 기능.
새 화면(라우트)이 아니라 **편집 화면 안의 모드 전환**이다. 모바일·데스크톱 둘 다 지원한다.

## 1. 확정 UX 결정

| 항목 | 결정 |
|---|---|
| 노트 길이 | **누른 시간만큼** — keyUp 시점에 길이 확정, 그리드 양자화 |
| 대상 화면 | 데스크톱 워크스페이스 + 모바일 레이아웃 둘 다 (레코딩 로직 공유) |
| 덮어쓰기 | **친 곳만 덮어쓰기** — 기존 `resolveOverlap` 규칙으로 겹친 부분만 밀어냄. 안 친 구간의 기존 노트는 유지 |
| 시작 위치 | 현재 마디(curM)의 첫 스텝부터 |
| 진행 범위 | 시작 마디부터 **곡 끝까지 계속** (마디 단위 펀치인은 v1 제외) |
| 예비박 | **1마디(4박)**, 첫 박 액센트. 기존 메트로놈 클릭음 재사용 |
| 레코딩 중 사운드 | 메트로놈 **강제 ON**(설정 무관), 반주는 현재 토글 상태를 따름, **기존 멜로디는 음소거** |
| 종료 | 곡 끝 자동 종료 또는 Stop 버튼. 종료 시 편집 모드 복귀 |
| 언두 | 테이크 전체가 **undo 1회**로 취소 |
| 모바일 건반 | **2옥타브(흰건반 15개) + ◀▶ 옥타브 이동**, C2~C6 클램프. 초기 창은 곡 노트 중앙값 기준, 노트 없으면 C3–C5 |
| 탭 사운드 | 기존 `player.preview`(고정 감쇠음 0.35초) 재사용. 누른 길이만큼 지속되는 음은 v1 제외 |

## 2. 아키텍처

레이어 방향은 기존 규칙 그대로: `ui → adapters → ports`, `engine → core`. core/engine에는 시계·DOM 금지.

### 2.1 core: `src/core/recording.ts` (신규, 순수)

시간은 전부 `Sec`으로 주입받는 상태 머신. 기준 시각 `t=0`은 레코딩 본편 시작(예비박 끝),
예비박 구간은 `t < 0`.

```ts
interface RecState {
  readonly startStep: Step;   // 레코딩 시작 스텝 (curM 첫 스텝)
  readonly endStep: Step;     // 곡 끝 스텝
  readonly held: { readonly p: Midi; readonly downT: Sec } | null;  // 모노포닉 — 최대 1개
}

// 각 이벤트는 새 상태와 "커밋할 노트 스펙"을 반환
keyDown(st, tempo, midi, t) → { st: RecState; commit?: NoteSpec }
keyUp(st, tempo, midi, t)   → { st: RecState; commit?: NoteSpec }
tick(st, tempo, t)          → { st: RecState; done: boolean; commit?: NoteSpec }
```

- `keyDown`: 이미 누른 키가 있으면 그 노트를 현재 t에서 잘라 먼저 커밋(레가토 컷) 후 새 키를 hold.
- `keyUp`: hold 중인 키와 midi가 일치할 때만 커밋. 불일치(레가토 컷 이후 늦게 도착한 keyUp)는 무시.
- `tick`: `t`가 곡 끝을 지나면 `done: true`. hold 중이던 노트는 곡 끝에서 잘라 커밋.

**양자화 규칙**
- 시작 스텝 = `startStep + round(downT / secPerStep(tempo))`.
  예비박 중 이른 터치(`t<0`)는 반올림으로 스텝 0에 흡수되고, 반올림 결과가 `startStep` 미만이면 노트 미생성(소리만).
- 길이 = `(upT − downT) / secPerStep`을 `LEN_STEPS`(1,2,3,4,6,8,12,16) 중 가장 가까운 값으로 스냅, 최소 1.
  `endStep`을 넘으면 잘라낸 뒤 다시 LEN_STEPS로 내림 스냅.
- 시작 스텝이 `endStep` 이상이면 미생성.

### 2.2 engine: `src/engine/schedule.ts` 확장

- `countInEvents(tempo): SoundEvent[]` (신규 순수 함수) — 4분음표 클릭 4개.
  주파수·액센트는 기존 메트로놈과 동일(첫 박 1568Hz, 나머지 1047Hz).
- 레코딩용 이벤트 = `countInEvents` + `schedule(범위)`에서 **melody 제외·metro 강제 포함·acc는 토글 따름**,
  본편 이벤트를 예비박 길이(`4박 × secPerStep×4`)만큼 뒤로 시프트해 병합.
  오디오 출력은 기존 `AudioSink.play` 그대로 — **어댑터 수정 없음**.

### 2.3 adapters: `src/adapters/player.ts` 확장

`player.record(fromStep, callbacks)` 세션 추가.
- 기존 재생 세션과 같은 rAF 클록 사용. 매 프레임 콜백으로 `t`(레코딩 기준 상대 초)를 전달.
- 재생 세션과 상호 배타 — 레코딩 시작 시 기존 재생 정지.
- 탭 사운드는 기존 `preview(midi)`(`sink.playNow`) 재사용.

### 2.4 store: `songStore` 액션 3개 (신규)

- `beginRecord()` — 언두 스냅샷 **1회** push 후 억제 플래그 on.
- `recordCommit({s, d, p})` — 순수 insert + `resolveOverlap`. 언두 push 없음. 선택(sel) 변경 없음.
- `endRecord()` — 억제 플래그 해제.

레코딩 세션 상태(RecState)와 클록 연결은 ui 훅(`useRecording`)이 보유 — store에는 곡 변경만 위임.

## 3. UI

### 3.1 진입점

- **모바일**: Header 트랜스포트 그룹(반주·메트로놈·재생 줄)의 재생 버튼 왼쪽에 빨간 **● Rec** 아이콘 버튼.
  ButtonBar는 SPEC §3.8 6버튼이 이미 확정이라 사용하지 않는다.
- **데스크톱**: ws-transport 재생 버튼 옆 **● Rec** 버튼. 단축키 `R`(시작/정지), `Esc`·`Space` 정지.

### 3.2 레코딩 모드 전환 (모바일)

- Header: 뒤로·반주·재생·템포·공유 비활성/숨김, **■ Stop**만 활성.
  타이틀 아래에 REC 상태줄 — 깜빡이는 ● + `COUNT-IN` 또는 `REC` + 현재 마디·박.
- 예비박: Score 위 오버레이 — 큰 숫자 4·3·2·1 + 박 진행 도트 4개 + 안내 문구.
  이 동안 건반은 소리 확인 가능(노트 미생성).
- 하단 입력 영역(ChordRow·ChordPicker·Pad·MeasureBar·Steppers·ButtonBar)이 통째로
  **`RecordingPiano`**(신규 컴포넌트)로 교체. 정지 시 원래 구성 복원.
  - 흰건반 15개(2옥타브), 양끝 ◀▶ 옥타브 이동 버튼, 현재 창 라벨(예: `C3 – C5`).
  - 건반은 `pointerdown/up/cancel` + `touch-action: none`, 키별 pointer capture.
    슬라이드 글리산도 v1 미지원(처음 누른 키에 고정).
- 레코딩 중 Score: 기존과 같은 플레이헤드 진행 + 마디 자동 전환.
  이번 테이크 노트는 즉시 표시(기존 렌더 경로 재사용).

### 3.3 레코딩 모드 전환 (데스크톱)

- 기존 `PianoKeys`가 **armed** 상태로 전환: 빨간 보더, `onClick` 대신 `pointerdown/up`으로
  keyDown/keyUp 캡처. 비레코딩 시엔 기존 "다음 빈 박자 삽입" 클릭 동작 유지.
- 트랜스포트에 상태 칩: 예비박 중 `4·3·2·1` 카운트, 레코딩 중 `REC · M{n}` 위치.
- PianoRoll·StaffLane 편집 인터랙션(셀 탭·드래그)과 Undo/Redo/Delete 비활성.

### 3.4 공통 피드백

- 누르는 동안 건반 하이라이트(brand-tint 배경 + brand-outline 보더), keyDown 즉시 preview 사운드.
- 스타일은 tokens.css 변수만 사용. 새 악보 기호 없음(SMP 금지 규칙 무관 — 텍스트·●·■만 사용).

## 4. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 예비박 중 이른 터치 | 반올림으로 스텝 0 흡수, 더 빠르면 소리만 |
| 곡 끝에서 키를 누른 채 | tick이 곡 끝에서 잘라 커밋 후 자동 종료 |
| pointercancel·포인터 이탈 | keyUp과 동일 처리 |
| 레가토 컷 이후 늦은 keyUp | held와 midi 불일치 → 무시 |
| 마지막 마디에서 시작 | 범위 1마디로 정상 동작 |
| pickup 곡의 0마디부터 | 예비박은 항상 4박, 본편은 startStep부터 |
| 탭 전환·rAF 정지 | 프레임 델타가 아닌 clock.now() 절대 시각 기반 — 복귀 시 올바른 t |
| 재생 중 Rec | 재생 정지 후 레코딩 시작 |
| 취소 | 정지 후 undo 1회 = 테이크 전체 롤백 |

## 5. 테스트 전략 (TDD)

1. `core/recording.test.ts` — 양자화 반올림 경계, LEN_STEPS 스냅, 레가토 컷, 예비박 이른 터치,
   곡 끝 클램프·자동 종료, midi 불일치 keyUp 무시. 시각을 숫자로 주입.
2. `engine/schedule` — `countInEvents` 4클릭의 t·freq·액센트, 레코딩용 병합(멜로디 제외·메트로 강제) 검증.
   FakeAudioSink 로그로 확인.
3. store — 테이크당 언두 스냅샷 1개, `recordCommit`의 overlap 덮어쓰기.
4. UI(RTL) — RecordingPiano 렌더·옥타브 이동 클램프·pointer 이벤트 → 콜백,
   데스크톱 PianoKeys armed 전환, 레코딩 중 편집 비활성.
5. 마무리로 verify 스킬(dev 서버 + Playwright)로 실기 확인.

## 6. v1 제외 (후속 과제)

- 슬라이드 글리산도(건반 간 드래그)
- 누른 길이만큼 지속되는 탭 사운드(sink에 noteOn/noteOff 필요)
- 마디 단위 펀치인/아웃 레코딩
- 스윙/셔플 양자화 옵션
