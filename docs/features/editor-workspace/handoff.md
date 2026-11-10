# 에디터 워크스페이스 UI 레이어 — 구현 핸드오프

- 작성일: 2026-07-13
- 대상 브랜치: `feat/editor-workspace-ui` (main에서 분기)
- 상태: **UI 레이어 미착수. 로직 기반은 main에 병합·배포 완료.**
- 설계 원본: `docs/superpowers/specs/2026-07-13-editor-workspace-design.md` (승인됨) — **이 문서와 함께 반드시 정독**
- 목적: 새 세션에서 이 문서만 보고 UI 레이어를 이어서 구현할 수 있도록 현상태·API·구현 지침·함정을 모두 정리

---

## 0. 한 줄 요약

데스크톱(≥1024px) 편집 화면을 **기존 다크 DAW(`DawEdit` 트리)에서 라이트 워크스페이스로 전면 교체**한다.
핵심 불변식: **악보와 피아노롤이 하나의 `pxPerStep` 좌표계를 공유해 마디 경계가 픽셀 단위로 일치**(설계 §4.5).
로직(core 편집 함수·store 액션·A~G 단축키)은 **이미 구현·테스트 완료**되어 main에 있다. 남은 것은 **렌더링 UI뿐**.

---

## 1. 현재 상태 (main에 병합·푸시 완료)

Phase B 로직 기반이 main에 있고 게이트 4종 통과(441 tests). 기존 다크 DAW는 그대로 동작 중이다.

이미 구현되어 **그대로 호출만 하면 되는** 것들:

### 1.1 공유 타임라인 — `src/core/timeline.ts` (순수)
```ts
ZOOM_MIN = 8, ZOOM_MAX = 32, ZOOM_DEFAULT = 14   // pxPerStep
clampZoom(v): number                              // [8,32] 클램프
stepToX(step, pxPerStep): number                  // step * px  (거터 제외 로컬 x)
stepCenterX(step, pxPerStep): number              // (step+0.5) * px
spanW(d, pxPerStep): number                       // d * px
xToStep(x, pxPerStep): number                     // floor(x/px), 0 하한 (드래그 역변환)
```
- 악보·피아노롤·재생헤드·선택 하이라이트가 **전부 이 함수만** 사용한다. 각 뷰가 독립적으로 x를 계산하면 안 된다.
- 거터/피치 레이블 열 폭은 `LAYOUT.GUTTER_W`(=44, `src/core/constants.ts`)로 통일. 각 뷰가 이 값을 좌측 오프셋으로 더한다.

### 1.2 core 편집 함수 — `src/core/editing.ts` (순수, 전부 `(ctx)=>EditOut`)
```ts
letterPitch(ref: Midi, letter: string): Midi
  // 음이름(A~G, 대소문자 무관)→기준 피치 최근접 옥타브. 동률이면 아래, PMIN~PMAX 클램프.
renoteSel(ctx, letter): EditOut          // 선택 노트를 음이름으로 재배치 (없거나 동일 피치면 no-op)
insertAtFreeBeat(ctx, p: Midi, len): EditOut  // 현재 마디 다음 빈 박에 입력+선택 (없으면 toast)
setNoteLen(ctx, len): EditOut            // 선택 노트 길이 직접 설정 (곡끝 클램프+resolveOverlap)
updateNote(ctx, id, {s?,p?,d?}): EditOut // 드래그 편집. 전부 클램프+resolveOverlap. p 있으면 preview.
```

### 1.3 store 액션 — `src/ui/store/songStore.ts`
```ts
inputLen: number                      // 세션 상태, 기본 INPUT_LEN(=4). 새 음 입력 기본 길이.
dragNote(id, {s?,p?,d?}): void         // 드래그 커밋. updateNote 위임, pointerup에 1회 호출 = 단일 undo.
setLen(len): void                      // inputLen 세션 갱신 + 선택 노트 있으면 길이 설정.
noteLetter(letter): void               // 선택 있으면 renoteSel, 없으면 직전 노트(없으면 C5=72) 옥타브 기준 insertAtFreeBeat.
keyTap(p: Midi): void                  // 건반 클릭 = 지정 피치를 insertAtFreeBeat.
setTitle(title): void                  // 제목 갱신 (undo 미적용 — 메타데이터).
// 기존 재사용: padTapAt(m,pv,st), gotoMeasure(m), setChord(beatKey,ch), setCurM(m),
//   setAccGlobal(v), cycleMeasureAcc(), setTempo(v), stepPitch/Pos/Len(dir), undoAction/redoAction
```

### 1.4 A~G 단축키 — `src/ui/hooks/useKeyboardShortcuts.ts`
- `resolveShortcut`이 `a~g`를 `noteA`~`noteG` 액션으로 매핑(한글 자판 KeyA~KeyG 보정 포함). `h/j/k/l/z`는 Vim 이동/undo로 유지.
- `App.tsx`의 `shortcuts` 맵이 `noteA~noteG → store.noteLetter('A'~'G')`로 이미 배선됨. **워크스페이스도 같은 훅을 그대로 쓰면 됨.**
- 힌트 행에 노출할 키맵(설계 §6.2): 화살표/hjkl(선택·음높이), Shift+화살표(위치·길이), Space(재생), Enter(마디재생), [ ](마디이동), Delete(삭제), Cmd+Z(undo), **A~G(음 입력)**.

---

## 2. 구현할 UI 컴포넌트

신규 디렉터리 권장: `src/ui/components/edit/ws/`. `.ws` CSS 스코프. 신규 스타일 `src/styles/ws.css`.

### 2.1 공유 타임라인 렌더링 원칙 (⚠️ 최우선 불변식 — 설계 §4.5)
- 악보(StaffLane)와 피아노롤(PianoRoll)은 **같은 `pxPerStep`** 을 받아 렌더한다.
- 마디폭 = `SPM(16) × pxPerStep`. 마디 경계 x = `GUTTER_W + stepToX(measStart(song,m), pxPerStep)`.
- 둘을 **하나의 가로 스크롤 컨테이너**(`.ws-scroll`)에 세로로 쌓아 스크롤·정렬을 공유.
- 좌측 거터(악보 음자리표 영역 / 롤 피치 레이블 열)는 폭 `GUTTER_W`로 통일, 가로 스크롤 시 **sticky**.
- 재생 헤드: x = `GUTTER_W + stepToX(playheadStep, px)`, `--playhead`(코랄) 세로선 + 상단 원형 핸들, 두 패널 관통.
- 줌 −/＋ 버튼은 `clampZoom`으로 `pxPerStep` 하나만 조정 → 두 뷰가 함께 스케일.
- `pxPerStep`은 Workspace의 `useState(ZOOM_DEFAULT)` 로컬 상태.

### 2.2 StaffLane (신규) — 줄바꿈 없는 한 줄 오선보
- 현재 `Score`(mode="edit")는 `single=true`라 한 줄로 그리지만 **폭에 맞춰 마디폭을 압축**(`computeMw`)한다. StaffLane은 반대로 **고정 pxPerStep으로 가로 스크롤**해야 마디 경계가 롤과 일치한다.
- 두 가지 접근:
  - **(A, 권장)** `Score.tsx`에서 글리프 컴포넌트 `ClefPath`·`RestGlyph`·`NoteSeg`와 헬퍼(`pitchDia`,`posX` 대체)를 **export**해 StaffLane이 재사용. 단 x좌표는 `posX`(마디폭 기반) 대신 **`stepToX` 기반**으로 계산해야 함. `pitchDia(p)`(→ `{step, acc}`, `src/core/geometry.ts`)로 음높이 y = `top + 4*LINEGAP - pd.step*(LINEGAP/2)` 재사용.
  - (B) StaffLane을 독립 SVG로 새로 그리되 글리프 패스만 Score에서 복사 — 중복이라 비권장(설계 §5: "조판 수치 중복 정의 금지").
- 음표 머리 x = `GUTTER_W + stepCenterX?` 가 아니라, 롤 블록과 정렬하려면 **음표 머리 = 블록 시작 정렬**(`stepToX(n.s)`) 또는 블록 가로 중앙 중 하나로 **롤과 동일 규칙** 채택. → 권장: 음표 머리 x = `GUTTER_W + stepToX(n.s, px) + spanW(n.d,px)/2` (블록 중앙). 재생헤드·선택도 동일 좌표.
- 오선 5선·마디 세로선·음자리표(거터 sticky)·코드 심볼(마디 위, 클릭 시 ChordPicker)·쉼표(`deriveRests`, `src/core/rests.ts`)·선택 음표(brand) 렌더.
- 선택/재생 색은 이미 토큰화됨(`--brand-primary` 선택, `--playhead` 재생) — Score가 이미 이 토큰 사용.
- 쉼표·음표 기호는 **SVG 패스만** (SMP 유니코드 금지). ♩(U+2669)는 BMP라 템포 표시에 허용.

### 2.3 PianoRoll (재작성) — `src/ui/components/edit/ws/PianoRoll.tsx`
기존 `src/ui/components/edit/daw/PianoRoll.tsx`를 참고하되 **좌표계를 교체**:
- 현재: `gridTemplateColumns: repeat(T, minmax(12px,1fr))` (유연) + playhead `%`. → **고정 `pxPerStep`으로 변경.**
- 그리드 폭 = `total(song) * pxPerStep`. 셀/블록 위치는 `stepToX`/`spanW`로 계산(px 절대배치 또는 `gridTemplateColumns: repeat(T, ${px}px)`).
- 행: `rollRows(song)` 재사용(흰건반 전체 + 곡에 존재하는 ♯). 행 높이 `ROW_H`. 좌측 피치 레이블 열 = `GUTTER_W` sticky.
- 그리드 위계: 마디 경계 **굵은 선**, 박(4스텝) 얇은 선, 피치 행 얇은 가로선.
- 노트 블록: `--note-block`, 라운드 3~4px, 폭 `spanW(n.d,px)`. 선택 = `--note-block-selected`.
- **클릭 입력(기존 유지)**: 빈 셀 클릭 = `padTapAt(m, pv, st)`, 블록 클릭 = 시작 셀 `padTapAt`(선택/재클릭 삭제). `onCellTap` 시그니처 그대로.
- **드래그 편집(신규, 설계 §6.1)**:
  - 노트 본체 드래그 = 음높이(세로, 행 단위)+시작 위치(가로, `xToStep`). 우측 가장자리(~6px) 드래그 = 길이.
  - pointerdown→move는 **로컬 state로 프리뷰만** 렌더. **pointerup에 `dragNote(id, patch)` 1회 호출**(= 단일 undo).
  - 이동 임계값(예: 3px) 미만이면 클릭으로 처리(기존 padTap 선택/삭제 의미론 유지).
  - `setPointerCapture` 사용 권장. 세로: 행 인덱스 델타 → `rows[newIndex]` 피치. 가로: `xToStep(포인터x - GUTTER_W, px)`.
- 세로 스크롤(높이 고정 ~320px, 선택 노트 따라 스크롤 — 기존 `useLayoutEffect` 패턴 재사용). 가로 스크롤은 상위 `.ws-scroll`이 담당(악보와 공유).

### 2.4 PianoKeys (신규) — 가로 피아노 건반
- 캔버스 폭 가득 가로 배치. 흰건반: 라운드 3px + hairline, 검은건반: 흰건반 높이 55~60%.
- 옥타브 레이블(C4, C5). 클릭 = `keyTap(asMidi(pitch))` → 현재 위치(다음 빈 박) 입력.
- 재생 시 눌림 애니메이션은 **범위 제외**(설계 §2). PMIN~PMAX(36~84) 범위 건반.

### 2.5 PropertyPanel (신규) — 구 `Inspector` 대체
기존 `src/ui/components/edit/daw/Inspector.tsx`의 음높이·위치·길이 스테퍼 로직을 그대로 가져오고 **위에 항목 추가**:
- **제목**: `<input>` → `store.setTitle(e.target.value)` (제어). ⚠️ input 포커스 중엔 단축키 무시됨(훅이 `isEditable` 가드) — 정상.
- **템포/박자**: 2열. 템포 숫자 입력(`setTempo`, 40~240 클램프), 박자 "4/4" 고정 표시.
- **음길이 세그먼트**: `LEN_STEPS`(=[1,2,3,4,6,8,12,16]) 8단계 버튼 + 쉼표 버튼. 선택 = `--brand-tint` 배경 + `--brand-outline` 보더. 클릭 = `setLen(step)`(선택 노트 있으면 길이 설정, 항상 inputLen 갱신). 쉼표 버튼 = 선택 노트 삭제(`deleteSel`, 쉼표는 파생). 쉼표 아이콘은 **SVG**.
- **선택 마디 코드**: 박 슬롯 클릭 → ChordPicker(§2.6).
- **반주**: Off·Pad·Comp·Arp = `setAccGlobal`. 마디 오버라이드 = `cycleMeasureAcc`. (Inspector 로직 그대로)
- 라벨 헬퍼: `posLabel`, `lenLabel` (`src/ui/labels.ts`), `pName`(`src/core/constants.ts`).

### 2.6 WsTopBar (신규) — 구 `DawTopBar` 대체
- 좌: ← 뒤로 · 곡 제목(medium) · "Auto-saved"(muted).
- 우: **[Share]** 아웃라인 · **[Publish]** brand primary(화면 유일 primary — `--brand-primary`).
- 재생▶/정지⏹·메트로놈·undo/redo/삭제는 트랜스포트 행 또는 상단 우측 클러스터에 배치(설계 §4.3-1). 기존 `data-btn` 명명(playall, metro, undo, redo, del, share, view) 유지 권장(테스트 안정).
- 템포 칩 "♩ = 100" 팝오버는 기존 DawTopBar 패턴 참고.

### 2.7 Workspace (조립) — 구 `DawEdit` 대체
설계 §4 구조:
```
.ws
├─ WsTopBar
├─ .ws-main  grid [1fr | 260px]
│  ├─ 편집 캔버스 (세로): (1)트랜스포트+줌 (2)StaffLane (3)PianoRoll  ← (2)(3)은 .ws-scroll 공유
│  │                     (4)단축키 힌트 행 (5)PianoKeys
│  └─ PropertyPanel
└─ ChordPicker 팝오버(재사용) · Toast
```
- 상태·핸들러는 **App이 소유**(기존 DawEdit 패턴). Workspace는 props로 받아 배치만. `pxPerStep`만 Workspace 로컬 state.
- ChordPicker 재사용: `src/ui/components/edit/ChordPicker.tsx` (props: song, curM, beat, onApply, onClear, onDone). `cpBeat` 상태·`chordKey(beat)`·Esc 닫기 전부 기존 App 로직 그대로.

### 2.8 App 배선 — `src/ui/components/App.tsx`
- `const desktop = useMediaQuery('(min-width: 900px)')` → **`'(min-width: 1024px)'`** 로 변경.
- 열람 데스크톱 컬럼(global.css)도 900→1024 통일(설계 §4).
- `if (desktop)` 블록의 `<DawEdit .../>`(App.tsx ~245줄)를 `<Workspace .../>`로 교체. 기존 핸들러(onCellTap=padTapAt, onSlotTap, onPicker*, onMeasureTap, onStepPitch/Pos/Len, onAccSelect, onCycleAcc, onTogglePlay, onToggleMetro, onTempoApply, onUndo/Redo/Delete, onPublish, onCopyLink, onView) 재사용 + **신규**: onDragNote=dragNote, onSetLen=setLen, onKeyTap=keyTap, onSetTitle=setTitle.
- 악보 폭 측정(`shellRef`/ResizeObserver)은 워크스페이스에선 `pxPerStep` 고정이라 **불필요**할 수 있음 — 가로 스크롤이 폭을 대신함. 단 열람/모바일 경로의 `scoreW` 측정은 유지.

---

## 3. 재사용 포인트 (경로)

| 대상 | 경로 | 용도 |
|---|---|---|
| 타임라인 | `src/core/timeline.ts` | 공유 좌표 |
| 조판 헬퍼 | `src/core/geometry.ts` | `pitchDia`, `measStart`, `measLen`, `measOf`, `total`, `measCountAll`, `LAYOUT.GUTTER_W` |
| 글리프 | `src/ui/components/edit/Score.tsx` | `ClefPath`/`RestGlyph`/`NoteSeg` **export 필요** |
| 쉼표 파생 | `src/core/rests.ts` `deriveRests(song)` | StaffLane 쉼표 |
| 라벨 | `src/ui/labels.ts` | `posLabel`, `lenLabel` |
| 코드 피커 | `src/ui/components/edit/ChordPicker.tsx` | 코드 편집 |
| ACC 라벨 | `src/ui/components/edit/ChordRow.tsx` `ACC_LAB` | 반주 표기 |
| 롤 행 | 구 `daw/PianoRoll.tsx` `rollRows`, `rowLabel` | 참고·이식 |
| 미디어쿼리 | `src/ui/hooks/useMediaQuery.ts` | 1024 분기 |
| 아이콘 | `src/ui/components/common/Icon.tsx` | play/pause/undo/redo/del/share/prev/next 등 (신규 필요시 stroke 패스 추가) |

---

## 4. 제거 대상 (UI 교체 완료 후)

- `src/ui/components/edit/daw/` 전체: `DawEdit.tsx`, `DawTopBar.tsx`(+test), `ChordRail.tsx`, `Inspector.tsx`(+test), `PianoRoll.tsx`(+test).
- `src/styles/daw.css` (435줄) 및 `src/main.tsx`/`DawEdit`의 import.
- `src/styles/tokens.css`의 `.daw { … }` 블록(64줄~파일끝). ⚠️ `:root` 브랜드 토큰은 **유지**.
- App.tsx의 `import { DawEdit }` 제거.
- ⚠️ 삭제 전 각 파일이 **다른 곳에서 import되지 않는지** grep 확인. 기존 daw 테스트도 함께 삭제/이전.

---

## 5. 토큰 (이미 존재 — 그대로 사용)

`src/styles/tokens.css :root`에 정의됨: `--brand-primary/-text/-hover`, `--brand-tint/-text`, `--brand-outline`, `--note-block`, `--note-block-selected`, `--playhead`, `--rank-accent`, `--bg-page`, `--bg-card`, `--radius-card`, `--radius-ctl`, `--shadow-card`.
- 악보 패널·롤 패널 배경 = `--bg-page` + 라운드 8px. 카드 표면 = `--bg-card`.
- **하드코딩 색 금지. 이 변수만 사용.**

---

## 6. 테스트 전략

- **StaffLane**: 마디 경계 x가 `GUTTER_W + stepToX(measStart)`와 일치, 노트 개수만큼 글리프, 선택 음표 표시, 재생헤드 존재/부재. (jsdom은 레이아웃 px 계산은 하지만 CSS 렌더는 안 함 → 좌표 계산 로직 위주 검증)
- **PianoRoll**: 노트 수만큼 블록, 블록 폭 `spanW`, 빈 셀 클릭 `onCellTap(m,pv,st)`, **드래그 pointerdown→move→up 시퀀스가 `onDragNote(id, patch)` 1회 호출**, 임계값 미만은 클릭 처리, 플레이헤드 존재/부재, ♯행 조건부.
- **PianoKeys**: 흰/검은 건반 개수, 클릭 → `onKeyTap(pitch)`, C4/C5 레이블.
- **PropertyPanel**: 제목 입력 → `onSetTitle`, 음길이 세그먼트 클릭 → `onSetLen(step)`·선택 표시, 쉼표 → `onDelete`, 스테퍼(pitch/pos/len) 디스패치·미선택 비활성, 반주 선택.
- **Workspace/App**: matchMedia 데스크톱 목 → `.ws` 렌더, 코드 슬롯 클릭 → 피커 → Esc 닫힘. 모바일(<1024) → 기존 트리 회귀 없음.
- **골든 스냅샷(FakeAudioSink)·오디오 경로 불변** — UI만 바꾸므로 스냅샷 변경 금지. `src/core/timeline.ts` 등 순수 로직은 이미 테스트됨.
- CSS 시각 항목(스크롤 동기·sticky 거터·줌·드래그 커서)은 `docs/e2e-checklist.md`에 항목 추가 후 **브라우저 수동 확인**.

---

## 7. 함정 / 주의사항 (실제로 겪은 것 포함)

1. **branded type**: `Note.s`는 `Step`, `Note.p`는 `Midi`. 테스트에서 노트 리터럴 만들 때 `asStep(0)`, `asMidi(64)` 필수. 맨 number 섞으면 typecheck 실패(런타임 vitest는 통과해서 안 잡힘 → typecheck 별도 확인).
2. **게이트 exit code**: `npm run typecheck | tail` 처럼 파이프 쓰면 tail의 exit(0)이 반환돼 **실패가 가려진다.** 반드시 `npm run typecheck; echo $?` 또는 파이프 없이 실행해 exit code 확인.
3. **SMP 금지**: U+1D100~U+1D1FF(𝄞 𝄽 𝅗𝅥 등) 절대 금지. 쉼표·음표는 SVG 패스. `npm run check-smp`가 잡음. ♩(U+2669)·♯(U+266F)은 BMP라 허용.
4. **레이어 규칙**: `src/core`/`engine`/`ports`는 순수(react/DOM/Date/window 금지). 새 UI는 `src/ui`에만. timeline.ts는 이미 순수.
5. **공유 좌표 위반 금지(§4.5)**: 악보와 롤이 각자 x를 계산하면 마디가 어긋남 → 반드시 `timeline.ts` 함수만.
6. **드래그 단일 undo**: move 중엔 store 건드리지 말고 로컬 프리뷰. pointerup에 `dragNote` 1회 = undo 1엔트리. move마다 dispatch하면 undo 폭발.
7. **모바일/열람 회귀 금지**: `<1024px` 편집·열람·커뮤니티는 현재와 동일해야 함. daw.css/.daw 토큰 제거가 모바일에 영향 없는지 확인(모바일은 global.css 사용).
8. **input 포커스 중 단축키**: 훅이 `isEditable`로 input/textarea에서 단축키 무시 → 제목·템포 입력 중 A~G가 글자로 들어감(정상). 의도된 동작.

---

## 8. 권장 작업 순서 (커밋 단위)

1. `Score.tsx`에서 `ClefPath`/`RestGlyph`/`NoteSeg` export (동작 불변 리팩터) + 기존 테스트 통과.
2. **PropertyPanel** (+test) — Inspector 로직 + 제목/템포/음길이 세그먼트. (가장 독립적·테스트 쉬움)
3. **PianoKeys** (+test).
4. **StaffLane** (+test) — 공유 좌표 한 줄 조판.
5. **PianoRoll** 재작성 (+test) — 고정 pxPerStep + 드래그.
6. **WsTopBar** (+test).
7. **Workspace** 조립 (+test) + `ws.css`.
8. **App 배선**: useMediaQuery 1024, DawEdit→Workspace, 신규 핸들러.
9. **제거**: daw/ 트리·daw.css·.daw 토큰. grep로 참조 없음 확인.
10. `docs/DESIGN.md` §7·`docs/e2e-checklist.md` 데스크톱 섹션 갱신.

각 단계: 테스트 먼저(RED)→구현(GREEN)→게이트 4종(`npm run typecheck && npm run lint && npm test && npm run check-smp`, **exit code 확인**)→커밋(`feat(editor): …`). 브라우저(`npm run dev`, ≥1024px)로 시각 확인.

---

## 9. 게이트 & 커밋 규칙 (CLAUDE.md)

- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` — 전부 통과 후 커밋.
- atomic commit(하나의 논리 변경=하나의 커밋), Conventional Commits.
- UI 텍스트 영어, 코드 주석 한국어, trailing space 금지, 하드코딩 색 금지.
- 완료 후 `feat/editor-workspace-ui` → main 병합(fast-forward 유지) → push.
