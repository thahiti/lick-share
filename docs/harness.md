# ScoreLink 설계 정리

## 1. 관통하는 원칙

**음악 로직을 브라우저와 스피커에서 떼어내, 결과를 텍스트로 읽을 수 있게 만든다.**

"3마디부터 재생 중에 arp로 바꾸면 제대로 이어지는가"를 귀가 아니라 눈으로 확인할 수 있어야 합니다. 그래야 사람도 에이전트도 검증하고 리팩터링할 수 있습니다.

## 2. 레이어와 의존 방향

| 레이어 | 내용 | 의존 대상 |
|---|---|---|
| `core` | Song 모델, 편집 연산, 겹침 정리, 쉼표 파생, 마디 좌표 변환, undo/redo, base64url 코덱 | **없음 (완전 순수)** |
| `engine` | `schedule()` 하나. 멜로디 + 반주 + 메트로놈을 이벤트 목록으로 전개 | core |
| `ports` | AudioSink, Clock, HashStore 인터페이스 | 없음 |
| `adapters` | WebAudioSink, RafClock, LocationHashStore | ports |
| `ui` | React 컴포넌트. 조립과 렌더만 | 전부 |

화살표는 항상 안쪽을 향합니다. core가 ui나 adapters를 import하는 순간 설계가 무너집니다.

## 3. 포트 세 개

| 포트 | 실전 어댑터 | 테스트 어댑터 |
|---|---|---|
| `AudioSink` 소리를 낸다 | WebAudioSink | FakeAudioSink (울리는 대신 배열에 기록) |
| `Clock` 지금 몇 시인가 | RafClock | FakeClock (시간을 원하는 만큼 밀어줌) |
| `HashStore` 해시 읽기 쓰기 | LocationHashStore | MemoryHashStore |

코어는 자기가 어느 쪽에 꽂혀 있는지 모릅니다. 같은 코드가 브라우저에서는 소리를 내고 테스트에서는 로그를 남깁니다.

## 4. 심장부, schedule()

```ts
// 곡 + 설정 + 시작 위치 -> 울려야 할 소리들의 "목록" (순수 함수)
schedule(song: Song, opt: PlayOpts, fromStep: Step): SoundEvent[]
```

명세의 재생 경로 4개가 전부 이 함수 하나로 환원됩니다.

| 요구사항 | 환원 |
|---|---|
| 전체 재생 | `schedule(song, opt, 0)` |
| 마디 재생 | `schedule(song, opt, barToStep(n))` |
| 열람 화면 탭 재생 | `schedule(song, {melody, accomp:'off', metro:false}, tappedStep)` |
| 재생 중 반주 토글 | `sink.cancelFrom(now)` 후 `schedule(song, 새 opt, 현재 step)` |

## 5. 데이터 규칙 (버그 온상)

- **쉼표는 저장하지 않는다.** 노트 배열에서 파생되는 값입니다
- **마디 ↔ 스텝 변환 함수는 단 하나.** 못갖춘마디 -8 오프셋을 여러 곳에서 각자 계산하면 반드시 어긋납니다
- **단선율 불변식.** 어떤 편집 후에도 노트는 정렬되고 겹치지 않습니다
- **URL 코덱은 버전 태그(v1)를 검사.** 미래 버전 해시는 조용히 깨지지 말고 명시적으로 거부

## 6. 테스트 하네스 3층

1. **단위** — 편집 연산, 코드 파서, 좌표 변환
2. **프로퍼티(fast-check)** — 무작위 입력 수천 개로 불변식 검증
   - `decode(encode(song)) === song`
   - 무작위 편집 100회 후에도 겹침 없음, pitch 53~84, len ∈ LEN_STEPS
   - 노트 + 파생 쉼표 길이 합 = 곡 전체 스텝
3. **골든 스냅샷** — FakeAudioSink 로그를 정답지로 고정. 대표 곡 x 반주 4종 x 메트로놈 on/off

**픽스처**: 못갖춘마디 곡(전 세트에 필수), 마디별 오버라이드 혼합, 코드 없는 마디, 겹침 유발 시퀀스, 최장 URL

## 7. 개발 하네스

`npm run dump -- "#v1.…"` → 이벤트 테이블과 ASCII 피아노롤 출력. 귀 없는 협업자(에이전트)에게 달아주는 계기판입니다.

## 8. 툴링

| 항목 | 결정 |
|---|---|
| TypeScript | **6.0 고정.** 7.0은 typescript-eslint가 아직 못 붙습니다. 7.1에서 재평가 |
| 린터 | ESLint 10 flat config + typescript-eslint |
| 포매터 | Prettier 또는 Biome 중 하나만 |
| 테스트 | Vitest + fast-check |

**아키텍처를 컴파일러로 강제**
- `src/core/tsconfig.json`의 `lib`에서 DOM 제거 → AudioContext 참조 자체가 컴파일 에러
- `no-restricted-globals`로 core 안에서 Date, setTimeout, Math.random 금지
- `noUncheckedIndexedAccess: true` → `notes[i]`가 `Note | undefined`
- Branded type으로 Step, Midi, Sec, BarIndex를 구분 (전부 number라 섞이기 쉬움)

## 9. 아직 결정 안 된 것

1. **TypeScript 6 vs 7** (7로 가면 린터를 Oxlint로 바꿔야 함)
2. **코드가 없는 마디에서 pad와 arp는 무엇을 울리는가** (명세 공백)
3. **반주 3종의 정확한 전개 규칙** (arp 8분 순환의 음 순서, comp의 보이싱)
4. **URL 해시 길이 한계** (iOS Safari 실측 필요)
5. **LEN_STEPS 구체값**
