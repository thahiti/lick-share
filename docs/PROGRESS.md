# ScoreLink 재작성 — 세션 인수인계 메모 (2026-07-12)

다른 세션에서 이어서 작업하기 위한 현재 상태 기록.

## 1. 확정된 사항

- **목표**: `lick_share/score-link-prototype_1.html`(= `scorelink-handoff/prototype-reference.html`, diff로 동일 확인)을 TypeScript + React로 재작성.
- **확정 설계 문서**: `docs/superpowers/specs/2026-07-12-ts-react-rewrite-design.md` (사용자 승인 완료, 커밋됨).
  - 구조는 `harness.md`(core/engine/ports/adapters/ui + 순수 `schedule()` → SoundEvent[]) 기준.
  - 기능·DoD 수치는 `scorelink-handoff/`의 SPEC.md·IMPLEMENTATION_PLAN.md 전량 보존, Phase만 재배치(P0~P10, 엔진을 UI보다 먼저).
- **프로젝트 위치**: `lick_share/scorelink/` (git init 완료, main 브랜치).
- **툴링 확정** (npm 실측 후 결정):
  - TypeScript **~6.0.3 고정** (7.0.2 존재하나 harness 결정대로 6.0. typescript-eslint 8.63.0과 조합)
  - ESLint 10.7 flat config, Prettier, Vite 8.1, Vitest 4.1, React 19.2, Zustand 5, fast-check 4.9
- **명세 공백 해소**: 코드가 없는 구간(첫 코드 이전)의 반주 = **완전 무음**. 근거: 프로토타입 line 947 `if(!ch||pat==="off"){ flush(st); ... continue; }`. SPEC §5.5에 이 규칙을 추가하기로 함(아직 미반영).
- **작업 규칙**: TDD 필수(superpowers:test-driven-development — RED 확인 후 구현), Phase 단위 커밋("Phase N: 요약"), 공통 게이트 = `npm run typecheck && npm run lint && npm test && npm run check-smp`.

## 2. 현재 상태 (P6 완료)

P0~P6 완료·커밋됨. 다음 작업: **P7 (Steppers + ButtonBar + MeasureBar + Header + Toast)** — DoD는 handoff IMPLEMENTATION_PLAN P5 (스테퍼 비활성/경계, bPrev/bNext 라벨 전환, 마디바 ＋ 전환, 템포 클램프, 반주 팝오버, 소리 피드백 훅 호출 검증).

- P4 산출물: `src/ports/{clock,hash-store}.ts`(+audio-sink에 now() 추가), `src/adapters/{web-audio-sink,player,raf-clock,location-hash-store}.ts`, fakes(fake-clock, memory-hash-store). WebAudioSink는 AudioCtxLike 구조적 타입으로 목 주입 — 게인 시퀀스 DoD·노드군별 cancel·epoch 검증. player는 onTick/el 클램프/실시간 토글(현재 이후만 재스케줄, off는 해당 노드군만 정지) 검증.
- P5 산출물: `src/core/geometry.ts`에 pitchDia 추가, `src/ui/components/edit/Score.tsx`(edit/view 겸용, ClefPath·RestGlyph·NoteSeg 전부 SVG 패스, 색은 tokens.css 변수만). edit에서 음표는 pointer-events:none — SPEC "음표 개별 탭 불가"를 프로토타입보다 정확히 구현. 테스트용 data-* 속성: data-m/data-shade/data-rest/data-ledger/data-note/data-tie.
- P6 산출물: `src/ui/components/edit/{Pad,ChordRow,ChordPicker}.tsx` + global.css에 DESIGN §4 스타일. core/constants에 NOTE_KO/NOTE_EN/BLACK_PC/pName/pShort 추가. Pad ⤳ 경계 표시는 measStart+measLen 기준(프로토타입의 (curM+1)*SPM은 pickup에서 틀림 — SPEC 우선으로 수정). 스크롤: React가 DOM 보존하므로 유지가 기본, 선택 가시화(y-60)/초기 도5만 effect로.

- P3 산출물: `src/engine/{accompaniment,schedule}.ts`, `src/ports/audio-sink.ts`(SoundEvent에 melody/acc/metro 태그), `src/adapters/fakes/fake-audio-sink.ts`, 골든 스냅샷 16개(`src/engine/__snapshots__/golden.test.ts.snap` — demo·pickup 곡 × 반주 4종 × 메트로놈 2종). osc 카운트 DoD(N=26, pad=N+26, comp=N+104, arp=N+64) 통과.
- `npm run dump -- "#v1.…" [--metro] [--no-acc] [--from=N]` 동작 (vite-node 실행, devDep 추가). 인자 없으면 데모 곡.

- P1 산출물: `src/core/{constants,geometry,overlap,rests,chords,codec}.ts` + 테스트 52개. `fixtures/prototype-hashes.json` 해시 3종 — encode가 프로토타입과 바이트 단위 동일함을 테스트로 고정.
- P2 산출물: `src/core/{editing,undo,demo-song}.ts` + `src/ui/store/songStore.ts`(Zustand vanilla, 순수 함수 래핑만). editing은 `(EditCtx)=>EditOut{changed,toast?,preview?}` 형태 — changed=true일 때만 스토어가 undo push. restore 후 sel/curM 정합 보정 포함. 테스트 누계 95개.

완료된 P0 작업 (전부 검증 통과):
- `package.json` — 의존성 설치 완료, 스크립트: dev/build/test/typecheck/lint/format/check-smp/dump
- `tsconfig.json`(strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes) / `tsconfig.pure.json`(core·engine·ports 전용, **lib에서 DOM 제거**)
- `eslint.config.js` — 순수 레이어에 no-restricted-imports(react/adapters/ui/zustand), no-restricted-globals(Date/setTimeout/window/document/location/AudioContext), Math.random 금지
- `vite.config.ts`(vitest 설정 포함), `.prettierrc.json`, `.gitignore`, `index.html`, `src/main.tsx`
- `src/ui/components/App.tsx`(빈 셸) + `App.test.tsx`(샘플 테스트 1개 통과)
- `src/styles/tokens.css`(DESIGN §2~§4·§7 토큰) + `global.css`(앱 셸)
- `src/core/types.ts` — branded types(Step/Midi/Sec/BarIndex) + Note/Song (tsconfig.pure 입력 확보를 위해 P1에서 앞당김)
- `scripts/check-no-smp.js` — 양성/음성 케이스 모두 검증 완료
- 게이트: typecheck ✅ lint ✅ test 1/1 ✅ check-smp ✅ dev 서버 기동 ✅

### P0 마무리 내역 (2026-07-12 완료)
1. handoff 문서 `docs/`로 복사 완료 (사용자 확인 후): SPEC, DESIGN, ARCHITECTURE, IMPLEMENTATION_PLAN, harness.md, prototype-reference.html
2. `docs/SPEC.md` §5.5에 "코드 없는 구간 무음" 규칙 추가 완료
3. 저장소 루트 `CLAUDE.md` 작성 완료 (handoff CLAUDE.md + harness 규칙 병합, 경로를 core/engine/ports 구조로 정정)
4. P0 커밋 완료: `Phase 0: 프로젝트 셋업`

## 3. 다음 Phase 요약 (상세는 설계 문서 §4)

| Phase | 내용 | DoD 출처 (scorelink-handoff/IMPLEMENTATION_PLAN.md) |
|---|---|---|
| P1 | core 1부: constants, geometry, overlap, rests, chords, codec — 단위 + fast-check 프로퍼티 | handoff P1 수치 그대로 |
| P2 | core 2부: editing, undo + Zustand 스토어(순수 함수 래핑만) | handoff P2 |
| P3 | engine: schedule()+buildAccEvents+FakeAudioSink 골든 스냅샷+`npm run dump` | handoff P6의 이벤트/카운트 DoD 이관 (무반주 N, pad=N+26, comp=N+104, arp=N+64) |
| P4 | adapters: WebAudioSink(게인 시퀀스 테스트)/RafClock/LocationHashStore/player | handoff P6 나머지 |
| P5~P7 | UI: Score → Pad/ChordRow/Picker → Steppers/ButtonBar/MeasureBar/Header | handoff P3·P4·P5 |
| P8 | 조립+재생 연동+해시 자동 저장(500ms) | handoff P7 |
| P9 | Viewer+공유+구버전 해시 3종 하위 호환 | handoff P8 |
| P10 | 마감: 접근성/빌드/e2e 체크리스트/해시 길이 iOS 실측 | handoff P9 |

공통 픽스처(데모 곡)는 handoff IMPLEMENTATION_PLAN.md 말미 "수용 픽스처" 참조.
프로토타입 실제 해시 샘플 3종(일반/pickup/구버전)은 프로토타입을 브라우저로 열어 공유 버튼으로 생성해 `fixtures/`에 저장해야 함 (P1 codec 테스트와 P9에서 사용).

## 4. 주의사항

- 절대 규칙(handoff CLAUDE.md): SMP 유니코드 음악 기호 금지(SVG 패스만), 오디오 게인 불연속 점프 금지, 순수 레이어에서 react/DOM/Web Audio 금지, 조판 상수는 LAYOUT 한 곳, 구버전 URL 해시 하위 호환 유지, 쉼표는 저장하지 않고 파생.
- `npm run dump`는 `vite-node scripts/dump.ts`로 실행 (P3에서 vitest 방식 대체). 순수 레이어 테스트 파일만 adapters/fakes import 허용(eslint override).
- 문서 우선순위: 설계 문서(구조) > SPEC.md(기능) > DESIGN.md(스타일) > 프로토타입(동작 참고).
