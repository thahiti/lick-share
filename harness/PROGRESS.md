# 진행 상황

세션이 바뀔 때 다음 세션이 이어받는 인수인계 문서.
세션 종료 때 갱신하고, 세션 시작 때 훅이 자동으로 읽어 준다.

## 현재 상태

- 운영: https://lickshare.pages.dev (Cloudflare Pages 프로젝트 `lickshare`). 2026-11-10 배포본은 main `9d18db4`(adaptive bars per line 머지까지)의 빌드다. 번들은 앱, react, supabase 세 덩어리.
- DB: Supabase 프로젝트 `tejndnivhbdxfstgybmm`. 2026-11-10 에 표시 이름 unique 인덱스, 길이 제약, 가입 trigger, 열 권한을 적용했다. 저장소 `supabase/schema.sql` 과 같은 상태. 같은 날 시드 계정 Lick Library(`public_id` JSztbE7e)로 릭 383건을 넣었다. 스키마 변경은 없다.
- 테스트: 69 파일 663개 통과. 게이트는 `harness/check.sh`.
- 진행 중 기능: 없음. `seed-licks` 는 하네스 파이프라인을 처음으로 끝까지(intake, plan, spec, implement, verify, done) 거친 기능이다. 레지스트리에는 하네스 이전 기능 12개가 done 으로만 등록돼 있다.
- 기준 커밋: 없음.

## 마지막 작업

- 2026-11-09: Cloudflare API 토큰 배포 전환, 데스크톱 피드 한 열, 표시 이름 편집과 유일성(`feature/nickname-edit`).
- 2026-11-10: 표시 이름 DB 마이그레이션 실행과 배포. 아바타 메뉴가 항목 선택 뒤 안 닫히던 버그 수정과 배포. 부채 정리(`.wrangler/` 무시, README 갱신, React 와 supabase-js 덩어리 분리). 문서를 성격별, 기능별 폴더로 재편하고 릭 모음을 `content/licks/` 로 분리해 커밋. 청음 훈련 기획 초안 커밋. whooing 방식 하네스 도입. 저장소 밖 잔재(handoff 폴더, 옛 프로토타입, lick_gen, lick_like, .superpowers, AGENTS.md, .agents)를 휴지통으로 이동. 하네스 머지본 배포.
- 2026-11-10: 모바일 앱 바 좌우 여백 12px 추가와 돋보기 버튼 지름을 아바타와 같은 34px 로 통일(`fix/mobile-appbar-spacing`). 로고와 아바타가 카드 모서리에 정렬된다. main `2dd4391` 로 머지, 푸시, 배포 완료.
- 2026-11-10: 악보 가독성 실측과 줄당 마디 수 적응(`fix/adaptive-bars-per-line`). Playwright 로 6개 뷰포트를 찍어 보니 줄당 4마디 고정 탓에 폰(악보 폭 340)은 인접 음표의 77% 가 겹쳤다. 폭과 밀도로 줄당 마디 수를 4, 2, 1 로 정하고(SPEC 3.2 절) 줄 경계 타이 조각을 넣었다. 시드 릭은 WJazzD 원본과 대조해 마디 압축이 없음을 확인했다. 템포는 원본과 같되 240 상한에 잘린 릭이 wjazzd 89건, omnibook 8건이고, 같은 스텝에 두 음이 시작하는 릭이 wjazzd 58건 있다.
- 2026-11-10: `seed-licks`. 릭 모음 네 개의 유일 383건을 시드 계정 Lick Library(randylee82@gmail.com, `public_id` JSztbE7e)로 운영 DB 에 넣었다. `scripts/seed-licks.ts`(md 파싱, 해시 검증, melody_hash, 태그, 날짜 분산, SQL 생성)와 단위 테스트 10건, `scripts/sbquery.mjs`(Management API 도구), 기획과 명세, 증거와 PASS 판정. Hooktheory 는 보류. main `da09839` 로 머지, 푸시, 배포.

## 다음 행동

1. 청음 훈련: `docs/product/ear-training-plan.md` 10절의 Q1~Q6 답을 받고 `/feature-intake` 로 기능 7개(`playlist-schema`, `playlist-build`, `playlist-play`, `quiz-grading`, `quiz-session`, `quiz-result`, `mobile-audio`)를 등록한다.
2. 첫 기능을 `start` 하고 `/feature-plan`.

## 막힌 것

- Claude Code 의 auto 모드 권한 분류기가 파일 삭제(휴지통 이동 포함)를 막는다. 삭제는 사용자가 직접 실행한다. 운영 DB 접근은 `node scripts/sbquery.mjs` 허용 규칙(`.claude/settings.local.json`)으로, 배포는 `.env.local` 의 CLOUDFLARE 변수를 export 한 뒤 `npm run build && npx wrangler pages deploy` 로 통과한다.
- 세션을 리포 상위 폴더(`/Users/randy/claude_code`)에서 시작하면 `.claude/agents/` 의 planner, implementer, evaluator 가 Agent 도구에 안 뜬다. 2026-11-10 에는 `general-purpose` 에 agents/*.md 지시를 붙여 대신 썼다. 리포 루트에서 세션을 시작하면 되는지 확인할 것.

## 열린 결정 (사용자 답 필요)

- 백업 번들 `/Users/randy/claude_code/lick_share/lick-share-backup.bundle` 과 로컬 백업 브랜치 `backup-before-scrub`, `backup-before-author-fix` 를 지울지. 원격 main 과 트리 내용은 같고 정리 전 메타데이터만 다르다.
- 리포를 `/Users/randy/claude_code/lick_share/` 로 한 단계 올릴지. 올리면 Claude 세션 기록 경로가 끊긴다.
- `content/licks/hooktheory.md` 292건을 시드로 올릴지. 2026-11-10 검토에서 CC BY-NC-SA 조건에 현역 팝 곡 멜로디라 보류했다. 나머지 넷은 올렸다(`seed-licks`).
- 청음 훈련 기획 Q1~Q6(테스트 형식, 첫 음 힌트, 음 길이 채점, 지워진 릭 처리, 비로그인 테스트, 같은 앱 안 여부).
- `.env.local` 의 `SUPABASE_ACCESS_TOKEN` 을 지울지. 역할(마이그레이션)은 끝났다. 지우면 그 줄도 뺀다.
- 미병합 브랜치 `feature/author-email`(폐기된 이메일 표시 작업) 삭제. `git branch -D feature/author-email`.

## 남은 작업 후보

- 사람이 실기기에서: `docs/checklists/e2e-checklist.md` 5절(iOS Safari 해시 길이, 청감, Lighthouse), `docs/checklists/community-e2e-checklist.md`(로그인, 승계, 좋아요). 체크 표시가 없어 실제로 했는지 알 수 없다.
- 의도적 보류: 패드 플레이헤드, 열람 재생 중 자동 스크롤, lookahead 스케줄러, 화면 단위 지연 로딩.
- 릭 모음을 만든 추출 스크립트가 어디에도 없다. 다시 만들거나 고치려면 새로 써야 한다.
- `scripts/dump.ts` 의 사용법 문구와 오류 메시지가 아직 `v1.` 해시를 말한다.
- 계획 문서 8개의 체크박스는 항목별로 검증하지 않고 머리글로 완료를 표시했다. 필요하면 항목별로 확인한다.
- `seed-licks` 평가자 발견(차단 아님): `scripts/seed-licks-lib.ts` 가 접미 없는 헤딩과 매핑표에 없는 스타일 값을 에러로 처리하는데 명세와 테스트에 없다. 다음에 명세를 손댈 때 엣지케이스와 AC 로 올린다.
- 악보 가독성 후속 후보(2026-11-10 실측 순): 한 박 안의 8분, 16분 음표를 빔으로 묶기. 임시표를 직전 음표와의 거리에 따라 놓기. 1024px 이상에서 악보 1.2배 확대. 시드 데이터의 같은 스텝 충돌 58건 정리와 240 상한에 잘린 97건의 원곡 템포 표기.
- 열람 카드에서 한 마디에 코드가 둘이면(예 2마디 턴어라운드의 `Cmaj7 A7`) 코드 라벨이 겹쳐 그려진다. 시드 릭 확인 중 발견. 코드 라벨 간격 조정 후보.

## 새 세션이 읽을 순서

1. `CLAUDE.md`
2. 이 문서
3. `docs/product/SPEC.md`, `docs/product/DESIGN.md`
4. 손대는 기능의 `docs/features/<id>/`
5. `.claude/skills/verify/SKILL.md` (앱을 실제로 구동하는 방법)
