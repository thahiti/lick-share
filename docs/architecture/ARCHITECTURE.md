# ScoreLink 아키텍처 — TypeScript + React 재작성 설계

프로토타입 리뷰에서 확인된 7가지 문제(타입 부재, 전역 가변 상태, innerHTML 재생성, SVG 문자열 조립, 오디오 선행 예약, 매직 넘버 산재, 테스트 부재)를 해소하는 구조.

## 1. 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 빌드 | Vite (react-ts 템플릿) | 단일 SPA, 정적 호스팅 |
| 언어 | TypeScript strict | 축약 필드(s/d/p)의 의미를 타입+JSDoc으로 고정 |
| UI | React 18 함수 컴포넌트 | |
| 상태 | Zustand + 커스텀 undo 미들웨어 | 전역 가변 변수 15개를 단일 스토어로. Redux 대비 보일러플레이트 최소 |
| 테스트 | Vitest + @testing-library/react + jsdom | 도메인=단위, UI=상호작용 테스트 |
| 오디오 | Web Audio 직접 (Tone.js 미도입) | 프로토타입 신스 사양을 그대로 이식, 의존성 최소 |
| 스타일 | CSS Modules + tokens.css (CSS 변수) | DESIGN.md 토큰을 단일 파일로 |

## 2. 폴더 구조

```
src/
  domain/            # 순수 함수만. DOM/React/Audio import 금지 (ESLint로 강제)
    types.ts         # Note, Song, AccPattern, EditorState 등 전체 타입
    constants.ts     # SPM, PMIN/PMAX, LEN_STEPS, PICKW, 조판 상수(LAYOUT)
    geometry.ts      # TOTAL, measStart/Len/Of/CountAll, lineOf, measX/W, posX, pitchDia
    rests.ts         # deriveRests(notes, song) → RestGlyph[]  (박 정렬 분해)
    overlap.ts       # resolveOverlap(notes, changed) → Note[]
    chords.ts        # parseChord, chordTones, chordAtBeat, ACC_INT, ROOT_PC
    accompaniment.ts # buildAccEvents(song, range) → AccEvent[] (순수 스케줄 계산)
    codec.ts         # encodeSong/decodeSong (+구버전 호환), base64url
    editing.ts       # 조작 로직: addNote, deleteNote, makeRest, stepPitch/Pos/Len,
                     #   duplicatePrev/Next, addMeasure, addPickup, setChord, cycleMeasureAcc
  store/
    songStore.ts     # Zustand: {song, sel, curM, cpOpen, cpBeat, mode} + actions
    undo.ts          # 스냅샷 미들웨어 (60개, editing 액션에만 적용)
  audio/
    engine.ts        # AudioEngine 싱글턴 클래스: ctx/master, play(range), stop,
                     #   toggleMetro/AccLive, 플레이헤드 구독(onTick(el))
    synth.ts         # pianoAt, clickAt (SPEC §6 사양 그대로)
  components/
    App.tsx          # mode 라우팅 (edit/view), 해시 로드
    edit/
      Header.tsx  TempoPopover.tsx  AccPopover.tsx
      Score.tsx        # React SVG. 조판은 domain/geometry 사용
      ChordRow.tsx  ChordPicker.tsx
      Pad.tsx          # 행 파생(padRows), 셀 상태, 스크롤 관리(useRef)
      MeasureBar.tsx  Steppers.tsx  ButtonBar.tsx
    view/
      Viewer.tsx       # 멀티라인 Score 재사용(props로 mode 분기)
    common/ Icon.tsx  Toast.tsx
  styles/ tokens.css  (DESIGN.md §2~§4)
```

## 3. 상태 설계

```ts
// 영속(URL에 저장) — Song 그대로
// 세션(휘발) — 에디터 상태
interface EditorState {
  sel: number | null;      // 선택 노트 id
  curM: number;            // 현재 마디 (pickup이면 0=못갖춘)
  cpOpen: boolean; cpBeat: number;
  mode: 'edit' | 'view';
  metroOn: boolean; accOn: boolean;   // 재생 보조 — URL 미저장
}
// 재생 상태는 React 밖 (AudioEngine 내부) + 구독으로 플레이헤드만 전달
```

원칙:
- **undo 대상 = Song 전체 스냅샷** (notes/chords/tempo/meas/pickup/accPat/mAcc). 에디터 상태는 제외하되 restore 후 sel/curM 정합성 보정(프로토타입과 동일).
- 모든 변형은 `domain/editing.ts`의 순수 함수 `(song, params) => song'`로 계산하고 스토어 액션은 이를 감싸기만 한다. → 도메인 로직이 테스트 가능하고 UI 독립적.

## 4. 렌더링 전략

- **Score**: `<ScoreSvg song sel curM line mode onMeasureTap onNoteTap/>`. 내부에서 geometry로 좌표 계산 후 JSX SVG 요소 반환. 문자열 조립 금지. 음자리표/쉼표는 `<ClefPath/>`, `<RestGlyph kind/>` 컴포넌트.
- **Pad**: 행/셀을 key 안정적으로 렌더(React 재조정이 innerHTML 재생성 문제 해소). 스크롤 위치는 `useRef<HTMLDivElement>` + `useLayoutEffect`로 선택 노트 가시화(SPEC §3.5).
- 조판 상수는 `constants.ts`의 `LAYOUT` 객체 한 곳에만 (매직 넘버 중복 금지). 플레이헤드도 같은 상수 사용.

## 5. 오디오 설계

- `AudioEngine`은 React 외부 싱글턴. 컴포넌트는 `engine.play({from,to,view})`, `engine.stop()`, `engine.setMetro(on)`, `engine.setAcc(on)` 호출과 `engine.onTick(cb)` 구독만.
- 내부: 재생 세션 `{t0,sps,from,to,view}` 보관 → 메트로놈/반주 실시간 토글은 프로토타입 방식(현재 el 이후 스케줄 / 해당 노드군 stop) 그대로. 노드군 3종 추적: melody / metro / acc.
- **개선(선택)**: 전곡 선행 예약 대신 lookahead 스케줄러(25ms 인터벌, 0.1s 윈도)로 교체하면 일시정지·긴 곡 대응. Phase 7 완료 기준은 프로토타입 동작 재현이며, lookahead는 P9 개선 항목.
- 신스/엔벨로프/컴프레서 수치는 SPEC §6 고정값. **게인 불연속 금지**를 synth.ts 주석과 테스트(파라미터 호출 시퀀스 검증)로 명문화.

## 6. URL/라우팅

- 해시(`#v1.…`)가 단일 소스. 편집 변경 시 디바운스(500ms)로 `history.replaceState` 갱신(프로토타입은 공유 시에만 갱신했으나 자동 저장 강화).
- `?mode=view` → Viewer. "복제해서 편집"은 mode 파라미터 제거.
- codec은 SPEC §7 포맷 유지 — **기존 프로토타입 링크가 그대로 열려야 한다** (하위 호환 테스트 필수).

## 7. 프로토타입 → 신규 코드 매핑

| 프로토타입 전역/함수 | 신규 위치 |
|---|---|
| song, sel, curM, cpOpen… | store/songStore |
| TOTAL, measStart/Len/Of, lineOf, measX/W, posX, pitchDia | domain/geometry |
| 자동 쉼표 루프 (renderScore 내) | domain/rests.deriveRests |
| resolveOverlap | domain/overlap |
| chordTones, chordAtBeat, parseChord | domain/chords |
| scheduleAccFrom의 세그먼트 그룹핑 | domain/accompaniment.buildAccEvents (순수) + audio에서 시각만 부여 |
| encodeSong/decodeSong | domain/codec |
| padTap/stepPitch/stepPos/stepLen/selectDir/addPickup/mNext | domain/editing + store 액션 |
| pianoAt/clickAt/master | audio/synth |
| playRange/stopPlayhead/playSession | audio/engine |
| renderScore/renderPad/renderChordRow… | components/* |

## 8. 품질 게이트 (모든 Phase 공통)

- `npm run typecheck` (tsc --noEmit) 무오류.
- `npm test` 전체 통과 — 이전 Phase 테스트 포함(회귀 금지).
- domain/에서 react·dom import 시 ESLint 에러 (no-restricted-imports).
- SMP 유니코드 문자(U+1D100 대역)가 src에 존재하면 실패하는 lint 스크립트 (`scripts/check-no-smp.js`).
