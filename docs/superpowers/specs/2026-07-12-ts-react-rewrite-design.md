# ScoreLink TypeScript + React 재작성 설계 (harness 통합본)

작성일: 2026-07-12. `score-link-prototype_1.html`(= `scorelink-handoff/prototype-reference.html`, 동일 파일)을
TypeScript + React 제품 코드로 재작성하기 위한 확정 설계.

## 0. 문서 관계와 우선순위

이 문서는 두 선행 문서의 충돌을 해소한 통합본이다.

| 선행 문서 | 역할 | 이 설계에서의 지위 |
|---|---|---|
| `harness.md` | ports/adapters 아키텍처 + 테스트 하네스 설계 | **구조의 기준** — 레이어, schedule(), 테스트 3층, 툴링 |
| `scorelink-handoff/SPEC.md` | 기능 명세 (데이터 모델, 알고리즘, 사운드 수치) | 기능의 기준 — 변경 없음 |
| `scorelink-handoff/DESIGN.md` | 디자인 시스템 (토큰, 컴포넌트 규격) | 스타일의 기준 — 변경 없음 |
| `scorelink-handoff/ARCHITECTURE.md` | 이전 구조안 (domain/store/audio/components) | **대체됨** — 단, §2 컴포넌트 목록·§7 매핑표는 이 문서가 계승 |
| `scorelink-handoff/IMPLEMENTATION_PLAN.md` | 이전 Phase 0~9 계획 | **재배치됨** — DoD 수치는 전량 보존, Phase 구성만 §4대로 변경 |

우선순위: 이 문서(구조) > SPEC.md(기능) > DESIGN.md(스타일) > 프로토타입(동작 참고).

## 1. 프로젝트 위치와 산출물

- 저장소: `lick_share/scorelink/` (git init 완료, main 브랜치)
- handoff 문서(SPEC, DESIGN 등)는 Phase 0에서 `docs/`로 복사
- CLAUDE.md: handoff의 것을 기반으로 harness 규칙 추가(§6 참조)하여 저장소 루트에 배치

## 2. 레이어 구조

의존 화살표는 항상 안쪽(core)을 향한다. core가 ui/adapters를 import하면 컴파일 에러가 나도록 강제한다(§5).

```
scorelink/
  docs/                        # 문서 일체
  scripts/
    check-no-smp.js            # src 내 U+1D100~U+1D1FF 존재 시 exit 1
    dump.ts                    # npm run dump -- "#v1.…" → 이벤트 테이블 + ASCII 피아노롤
  src/
    core/                      # 완전 순수. 전용 tsconfig에서 lib DOM 제거
      types.ts                 # Note, Song + branded types(Step, Midi, Sec, BarIndex)
      constants.ts             # SPM, PMIN/PMAX, LEN_STEPS, INPUT_LEN, PICKW, LAYOUT(조판 상수 단일 출처)
      geometry.ts              # TOTAL, measStart/Len/Of/CountAll, lineOf, measX/W, posX, pitchDia
      overlap.ts               # resolveOverlap — SPEC §5.1
      rests.ts                 # deriveRests — SPEC §5.2 (쉼표는 항상 파생, 저장 금지)
      chords.ts                # parseChord, chordTones, chordAtBeat — SPEC §5.3~5.4
      editing.ts               # padTap, stepPitch/Pos/Len, duplicatePrev/Next, addPickup/Measure,
                               #   setChord, cycleMeasureAcc — 전부 (song, params) => song'
      undo.ts                  # 스냅샷 스택 60개 (순수 자료구조)
      codec.ts                 # encodeSong/decodeSong, base64url, v1 태그 검사 + 구버전 호환
    engine/                    # core만 의존
      schedule.ts              # schedule(song, opts, fromStep) → SoundEvent[] — 심장부
      accompaniment.ts         # buildAccEvents — SPEC §5.5 (schedule 내부에서 사용)
    ports/                     # 인터페이스만. 의존 없음
      audio-sink.ts            # play(SoundEvent[]), cancelFrom(t), stop()
      clock.ts                 # now(), onFrame(cb)
      hash-store.ts            # read(), write(hash)
    adapters/                  # ports 구현
      web-audio-sink.ts        # SPEC §6.1 신스 수치 그대로. 게인 불연속 금지
      raf-clock.ts
      location-hash-store.ts
      player.ts                # 재생 세션 {t0,sps,from,to,view} + onTick 구독 +
                               #   실시간 토글(sink.cancelFrom → 현재 step부터 재스케줄)
      fakes/                   # FakeAudioSink(배열 기록), FakeClock(시간 밀기), MemoryHashStore
    ui/
      store/songStore.ts       # Zustand. core/editing·undo 순수 함수를 감싸기만 한다
      components/
        App.tsx                # mode 라우팅(edit/view), 해시 로드
        edit/  Header, TempoPopover, AccPopover, Score, ChordRow, ChordPicker,
               Pad, MeasureBar, Steppers, ButtonBar
        view/  Viewer           # 멀티라인 Score 재사용(props로 mode 분기)
        common/ Icon, Toast
    styles/tokens.css          # DESIGN.md §2~§4 토큰. 하드코딩 색상 금지
```

### 이전 구조안과의 차이 (핵심 1가지)

handoff ARCHITECTURE.md의 "AudioEngine 싱글턴이 스케줄+재생 겸업" 대신,
**스케줄 계산(순수)과 소리 재생(부수효과)을 분리**한다:

```ts
// 곡 + 설정 + 시작 위치 → 울려야 할 소리들의 "목록" (순수 함수)
schedule(song: Song, opts: PlayOpts, fromStep: Step): SoundEvent[]
```

재생 경로 4개가 전부 이 함수 하나로 환원된다:

| 요구사항 | 환원 |
|---|---|
| 전체 재생 | `schedule(song, opts, 0)` |
| 마디 재생 | `schedule(song, opts, measStart(curM))` (범위 `~+measLen`) |
| 열람 화면 음표 탭 재생 | `schedule(song, {melody, accomp:'off', metro:false}, tappedStep)` |
| 재생 중 반주/메트로놈 토글 | `sink.cancelFrom(now)` 후 `schedule(song, 새 opts, 현재 step)` |

SoundEvent에는 종류 태그(melody/acc/metro)를 부여해, 부분 토글 시 해당 노드군만
cancel하는 프로토타입 동작(SPEC §6.2~6.3)을 sink 레벨에서 재현한다.

## 3. 상태 설계

handoff ARCHITECTURE §3을 그대로 계승한다.

- 영속(URL) = Song 전체. 세션(휘발) = `{sel, curM, cpOpen, cpBeat, mode, metroOn, accOn}`
- undo 대상 = Song 전체 스냅샷(60개). restore 후 sel/curM 정합성 보정
- 모든 변형은 `core/editing.ts` 순수 함수로 계산, 스토어 액션은 감싸기만
- 재생 상태는 React 밖(`adapters/player.ts`) + onTick 구독으로 플레이헤드만 전달

## 4. 구현 Phase (0~10)

각 Phase는 독립 커밋 단위. 공통 게이트: `npm run typecheck` 무오류, `npm test` 전체 통과
(이전 Phase 테스트 포함), `node scripts/check-no-smp.js` 통과.
**handoff IMPLEMENTATION_PLAN.md의 DoD 수치는 아래 재배치대로 전량 보존한다.**

| Phase | 내용 | DoD 출처 |
|---|---|---|
| P0 | 셋업: Vite react-ts, TS 6.0 고정, ESLint 10 flat + typescript-eslint, Prettier, Vitest + fast-check + testing-library + jsdom, tokens.css, check-no-smp, 아키텍처 강제(§5) | handoff P0 |
| P1 | core 1부: types, constants, geometry, overlap, rests, chords, codec — 단위 + 프로퍼티 테스트 | handoff P1 + 프로퍼티(§5) |
| P2 | core 2부: editing, undo + store 래핑 | handoff P2 + 프로퍼티 |
| P3 | engine: schedule() + buildAccEvents + FakeAudioSink 골든 스냅샷 + dump 계기판 | handoff P6의 이벤트/카운트 DoD를 앞당김 |
| P4 | adapters: WebAudioSink(게인 호출 시퀀스 테스트), RafClock, LocationHashStore, player(실시간 토글) | handoff P6 나머지 |
| P5 | Score 컴포넌트 (edit 단일 라인 / view 멀티라인, SVG 패스 직접 드로잉) | handoff P3 |
| P6 | Pad + ChordRow + ChordPicker | handoff P4 |
| P7 | Steppers + ButtonBar + MeasureBar + Header + Toast | handoff P5 |
| P8 | 조립: 편집 화면 통합, 재생 연동(curM 추적·줄 전환), 해시 자동 저장(500ms 디바운스) | handoff P7 |
| P9 | Viewer + 공유 + 구버전 해시 3종 하위 호환 검증 | handoff P8 |
| P10 | 마감: 접근성, 빌드, e2e 체크리스트, URL 해시 길이 iOS 실측, (선택) lookahead 스케줄러 | handoff P9 |

Phase 순서의 의도: **UI를 만들기 전에(P3~P4) 음악 로직 전체가 FakeAudioSink 로그로
검증 가능한 상태**가 된다. "3마디부터 재생 중 arp로 바꾸면 제대로 이어지는가"를
귀가 아니라 눈(텍스트)으로 확인한다.

### 테스트 하네스 3층

1. **단위** — 편집 연산, 코드 파서, 좌표 변환 (handoff DoD의 구체 검증값 사용)
2. **프로퍼티(fast-check)** — 무작위 입력으로 불변식 검증:
   - `decode(encode(song)) === song` (deep equal)
   - 무작위 편집 100회 후에도: 노트 정렬·무겹침, pitch 53~84, len ∈ LEN_STEPS
   - 노트 + 파생 쉼표 길이 합 = 곡 전체 스텝
3. **골든 스냅샷** — FakeAudioSink 로그를 정답지로 고정.
   대표 곡 × 반주 4종(off/pad/comp/arp) × 메트로놈 on/off

**공통 픽스처**: 데모 곡(handoff 계획 말미의 초기값), 못갖춘마디 곡(전 세트 필수),
마디별 오버라이드 혼합, 코드 없는 첫 구간, 겹침 유발 시퀀스, 최장 URL,
프로토타입이 생성한 실제 해시 샘플 3종(일반/pickup/구버전 — 프로토타입을 브라우저로
열어 공유 버튼으로 생성해 `fixtures/`에 저장).

## 5. 아키텍처를 컴파일러로 강제

- `src/core/tsconfig.json`의 `lib`에서 DOM 제거 → AudioContext 참조 자체가 컴파일 에러
- ESLint `no-restricted-imports`: core/engine에서 react·dom·adapters import 금지
- ESLint `no-restricted-globals`: core 안에서 Date, setTimeout, Math.random 금지
- `noUncheckedIndexedAccess: true` → `notes[i]`가 `Note | undefined`
- Branded type으로 Step, Midi, Sec, BarIndex 구분 (전부 number라 섞이기 쉬움)
- `scripts/check-no-smp.js`: SMP 유니코드 음악 기호(U+1D100~U+1D1FF) 존재 시 실패

## 6. 확정된 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| TypeScript | **6.0 고정** | typescript-eslint가 7.0 미지원. 7.1에서 재평가 |
| 린터 | ESLint 10 flat config + typescript-eslint | harness 결정 |
| 포매터 | **Prettier** | ESLint와 역할 분리 명확. Biome은 lint 겸업으로 중복 |
| 테스트 | Vitest + fast-check + @testing-library/react | harness + handoff 합집합 |
| 상태 | Zustand + 커스텀 undo 미들웨어 | handoff 결정 유지. core 순수 함수의 얇은 래퍼 |
| 오디오 | Web Audio 직접 (Tone.js 미도입) | 프로토타입 신스 수치 그대로 이식 |
| 스타일 | CSS Modules + tokens.css | handoff 결정 유지 |
| **코드 없는 구간의 반주** | **완전 무음** | 프로토타입 실측(line 947): `chordAtBeat`이 null인 박은 패턴 무관 무음 + 세그먼트 flush. 코드는 다음 코드까지 지속되므로(SPEC §5.4) 무음 구간은 첫 코드 이전뿐. P0에서 docs/로 SPEC을 복사할 때 §5.5에 이 규칙을 추가 |
| URL 해시 길이 한계 | P10에서 iOS Safari 실측 | 지금 결정 불가 |

### CLAUDE.md 추가 규칙 (handoff CLAUDE.md에 병합)

- core/engine에서 Date, setTimeout, Math.random, react, DOM, Web Audio import/참조 금지
- Step, Midi, Sec, BarIndex는 branded type 사용 — 생 number 혼용 금지
- 재생 로직 수정 시 골든 스냅샷 갱신은 diff를 눈으로 확인한 뒤에만 커밋

## 7. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| schedule() 순수화 과정에서 프로토타입과 미세한 타이밍 차이 | P3 골든 스냅샷을 프로토타입 코드 판독 기반으로 작성, handoff P6의 osc 카운트 DoD(무반주 N, pad=N+26, comp=N+104, arp=N+64)로 교차 검증 |
| 구버전 해시 하위 호환 파손 | 프로토타입 생성 실제 해시 3종을 픽스처로 고정, P1 codec 테스트 + P9 e2e에서 이중 검증 |
| TS 6.0 ↔ 도구 버전 조합 문제 | P0에서 typecheck/lint/test 파이프라인 전부 가동 확인 후 진행 |
| SMP 문자 유입(복붙 등) | check-no-smp를 모든 Phase 게이트에 포함 |
