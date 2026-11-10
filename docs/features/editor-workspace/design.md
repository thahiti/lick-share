# 에디터 워크스페이스 (데스크톱 ≥1024px) — 설계

- 작성일: 2026-07-13
- 상태: 승인됨 (구현 대기)
- **대체: `2026-07-12-desktop-daw-design.md`의 레이아웃 전부** — 다크 DAW(트랜스포트 바 /
  코드 레일 / 피아노롤 / 인스펙터)를 라이트 워크스페이스로 전면 교체한다.
  동 문서의 편집 의미론(피아노롤 클릭 = padTap 경로)과 `padTapAt` 스토어 액션은 유지·재사용.
- 관련: `2026-07-13-desktop-community-layout-design.md` (브랜드 토큰을 공유),
  `2026-07-12-desktop-responsive-design.md` §6 (키보드 단축키 — 유지 + A~G 확장)

## 1. 배경과 목표

다크 DAW 레이아웃은 커뮤니티 라이트 톤과 단절되고, 악보와 피아노롤이 서로 다른 좌표계로
그려져 마디 경계가 일치하지 않았다. 라이트 테마 워크스페이스로 교체하고, **악보·피아노롤·
재생 헤드·선택이 하나의 타임라인 좌표(px/step)를 공유**하도록 재구성한다.

## 2. 범위

### 포함
- 데스크톱(≥1024px) 편집 화면 전면 교체 (`Workspace` — 구 `DawEdit` 대체)
- 공유 타임라인 순수 모듈 `src/core/timeline.ts` + 줌(pxPerStep)
- 데스크톱 악보 한 줄 조판(`StaffLane`) — 마디폭 = SPM × pxPerStep
- 피아노롤 드래그 편집 (이동·리사이즈, pointerup 단일 undo)
- A~G 음 입력 단축키
- 가로 피아노 건반(`PianoKeys`) — 클릭 = 현재 위치 입력
- `PropertyPanel` (구 `Inspector` 대체): 제목/템포/박자/음길이/코드/반주
- 단축키 힌트 행
- 데스크톱 브레이크포인트 900px → **1024px** 통일

### 제외 (YAGNI — 의도적)
- 재생 시 건반 눌림 애니메이션
- velocity (데이터 모델·해시 버전에 영향)
- 루프 재생

## 3. 불변 조건

- 모바일(<1024px) 편집·열람·커뮤니티 렌더 회귀 없음. 모바일·열람 화면의 다단 조판 불변.
- core/engine/ports 순수 유지 — 신규 `timeline.ts`도 순수 함수만.
- 편집 의미론 동일: 피아노롤 셀 클릭 = `padTapAt` 경로(입력/선택/삭제/토스트/프리뷰/undo 동일).
- 재생·undo 배선 기존 유지. 골든 스냅샷 불변.
- 색상은 tokens.css 변수만. SMP 유니코드 금지 — 쉼표·음표 기호 전부 SVG 패스
  (♩ U+2669는 BMP라 허용).
- 게이트 4종 통과.

## 4. 구조 (src/ui/components/edit/daw/ 트리 재구성 — 라이트 테마)

```
Workspace (구 DawEdit 대체, .ws 스코프)
├─ WsTopBar: ← 뒤로 · 곡 제목 · "Auto-saved"(muted) | [Share] 아웃라인 · [Publish] primary(화면 유일)
├─ .ws-main grid [1fr | 260px]
│  ├─ 편집 캔버스 (세로 순서):
│  │  1. 트랜스포트 행: 원형 재생버튼(tint 배경 + tint-text 아이콘) · 템포 칩 "♩ = 100"
│  │     · 우측 줌 −/＋ (메트로놈·undo/redo/삭제 아이콘은 우측 클러스터에 유지)
│  │  2. 오선보 패널(StaffLane) ┐ 하나의 가로 스크롤 컨테이너(.ws-scroll)
│  │  3. 피아노롤 패널(PianoRoll) ┘ (마디 경계 px 일치, 톤 다운 배경 --bg-page + 8px 라운드)
│  │  4. 단축키 힌트 행 (키캡 뱃지 + 설명)
│  │  5. 가로 피아노 건반(PianoKeys)
│  └─ PropertyPanel (구 Inspector 대체)
└─ ChordPicker 팝오버 (기존 재사용) · Toast
```

- `ChordRail`·`DawTopBar`·`Inspector` 컴포넌트 제거. 다크 `.daw` 토큰 블록 제거.
- 브레이크포인트: `useMediaQuery('(min-width: 1024px)')`. 열람 데스크톱 컬럼(global.css)도 1024로.

## 5. 공유 타임라인 (필수 요구)

- 신규 순수 모듈 `src/core/timeline.ts`:
  ```ts
  stepToX(step, pxPerStep)      // 스텝 좌측 x
  stepCenterX(step, pxPerStep)  // 스텝 중앙 x (악보 음표 머리)
  spanW(d, pxPerStep)           // 길이 → 폭
  xToStep(x, pxPerStep)         // 역변환 (드래그)
  clampZoom(v)                  // ZOOM_MIN(8)~ZOOM_MAX(32), 기본 ZOOM_DEFAULT(14)
  ```
- 악보·피아노롤·재생 헤드·선택 하이라이트가 전부 이 변환을 공유한다.
  **각 뷰가 독립적으로 x를 계산하지 않는다.** 줌은 pxPerStep 하나만 조정.
- 데스크톱 악보는 **줄바꿈 없는 한 줄 조판** — 마디폭 = SPM × pxPerStep.
  악보 음자리표 거터 폭 = 피아노롤 피치 레이블 열 폭 = `LAYOUT.GUTTER_W`(신규, core constants),
  가로 스크롤 시 양쪽 거터 sticky.
- 재생 헤드: `--playhead` 코랄 세로선 + 상단 원형 핸들, 악보·피아노롤 관통(같은 x로 동기).
- 피아노롤: 좌측 피치 레이블 열, 마디 경계 굵은 선 / 박 단위 얇은 선 / 피치 행 얇은 가로선,
  노트 블록 = `--note-block` 라운드 3~4px 길이∝음가, 선택 = `--note-block-selected`.
- 음표 글리프(NoteSeg·RestGlyph·ClefPath)는 Score에서 export해 StaffLane이 재사용 —
  조판 수치 중복 정의 금지.

## 6. 편집 인터랙션

### 6.1 피아노롤 드래그 (신규)
- 노트 본체 드래그 = 음높이(세로) + 시작 위치(가로), 우측 가장자리 드래그 = 길이.
- 드래그 중에는 로컬 상태로 프리뷰만 렌더하고, **pointerup에 단일 undo 엔트리로 커밋** —
  신규 core 순수 함수 `updateNote(ctx, id, {s?, p?, d?})`(클램프 + resolveOverlap 재사용)
  + 스토어 액션 1개 `dragNote(id, patch)`.
- 포인터 이동이 임계값 미만이면 클릭으로 처리(기존 padTap 선택/삭제 의미론 유지).

### 6.2 A~G 음 입력 (신규 단축키)
- 노트 선택 중: 선택 노트를 해당 음이름의 **가장 가까운 옥타브**로 재배치
  (거리 동률이면 아래쪽, PMIN~PMAX 클램프) — core `letterPitch(ref, letter)` + `renoteSel`.
- 선택 없음: 현재 마디의 **다음 빈 박**(박 시작 스텝이 비어있는 첫 박)에 현재 음길이
  (`inputLen` 세션 상태, 기본 4)로 입력 후 선택 — core `insertAtFreeBeat(ctx, p, len)`.
  빈 박이 없으면 토스트. 옥타브는 직전 노트(없으면 C5=72) 기준 가장 가까운 위치.
- `useKeyboardShortcuts`에 `noteC`~`noteB` 액션 추가. input/textarea 포커스·IME 조합 중 무시
  (기존 가드 재사용). 한글 자판 보정(KeyA~KeyG)도 기존 CODE_KEYS 패턴으로.
- 기존 단축키(화살표/hjkl, Space, Enter, [, ], Delete, Cmd+Z 등) 전부 유지하고 힌트 행에 노출.

### 6.3 피아노 건반 클릭
- 흰건반 라운드 3px + hairline, 검은건반 높이 55~60%, C 레이블(C4/C5 포함).
- 클릭 = 현재 위치 입력 — §6.2의 선택 없음 경로(`insertAtFreeBeat`)와 동일 (피치만 건반 값).

### 6.4 PropertyPanel
- 제목 입력 (신규 스토어 액션 `setTitle` — 메타데이터라 undo 스택에는 쌓지 않음)
- 템포 숫자 입력(40~240, core setTempo가 클램프) · 박자 "4/4" 고정 표시 (2열)
- 음길이 세그먼트: LEN_STEPS 8단계. 선택 = `--brand-tint` 배경 + `--brand-outline` 보더.
  선택 노트 있으면 길이 직접 설정(core `setNoteLen`), 항상 `inputLen` 세션 갱신.
  쉼표 버튼(SVG 글리프) = 선택 노트 삭제(쉼표는 파생 — 데이터로 저장하지 않음).
- 선택 마디 코드: 박 4슬롯 — 클릭 = 기존 ChordPicker 팝오버 (악보 위 코드 심볼 클릭과 동일).
- 반주 드롭다운: Off·Pad·Comp·Arp = 기존 `setAccGlobal`. 마디 오버라이드 버튼 유지.

### 6.5 코드 편집
- PropertyPanel 코드 슬롯 클릭 **또는** 악보(StaffLane) 위 코드 심볼 클릭 → 기존 ChordPicker.
- `cpBeat` 상태·beatKey 계산(`measStart/4 + b`)·Esc 닫기 전부 기존 유지. ChordRail 제거.

## 7. 스토어·core 확장

| 계층 | 추가 | 내용 |
|---|---|---|
| core `timeline.ts` (+test) | 신규 | §5 변환 함수 (순수) |
| core `constants.ts` | `LAYOUT.GUTTER_W` | 거터/레이블 열 폭 단일 정의 |
| core `editing.ts` (+test) | `updateNote`, `setNoteLen`, `insertAtFreeBeat`, `renoteSel`, `letterPitch`, `setTitle` | 전부 순수, resolveOverlap 재사용 |
| store `songStore.ts` (+test) | `dragNote`, `setLen`, `noteLetter`, `keyTap`, `setTitle`, `inputLen` | core 위임 + 단일 undo |
| ui `useKeyboardShortcuts` (+test) | `noteC`~`noteB` | A~G 매핑 |

## 8. 테스트 전략

- `timeline.ts` 단위 테스트 (변환·역변환·줌 클램프).
- A~G: resolver 매핑 + 스토어 `noteLetter`(선택 재배치 / 빈 박 입력 / 가득 참 토스트).
- 드래그: `dragNote` 커밋이 **undo 1회**로 원복되는 스토어 테스트 + 롤 pointer 시퀀스 테스트.
- Workspace 구조 테스트 (기존 daw 테스트를 새 구조로 이전·교체 — DawTopBar/Inspector/
  PianoRoll 테스트 대체).
- 골든 스냅샷·모바일(<1024px) 기존 테스트 전부 그대로 통과.
- CSS 시각 항목(스크롤 동기·sticky 거터·줌)은 `docs/e2e-checklist.md` 갱신 후 수동 확인.

## 9. 완료 정의 (DoD)

1. ≥1024px 편집: 라이트 워크스페이스(WsTopBar/트랜스포트/악보+롤 공유 스크롤/힌트/건반/
   PropertyPanel) 렌더.
2. 악보·피아노롤 마디 경계 px 일치, 재생 헤드 양쪽 동기, 줌으로 동시 확대.
3. 드래그 이동·리사이즈가 pointerup 단일 undo로 커밋.
4. A~G 입력·건반 클릭 입력 동작. 기존 단축키 전부 유지.
5. <1024px·열람·커뮤니티 회귀 없음. 게이트 4종 통과, 골든 스냅샷 불변.
