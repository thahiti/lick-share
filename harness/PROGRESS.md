# 진행 상황

세션이 바뀔 때 다음 세션이 이어받는 인수인계 문서.
세션 종료 때 갱신하고, 세션 시작 때 훅이 자동으로 읽어 준다.

## 현재 상태

- 운영: https://lickshare.pages.dev (Cloudflare Pages 프로젝트 `lickshare`). 2026-11-10 배포본은 main `2dd4391`(모바일 앱 바 여백 수정까지)의 빌드다. 번들은 앱, react, supabase 세 덩어리.
- DB: Supabase 프로젝트 `tejndnivhbdxfstgybmm`. 2026-11-10 에 표시 이름 unique 인덱스, 길이 제약, 가입 trigger, 열 권한을 적용했다. 저장소 `supabase/schema.sql` 과 같은 상태.
- 테스트: 68 파일 645개 통과. 게이트는 `harness/check.sh`.
- 진행 중 기능: 없음. 레지스트리에는 하네스 이전 기능 12개가 done 으로만 등록돼 있다.
- 기준 커밋: 없음.

## 마지막 작업

- 2026-11-09: Cloudflare API 토큰 배포 전환, 데스크톱 피드 한 열, 표시 이름 편집과 유일성(`feature/nickname-edit`).
- 2026-11-10: 표시 이름 DB 마이그레이션 실행과 배포. 아바타 메뉴가 항목 선택 뒤 안 닫히던 버그 수정과 배포. 부채 정리(`.wrangler/` 무시, README 갱신, React 와 supabase-js 덩어리 분리). 문서를 성격별, 기능별 폴더로 재편하고 릭 모음을 `content/licks/` 로 분리해 커밋. 청음 훈련 기획 초안 커밋. whooing 방식 하네스 도입. 저장소 밖 잔재(handoff 폴더, 옛 프로토타입, lick_gen, lick_like, .superpowers, AGENTS.md, .agents)를 휴지통으로 이동. 하네스 머지본 배포.
- 2026-11-10: 모바일 앱 바 좌우 여백 12px 추가와 돋보기 버튼 지름을 아바타와 같은 34px 로 통일(`fix/mobile-appbar-spacing`). 로고와 아바타가 카드 모서리에 정렬된다. main `2dd4391` 로 머지, 푸시, 배포 완료.

## 다음 행동

1. 청음 훈련: `docs/product/ear-training-plan.md` 10절의 Q1~Q6 답을 받고 `/feature-intake` 로 기능 7개(`playlist-schema`, `playlist-build`, `playlist-play`, `quiz-grading`, `quiz-session`, `quiz-result`, `mobile-audio`)를 등록한다.
2. 첫 기능을 `start` 하고 `/feature-plan`.

## 막힌 것

- Claude Code 의 auto 모드 권한 분류기가 운영 배포(`wrangler pages deploy`)와 파일 삭제(휴지통 이동 포함)를 막는다. 배포는 사용자가 "다시 배포해" 라고 한 뒤 허용 창을 눌러 통과했다. 삭제는 사용자가 직접 실행한다.

## 열린 결정 (사용자 답 필요)

- 백업 번들 `/Users/randy/claude_code/lick_share/lick-share-backup.bundle` 과 로컬 백업 브랜치 `backup-before-scrub`, `backup-before-author-fix` 를 지울지. 원격 main 과 트리 내용은 같고 정리 전 메타데이터만 다르다.
- 리포를 `/Users/randy/claude_code/lick_share/` 로 한 단계 올릴지. 올리면 Claude 세션 기록 경로가 끊긴다.
- `content/licks/hooktheory.md` 를 커뮤니티 DB 시드로 올릴지. Sheet Sage(CC BY-NC-SA 3.0) 파생이라 저작권 검토가 필요하다. 나머지 넷도 시드 여부 미정.
- 청음 훈련 기획 Q1~Q6(테스트 형식, 첫 음 힌트, 음 길이 채점, 지워진 릭 처리, 비로그인 테스트, 같은 앱 안 여부).
- `.env.local` 의 `SUPABASE_ACCESS_TOKEN` 을 지울지. 역할(마이그레이션)은 끝났다. 지우면 그 줄도 뺀다.
- 미병합 브랜치 `feature/author-email`(폐기된 이메일 표시 작업) 삭제. `git branch -D feature/author-email`.

## 남은 작업 후보

- 사람이 실기기에서: `docs/checklists/e2e-checklist.md` 5절(iOS Safari 해시 길이, 청감, Lighthouse), `docs/checklists/community-e2e-checklist.md`(로그인, 승계, 좋아요). 체크 표시가 없어 실제로 했는지 알 수 없다.
- 의도적 보류: 패드 플레이헤드, 열람 재생 중 자동 스크롤, lookahead 스케줄러, 화면 단위 지연 로딩.
- 릭 모음을 만든 추출 스크립트가 어디에도 없다. 다시 만들거나 고치려면 새로 써야 한다.
- `scripts/dump.ts` 의 사용법 문구와 오류 메시지가 아직 `v1.` 해시를 말한다.
- 계획 문서 8개의 체크박스는 항목별로 검증하지 않고 머리글로 완료를 표시했다. 필요하면 항목별로 확인한다.

## 새 세션이 읽을 순서

1. `CLAUDE.md`
2. 이 문서
3. `docs/product/SPEC.md`, `docs/product/DESIGN.md`
4. 손대는 기능의 `docs/features/<id>/`
5. `.claude/skills/verify/SKILL.md` (앱을 실제로 구동하는 방법)
