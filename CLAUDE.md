# CLAUDE.md — Lick Share (코드명 ScoreLink)

짧은 악보(릭)를 URL 해시로 공유하고, 커뮤니티에서 게시와 좋아요를 주고받는 모바일 웹앱.
이 파일은 목차다. 절차는 스킬, 지식은 `docs/`, 상태는 `harness/` 에 있다.

## 세션 절차

- 시작: 훅이 `harness/PROGRESS.md`, 진행 중 기능, 최근 커밋을 넣어 준다. 그 다음 `/session-start`.
- 진행: 한 세션에 기능 하나. 단계 하나가 끝날 때마다 커밋.
- 종료: `/session-end`. 커밋, PROGRESS.md, 레지스트리 정리.
- 파이프라인 밖의 일(버그 수정, 배포, 문서 정리)은 feature 브랜치에서 전역 규칙대로 하고 PROGRESS.md 에 한 줄 남긴다.

## 기능 파이프라인

`intake → plan → design → spec → implement → verify → done`. 경량 트랙(화면 없음)은 design 을 건너뛴다.

| 단계 | 스킬 | 모델 | 산출물 | 게이트 |
|---|---|---|---|---|
| intake | `/feature-intake` | Fable | `docs/features/INTAKE.md`, 레지스트리 등록 | 사용자 확인 |
| plan | `/feature-plan` | Fable | `01-plan.md` (종료 시나리오) | 사용자 승인 |
| design | `/feature-design` | Fable | `02-design.md`, 시나리오별 상태 시안 `mockup.html` | 사용자 승인 |
| spec | `/feature-spec` | Fable | `03-spec.md` (S-n 시나리오, AC-n 단위) | 사용자 승인 |
| implement | `/feature-implement` | Opus | 태스크마다 S-n 통과, 커밋 | `harness/check.sh` |
| verify | `/feature-verify` | Fable 또는 Opus | `harness/evidence/<id>/` 스크린샷, `verdict.md` | PASS, 휴대폰 확인 |

- 레지스트리 `harness/features.json` 은 `node harness/feature.mjs` 로만 바꾼다. 직접 편집은 훅이 막는다.
- 승인 없이 implement 로, 증거 없이 done 으로 갈 수 없다. `feature.mjs` 가 검사한다.
- 하네스 이전(2026-07)에 끝난 기능 12개는 `docs/features/<id>/design.md`, `plan.md` 형식이고 레지스트리에 done 으로만 등록돼 있다.

## 명령

```
harness/init.sh                     환경 준비 (세션 시작)
harness/check.sh                    typecheck + lint + test + check-smp, 통과 시 .last-check 갱신
node harness/feature.mjs list|current|next|show <id>
node harness/feature.mjs add <id> --title .. --ref .. --track full|light --deps a,b
node harness/feature.mjs start <id> | finish
node harness/feature.mjs approve <id> plan|design|spec
node harness/feature.mjs stage <id> <단계> --model fable|opus
npm run dev                         개발 서버
npm run dump -- "#v2…"              이벤트 테이블 + ASCII 피아노롤 (귀 없이 재생 결과를 눈으로 확인)
npm run build && npx wrangler pages deploy    운영 배포 (사용자 확인 뒤). 토큰은 .env.local
```

## 디렉터리 책임

| 경로 | 맡은 것 |
|---|---|
| `src/` | 앱 구현체. core, engine, ports, adapters, ui, community, styles |
| `supabase/schema.sql` | 커뮤니티 DB 스키마. 테이블, RLS, 열 권한, 랭킹 view, trigger |
| `scripts/`, `fixtures/` | 개발 도구(dump, check-no-smp)와 테스트 자료 |
| `docs/product/` | 제품 명세(SPEC), 스타일(DESIGN), 제품 기획, 프로토타입 |
| `docs/architecture/` | 레이어 구조와 설계 원칙 |
| `docs/ops/` | 배포와 운영 |
| `docs/checklists/` | 사람이 실기기에서 하는 수동 점검 |
| `docs/features/<id>/` | 기능별 기획, 디자인, 명세 |
| `content/licks/` | 릭 모음 콘텐츠. 앱 구현과 무관한 산출물 |
| `harness/` | 작업 상태. PROGRESS.md 인수인계, DECISIONS.md 결정 기록, features.json 레지스트리, evidence/ 증거 |
| `.claude/` | 절차. skills, agents, hooks, rules |

## 레이어 규칙 (컴파일러와 린터로 강제됨)

- 의존 방향: `ui → adapters → ports`, `engine → core`. 화살표는 항상 안쪽. core, engine, ports 는 완전 순수.
- 순수 레이어(core, engine, ports)에서 금지: react, DOM, Web Audio, zustand import / Date, setTimeout, window, document, AudioContext, Math.random.
- Step, Midi, Sec, BarIndex 는 branded type. 맨 number 를 섞어 쓰지 말 것 (src/core/types.ts).
- `src/community/` 는 `ui` 와 동급 레이어. supabase, DOM, crypto 사용 허용, core 의 순수 규칙 적용 대상 아님.
  단 의존 화살표는 안쪽만 향해야 하므로 `core` 는 import 할 수 있어도 그 반대(core 가 community 를 import)는 금지.

## 절대 규칙

- SMP 유니코드 음악 기호(U+1D100~U+1D1FF) 사용 금지. 악보 기호는 전부 SVG 패스. (Android 폰트 부재)
- 오디오 게인에 불연속 점프(감쇠 중 setValueAtTime) 금지. 팝 노이즈의 원인. setTargetAtTime 기반 엔벨로프 유지.
- 조판과 레이아웃 수치는 core constants 의 LAYOUT 한 곳에만 정의.
- URL 해시 인코딩은 무점 `v2<base64url(바이너리)>`. 해시에 `.` 금지, URL 총 500자 이내 유지
  (메신저 링크 감지기가 `.` 에서 절단하고 500자 초과 URL 은 링크화하지 않음). 디코딩은 v2 + 무점 v1(JSON)만.
  구형 `v1.` 해시는 하위 호환 폐기(2026-07-15). 잘리거나 깨진 해시, 미래 버전 해시는 조용히 깨지지 말고 명시적으로 거부.
- 게시된 릭의 공유 URL 은 단축 라우트 `/s/:id`. 열면 자체 완결 열람 URL(`/?mode=view#v2…`)로 replace.
- 쉼표는 데이터로 저장하지 않는다. 항상 파생.
- 코드가 없는 구간(첫 코드 이전)의 반주는 완전 무음 (SPEC 5.5절).
- 골든 스냅샷(FakeAudioSink 로그)은 갱신 전 반드시 diff 를 확인하고, 의도된 변화인지 검토 후에만 갱신.
- 좋아요 대상은 항상 `canonical_id ?? id`(`likeTargetId`). 원본에 좋아요가 모이는 귀속 규칙을
  계산할 때 이 함수 외의 경로로 직접 id 를 쓰지 말 것.
- 커뮤니티 라우팅은 경로 기반(`/`, `/lick/:id`, `/user/:public_id` 등). URL 해시는 곡 blob(`v2…`)이
  점유하고 있으므로 해시 기반 라우팅 금지.
- `service_role` key 는 코드, 환경 변수 어디에도 절대 넣지 않는다. 프론트는 `anon` key + RLS 로만 권한을 통제한다.
- `melody_hash` 직렬화 대상은 노트의 피치 델타, 시작 오프셋, 길이 삼중항뿐이다. 템포, 코드, 조성, 제목은
  절대 포함하지 않는다(docs/features/community/design.md 의 melody_hash 알고리즘 절 참조).
- 계정의 정체성은 `profiles.id` 와 `public_id` 다. `display_name` 은 바꿀 수 있는 라벨이고 DB unique 인덱스가 중복을 막는다.

## 작업 방식

- TDD 필수: 테스트 먼저 작성, RED 확인, 구현, GREEN.
- 게이트: `harness/check.sh` (typecheck, lint, test, check-smp). 커밋 전 전부 통과.
- 브랜치와 커밋은 전역 규칙을 따른다. feature 브랜치, main 으로 `--no-ff` 머지(`merge:` 제목), Conventional Commits 영어 제목 50자, 본문 한글로 왜. Claude 나 Anthropic 트레일러 금지.
- 서브에이전트 보고를 그대로 믿지 않는다. `check.sh` 와 `git log` 로 직접 확인한다.
- 화면 변경은 `verify` 스킬로 실제 구동해 확인한다. jsdom 결과만 믿지 않는다.
- DB 변경은 `supabase/schema.sql` 을 고치고, 운영 DB 에는 SQL Editor 나 Management API 로 따로 적용한다. 둘이 같은 상태인지 PROGRESS.md 에 적는다.
- 실수를 발견하면 원인을 규칙, 훅, 스킬 중 하나에 고정한다. 추측으로 규칙을 늘리지 않는다.

## 문서

- `docs/product/SPEC.md` 기능과 알고리즘. `docs/product/DESIGN.md` 스타일과 토큰.
- `docs/product/ear-training-plan.md` 다음 제품(청음 훈련) 기획 초안.
- `docs/architecture/layer-principles.md` 왜 이 구조인가. `docs/architecture/ARCHITECTURE.md` 폴더와 모듈.
- `docs/ops/DEPLOY.md` Cloudflare Pages 배포, 롤백.
- `harness/PROGRESS.md` 인수인계. `harness/DECISIONS.md` 결정 기록.

## 스타일

- UI 텍스트는 영어. 코드 주석은 한국어, 식별자는 영어. 이모지와 가운뎃점은 쓰지 않는다.
- 디자인 토큰은 src/styles/tokens.css 의 CSS 변수만 사용. 하드코딩 색상 금지.
