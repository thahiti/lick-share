# ScoreLink 데스크톱 DAW 편집 화면 설계 (P11 v2)

작성일: 2026-07-12
대체: `2026-07-12-desktop-responsive-design.md`의 레이아웃 부분(§4·§5·§7).
키보드 단축키(동 문서 §6)는 그대로 유지·재사용한다.

## 1. 배경과 목표

좌우 2패널(모바일 컨트롤을 옆으로 옮긴 형태)은 데스크톱다운 경험을 주지 못했다.
목업(다크 DAW 스타일)에 따라 데스크톱 편집 화면을 **전용 레이아웃**으로 재구성한다:

- 상단 트랜스포트 바 (제목·메타·재생·템포·실행취소·공유)
- 전곡 코드 레일 (마디별 코드가 가로로 한눈에)
- 전곡 피아노롤 (노트 = 길이만큼 스팬되는 블록, 레드 플레이헤드)
- 우측 인스펙터 (선택한 노트의 음높이·위치·길이 + 반주 설정)
- 하단 오선 악보 (항상 표시) + 상태 바
- 다크 테마

## 2. 범위

### 포함
- 데스크톱(≥900px) **편집 화면 전용** 다크 DAW 레이아웃.
- 클릭 입력 + 인스펙터 편집 (모바일 padTap과 동일한 의미론).
- 기존 좌우 2패널 데스크톱 CSS 제거(대체).

### 제외 (후속 단계)
- 루프 재생, 확대/축소(줌), 세기(velocity — 데이터 모델·해시 버전에 영향).
- 드래그 이동·리사이즈 (클릭+인스펙터로 충분).
- 모바일(<900px)·열람 화면·커뮤니티 화면 변경 (열람 데스크톱은 기존 680px 중앙 컬럼 유지).

## 3. 불변 조건

- 모바일 편집·열람 렌더는 현재와 동일 (회귀 없음).
- core/engine/ports/adapters 불변. 오디오·골든 스냅샷 무영향.
- 편집 의미론 동일: 피아노롤 클릭 = `padTap`과 같은 코어 함수 경로 (입력/선택/삭제/토스트/프리뷰/undo 전부 동일).
- 색상은 tokens.css 변수만 사용. SMP 기호 금지.
- 게이트 4종 통과.

## 4. 모드 분기

- 신규 훅 `useMediaQuery('(min-width: 900px)')` (ui 레이어, matchMedia 구독).
- `App`: 편집 모드이고 데스크톱이면 `<DawEdit>`, 아니면 기존 모바일 트리.
  두 트리는 동일한 스토어·플레이어 핸들러를 공유한다(핸들러는 App에 유지).
- 열람 모드는 기존 그대로 (`.app--view`, 680px).
- 키보드 단축키 훅은 편집 모드 공통(레이아웃 무관).

## 5. 다크 테마 — 토큰 재정의 전략

`.daw` 스코프에서 **기존 토큰을 재정의**해 재사용 컴포넌트(Score, ChordPicker,
popover)가 코드 수정 없이 다크로 렌더되게 한다. Score는 전부 `var(--ink)`,
`var(--staff)` 등 변수만 사용하므로 그대로 반전된다.

```css
.daw {
  /* 재정의 (라이트 → 다크) */
  --ink / --mut / --mut2 / --line / --line2 / --staff / --rest-glyph / --chord-text
  /* 신규 DAW 전용 */
  --daw-bg (앱 배경) / --daw-panel (패널) / --daw-cell (롤 셀) / --daw-cell-db (정박)
  --daw-note (노트 블록, 인디고) / --daw-note-sel (선택 노트, 주황적)
  --daw-chord (코드 칩, 틸) / --daw-chord-bd (코드 칩 테두리)
}
```

- `--red`는 그대로 (플레이헤드·삭제·경고).
- 전부 tokens.css에 정의. DAW 구조 스타일은 신규 `src/styles/daw.css`.

## 6. 레이아웃 구조

```
.daw  (min-height:100dvh, 다크 배경, 내부 max-width 1200 중앙)
├─ .daw-top      트랜스포트 바
├─ .daw-main     grid [1fr | 260px]
│   ├─ .daw-left   ChordRail → PianoRoll
│   └─ Inspector
├─ .daw-score    악보 패널 (기존 Score, 폭=패널 폭 측정)
└─ .daw-status   "N마디 전체 표시" · "자동 저장 · v1"
```

### 6.1 DawTopBar
제목 + 메타(조성·박자·마디) | 재생▶/정지⏹ · 메트로놈 · 템포 칩(팝오버 재사용 패턴)
| 실행취소·재실행·삭제 | 공유·보기. 기존 `data-btn` 명명 유지(playall, metro,
tempo, undo, redo, del, share, view).

### 6.2 ChordRail (전곡)
마디마다: 마디 번호 + 박 슬롯(일반 4, 못갖춘 2). 슬롯 클릭 =
`gotoMeasure(m)` + 피커 열기(App의 기존 `cpBeat` 상태 재사용 → Esc 동작 그대로).
ChordPicker 컴포넌트 재사용(토큰 재정의로 다크 렌더). beatKey 계산은
`measStart(song, curM)/4 + b` (기존과 동일).

### 6.3 PianoRoll (전곡)
- 행: 흰건반 전체(PMAX→PMIN) + **곡 전체에 존재하는 ♯음** (모바일 padRows의
  전곡 버전). 쉼표 행 없음 — 삭제는 선택 후 재클릭/Delete, 쉼표는 파생(SPEC 유지).
- 열: 전곡 스텝(pickup 포함, `total(song)`). 마디 경계 굵은 선, 정박 구분.
- 레이어: 배경 셀 버튼 그리드(입력용) + 노트 블록(그리드 column span=d) +
  플레이헤드(absolute, `playEl/total` 비율).
- 셀 클릭 → `onCellTap(m, pv, st)` (마디 상대 st). 노트 블록 클릭 → 시작 셀과
  동일한 padTap 경로(선택, 선택 상태서 재클릭=삭제).
- 세로 스크롤(높이 고정 ~320px), 선택 노트 따라 스크롤(모바일 Pad와 동일 패턴).
- 마디 수가 많으면 가로 스크롤 (`overflow-x:auto`, 스텝 최소폭).

### 6.4 Inspector
- **선택한 노트** 카드: 음높이/위치/길이 — 각 행 `[−] 값 [+]`,
  기존 `stepPitch/stepPos/stepLen` 호출. 라벨 포맷은 Steppers의 것을
  `src/ui/labels.ts`로 추출해 공유(pName, posLabel, LEN_NAME). 선택 없으면 비활성.
- **반주** 카드: 전역 패턴(끔/패드/컴핑/아르페지오 = `setAccGlobal`) +
  현재 마디 오버라이드 순환(`cycleMeasureAcc`, 기존 ACC_LAB 라벨).

### 6.5 스토어 확장 (유일한 신규 액션)
```ts
/** 지정 마디 기준 padTap — 전곡 피아노롤용. 단일 undo 엔트리 */
padTapAt(m: number, pv: Midi | 'rest', st: number): void
// 구현: apply((c) => padTap({ ...c, curM: asBar(m) }, pv, st))
```
core 변경 없음 — ctx의 curM만 바꿔 기존 순수 함수를 그대로 호출한다.

## 7. 파일 영향

| 파일 | 변경 |
|---|---|
| `src/ui/hooks/useMediaQuery.ts` (+test) | 신규 |
| `src/ui/store/songStore.ts` (+test) | `padTapAt` 추가 |
| `src/ui/components/edit/daw/DawEdit.tsx` | 신규 — 조립 |
| `src/ui/components/edit/daw/DawTopBar.tsx` | 신규 |
| `src/ui/components/edit/daw/ChordRail.tsx` | 신규 |
| `src/ui/components/edit/daw/PianoRoll.tsx` (+test) | 신규 |
| `src/ui/components/edit/daw/Inspector.tsx` (+test) | 신규 |
| `src/ui/labels.ts` | 신규 — Steppers 라벨 로직 추출 |
| `src/ui/components/edit/Steppers.tsx` | labels 사용으로 리팩터 (동작 불변) |
| `src/ui/components/App.tsx` (+test) | 미디어쿼리 분기, DAW 연결 |
| `src/styles/tokens.css` | `.daw` 토큰 블록 |
| `src/styles/daw.css` | 신규 — DAW 구조 스타일 |
| `src/styles/global.css` | 기존 ≥900px 2패널 그리드 블록 제거 |
| `docs/DESIGN.md` §7 | 데스크톱 규격을 DAW로 교체 |
| `docs/e2e-checklist.md` | 데스크톱 섹션 교체 |

## 8. 테스트 전략

- `useMediaQuery`: matchMedia 목으로 초기값·change 반응·해제.
- `padTapAt`: 다른 마디 빈 칸 입력 → 노트 추가 + curM 이동 + undo 1회로 복원.
- `PianoRoll`: 노트 수만큼 블록, 블록 column span=d, 빈 셀 클릭 콜백 (m, pv, st),
  플레이헤드 존재/부재, ♯행은 곡에 있을 때만.
- `Inspector`: 선택 시 라벨 표시(라4 등), ± 클릭 디스패치, 미선택 비활성.
- App: matchMedia를 데스크톱으로 목 → `.daw` 렌더 + 코드 슬롯 클릭 → 피커 열림
  → Esc 닫힘. 모바일(기본 목) → 기존 트리 그대로 (기존 테스트가 커버).
- 다크 CSS는 jsdom 검증 불가 → 스크린샷 수동 확인 + e2e 체크리스트.

## 9. 완료 정의 (DoD)

1. ≥900px 편집: 다크 DAW 레이아웃(top bar / 코드 레일 / 피아노롤 / 인스펙터 /
   하단 악보 / 상태 바) 렌더, 목업과 구성 일치.
2. 피아노롤에서 입력·선택·삭제가 모바일 패드와 동일한 의미론으로 동작.
3. 인스펙터로 음높이·위치·길이 편집 동작.
4. <900px 편집·열람·커뮤니티 화면 회귀 없음.
5. 키보드 단축키 전부 유지 동작.
6. 게이트 4종 통과, 골든 스냅샷 불변.
