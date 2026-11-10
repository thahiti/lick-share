# ScoreLink 구현 계획 — Claude Code 자율 실행용

각 Phase는 독립 커밋 단위. **완료 기준(DoD)을 전부 만족해야 다음 Phase로 진행한다.** 모든 Phase에서 공통 게이트: `npm run typecheck` 무오류, `npm test` 전체 통과(이전 Phase 테스트 포함), `node scripts/check-no-smp.js` 통과. 사양 근거는 SPEC.md(§ 표기), 스타일은 DESIGN.md, 구조는 ARCHITECTURE.md, 동작 레퍼런스는 prototype-reference.html.

---

## Phase 0 — 프로젝트 셋업

작업: Vite react-ts 생성, vitest+@testing-library/react+jsdom 설정, ESLint(strict + domain/ 폴더에 react·dom import 금지 규칙), `styles/tokens.css`에 DESIGN §2 토큰 전체, `scripts/check-no-smp.js`(src 내 U+1D100~U+1D1FF 존재 시 exit 1), npm 스크립트(dev/build/test/typecheck/lint/check-smp).

DoD:
- [ ] `npm run dev` 기동, 빈 App 렌더
- [ ] 샘플 테스트 1개 통과, typecheck·lint 무오류
- [ ] check-no-smp가 SMP 문자 포함 파일을 만들면 실패함을 확인 후 제거

## Phase 1 — 도메인 코어 (UI 없음)

작업: `domain/` 전체 구현 — types, constants(LAYOUT 포함), geometry, overlap, rests, chords, codec. SPEC §2, §5, §7의 수식·알고리즘 그대로.

DoD (vitest, 각 항목이 개별 테스트):
- [ ] geometry: pickup=0일 때 measStart(2)=32, measOf(31)=1 / pickup=8일 때 measStart(0)=0, measLen(0)=8, measStart(1)=8, measOf(7)=0, measOf(8)=1, lineOf(4)=0, lineOf(5)=1, measCountAll=meas+1
- [ ] posX: 모든 마디에서 posX(m, 15/16) < measX(m)+measW(m)-4 (마디선 넘침 없음), measW(pickup 마디)=0.7×mw
- [ ] overlap: [0,4) 존재+[2,6) 추가 → 앞 노트 d=2 / 완전 덮임 노트 제거 / d<1 결과 제거
- [ ] rests: 빈 마디→[16] / 구간[4,16)→[4,8] 순 / [1,4)→[1,2] / [18,20)(2번째 마디 내 [2,4))→[1,2]가 아닌 [2]? → 알고리즘 결과 [2] (c=2: 2%2=0, 2<=2) / pickup 마디(len 8) 전체 빈 경우→[8]
- [ ] chords: chordTones("C")=[48,55,64], ("Am7")=[45,52,60,67], ("F♯dim")=[54,60,69], ("Bb7") ♭ 처리 / chordAtBeat: {0:"C",4:"F"}에서 beat 3→C, 4→F, 7→F
- [ ] codec: 임의 Song 왕복 동일성(deep equal) / 구버전(cb 없음, 코드 마디 키, "r" 노트) 디코딩 시 코드 키×4·쉼표 필터·기본값 적용 / 유니코드 제목 안전

## Phase 2 — 편집 로직 + 스토어

작업: `domain/editing.ts`(SPEC §3.5~§3.8의 모든 조작을 순수 함수로), `store/songStore.ts` + `store/undo.ts`(스냅샷 60개).

DoD:
- [ ] padTap: 빈 칸→d=4 입력(곡 끝 클램프)+겹침 해소 / 켜진 칸→선택 / 선택 재탭→삭제 / 쉼표 행: head→삭제, 중간→자르기, 빈 곳→no-op
- [ ] step*: pitch 53~84 클램프 / pos 0~TOTAL 클램프+curM 추적 / len LEN_STEPS 이동+곡 끝 클램프
- [ ] duplicateNext(마지막)·duplicatePrev(첫: d=min(d,s), s=0이면 no-op) SPEC §3.8 그대로
- [ ] addPickup: notes s+=8, chords 키+2, mAcc 키+1, 중복 호출 no-op / addMeasure: meas+1
- [ ] undo/redo: 임의 5조작 후 undo×5 → 초기 상태 deep equal, redo 복원, restore 후 sel/curM 정합

## Phase 3 — Score 컴포넌트 (표시 전용)

작업: `ScoreSvg`(edit: 단일 라인+음영+마디탭 / view: 멀티라인+음표탭), ClefPath·RestGlyph·노트 렌더(덧줄, 기둥 방향 step>=4 아래, 점음표, 타이, 임시표 ♯).

DoD (testing-library, 데모 곡 고정 픽스처):
- [ ] edit 모드 svg viewBox 높이=126(한 줄), 5마디 곡에서 curM=4일 때 2번째 라인의 마디 4만 렌더
- [ ] 자동 쉼표가 RestGlyph로 렌더(빈 마디=온쉼표 1개), SMP 문자 미사용
- [ ] 마디 탭 → onMeasureTap(m) 호출, 음표 요소에는 edit 모드에서 핸들러 없음
- [ ] pickup 곡: 첫 줄에 5개 마디 히트영역, pickup 폭=0.7×일반
- [ ] view 모드: 전체 라인 렌더, 음표 탭 → onNoteTap(id)
- [ ] F3(덧줄 3개 하단)·C6(덧줄 2개 상단) 렌더 시 line 요소 수 검증

## Phase 4 — Pad + ChordRow + Picker

작업: Pad(동적 ♯행, 셀 상태, 스크롤 관리, 못갖춘 8열·박 라벨 3/4), ChordRow(슬롯+마디별 반주 순환 버튼), ChordPicker.

DoD:
- [ ] 데모 곡(온음계만): 19행, ♯행 0 / 노트 p=70 존재 시 20행·해당 행만 추가 / 마디 이동 시 그 마디 기준 재계산
- [ ] 보이는 ♯행 빈 칸 탭=입력 가능(SPEC: ♯ 최초 생성만 스테퍼)
- [ ] 셀 탭 3규칙, 쉼표 행 파생 점등·자르기, 마디 경계 ⤳ 표시
- [ ] 선택 노트가 스크롤 밖이면 가시화, 그 외 스크롤 보존 (scrollTop 모킹 검증)
- [ ] 코드 슬롯: 일반 4/pickup 2, 피커 즉시 적용·지우기, 저장 문자열 형식(루트+♯♭+접미)
- [ ] 마디별 반주 버튼 순환: 기본→pad→comp→arp→off→기본, mAcc 반영

## Phase 5 — Steppers + ButtonBar + MeasureBar + Header

작업: 스테퍼 3종(비활성/경계 처리, 라벨), 6버튼줄(양끝 ＋추가 전환), 마디 바(양끝 ＋ 전환, pickup 시 ◀ 비활성), 헤더(템포 팝오버 직접입력, 반주 팝오버, 메트로놈 토글, 공유, 모드 전환). Toast.

DoD:
- [ ] 선택 없음→스테퍼 3종 비활성 / 경계에서 방향 버튼 비활성 / 위치 라벨 "못갖춘 3.1" 형식
- [ ] bPrev/bNext 라벨·아이콘 전환 조건 정확(SPEC §3.8), 첫 노트 s=0에서 차단 토스트
- [ ] 마지막 마디 ▶=＋(마디 추가), 첫 마디 ◀=＋(pickup 추가), pickup 존재 시 ◀ opacity .3
- [ ] 템포: 직접입력 change 시 40~240 클램프, ±4 버튼, 칩 동기화
- [ ] 반주 팝오버: off/pad/comp/arp 선택 → accOn·accPat 반영, 버튼 .on 반전
- [ ] 소리 피드백 훅 호출 검증: 입력·선택·pitch 변경 시 preview 1회, pos/len 변경 시 0회 (engine 모킹)

## Phase 6 — AudioEngine + Synth

작업: `audio/synth.ts`(SPEC §6.1 수치 그대로), `audio/engine.ts`(세션, 3노드군 추적, onTick, 시작 클램프), `domain/accompaniment.buildAccEvents`.

DoD (AudioContext 목):
- [ ] pianoAt 게인 호출 시퀀스 = [setValueAtTime(0), linearRamp(vol), setTarget(vol*0.28), setTarget(0.0001)] — 그 외 0.01 초과 setValueAtTime 없음
- [ ] buildAccEvents(데모 곡, pad)=코드 4개 pad 이벤트, 지속=다음 코드까지 / comp=박당 hit / arp=8분당 one·세그먼트 시작 인덱스 리셋 / mAcc off 마디 무이벤트 후 재타건
- [ ] 데모 곡 전체 재생 osc 수: 무반주 N, pad=N+26, comp=N+104, arp=N+64 (G7=4음 포함)
- [ ] 메트로놈: 4박 클릭, 액센트 1568/일반 1047, pickup 박 무액센트 / 재생 중 on→현재 이후만 스케줄, off→클릭 노드만 stop(멜로디 유지)
- [ ] 반주 재생 중 토글 동일 검증 / stop() 시 3노드군 전부 정지, onTick 중단
- [ ] el 시작 클램프: t0 이전 tick에서 measOf 음수 미발생

## Phase 7 — 조립: 편집 화면 통합 + 재생 연동

작업: App에서 전체 조립, 플레이헤드(악보·패드) 렌더, 전체 재생 시 curM 추적+줄 전환, 마디 재생 범위 `measStart~+measLen`, 해시 자동 저장(500ms 디바운스).

DoD:
- [ ] 통합 테스트: 패드 입력→악보 반영→undo→복원 / 마디 탭→이동+첫 노트 선택+프리뷰
- [ ] 전체 재생 목 타임라인 진행 시 curM이 0→1→…으로 갱신, 5마디 곡에서 라인 전환 발생
- [ ] 편집 후 500ms 뒤 location.hash 갱신, 새로고침 시 동일 곡 복원
- [ ] 헤더 재생 버튼 play↔pause 아이콘 토글, 정지 시 즉시 무음

## Phase 8 — 열람 화면 + 공유

작업: Viewer(SPEC §4), 라우팅(?mode=view), 복제해서 편집, 링크 복사(클립보드+prompt 폴백).

DoD:
- [ ] view 모드: 배지 4종 값 정확, 멀티라인 스크롤, 음표 탭→그 위치부터 재생 호출
- [ ] view 재생에 메트로놈·반주 이벤트 0건
- [ ] 공유 URL 형식 `…?mode=view#v1.…`, 프로토타입이 생성한 실제 해시 샘플 3종(일반/pickup/구버전) 디코딩 렌더 성공
- [ ] "복제해서 편집" → edit 전환, 데이터 유지

## Phase 9 — 마감

작업: 접근성(aria-label 전 버튼), 리사이즈 재계산, 모바일 실측 점검 목록 작성, 빌드 산출물 확인, (선택) lookahead 스케줄러 교체, README(배포: 정적 호스팅).

DoD:
- [ ] `npm run build` 성공, dist를 로컬 서브해 데모 곡 전 기능 수동 시나리오 체크리스트 통과(체크리스트를 e2e-checklist.md로 저장)
- [ ] Lighthouse 모바일 성능/접근성 90+ (참고치)
- [ ] 전체 테스트 스위트 최종 통과

---

## 수용 픽스처 (테스트 공통)

데모 곡(프로토타입 초기값): meas=4, pickup=0, tempo=100, accPat="pad",
notes=[[0,4,64],[4,2,69],[6,2,67],[8,4,71],[12,6,69],[20,4,67],[24,8,64],[32,4,65],[36,4,69],[40,8,72],[48,4,71],[52,4,67],[56,8,64]],
chords={0:"C",4:"Am",8:"F",12:"G7"}.
프로토타입 해시 샘플은 prototype-reference.html을 브라우저로 열어 공유 버튼으로 생성해 fixtures/에 저장할 것.
