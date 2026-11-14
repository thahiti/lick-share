# 결정 기록

되돌리기 비싼 결정과 그 이유를 날짜순으로 남긴다.
코드나 git 이력에서 읽어낼 수 없는 "왜"만 적는다.

## 2026-07-12 ~ 2026-07-19 (하네스 이전 요약)

- 프로토타입 HTML 을 TypeScript + React 로 재작성. 구조는 core, engine, ports, adapters, ui 의 다섯 층이고 순수 층은 전용 tsconfig 와 ESLint 로 강제한다. 근거 `docs/architecture/layer-principles.md`, `docs/features/rewrite/design.md`.
- 커뮤니티(게시, 좋아요, 랭킹)는 별도 앱이 아니라 같은 React 앱 안에 `src/community/` 로 통합. 별도 vanilla 앱(`lick_like`)은 폐기했다. 근거 `docs/features/community/design.md`.
- 좋아요는 항상 원본(`canonical_id ?? id`)에 귀속. 동일 판정은 멜로디(음정 델타, 리듬)만 본다.
- 구버전 `v1.` 해시 하위 호환 폐기(2026-07-15). 해시에 `.` 이 있으면 메신저가 링크를 자른다.
- 운영 배포는 Cloudflare Pages(프로젝트 `lickshare`), 백엔드는 Supabase 하나. `service_role` 키는 어디에도 두지 않는다.

## 2026-11-09

- 작성자 표시를 이메일로 바꿨다가 되돌렸다. 대신 표시 이름을 본인이 바꿀 수 있게 하고 DB unique 인덱스(대소문자, 앞뒤 공백 무시)로 중복을 막는다. 계정의 정체성은 `profiles.id` 와 `public_id` 이고 이름은 라벨일 뿐이다. 수정 가능한 열은 `display_name` 하나로 권한을 제한했다.
- 데스크톱 피드는 한 열. 카드 폭이 560px 미만이면 4마디 악보의 음표가 뭉쳐 읽히지 않는다.
- Cloudflare 배포는 만료되는 OAuth 대신 API 토큰(`.env.local` 의 `CLOUDFLARE_API_TOKEN`)으로 한다. wrangler 가 `.env.local` 을 자동으로 읽는다.

## 2026-11-10

- 작업 방식을 전역 규칙에 맞춘다. GitHub Flow(feature 브랜치, `--no-ff` 머지, `merge:` 제목)와 Conventional Commits. 리포 CLAUDE.md 에 남아 있던 "Phase N:" 커밋 형식과 P0~P10 진행 규칙은 폐기한다.
- 하네스는 whooing 프로젝트 방식을 옮긴다. 기능 하나를 intake, plan, design, spec, implement, verify, done 으로 진행하고 plan, design, spec 에 사용자 승인 게이트를 둔다. 레지스트리는 `harness/feature.mjs` 로만 바꾸고 직접 편집은 훅이 막는다.
  - whooing 과 다른 점 1: 커밋된 Playwright e2e 스위트가 없다. 시나리오(S-n)는 기존 `verify` 스킬 방식의 Playwright 스크립트로 개발 서버에서 실행하고 스크린샷을 `harness/evidence/<id>/` 에 남긴다. e2e 스위트 도입은 필요해지면 별도 기능으로 다룬다.
  - whooing 과 다른 점 2: 휴대폰 링크 서버(`preview.sh`)를 두지 않는다. 전역 `/mobile-view` 스킬을 쓴다.
  - 하네스 이전에 끝난 기능 12개는 레지스트리에 done 으로 등록하되 승인 기록과 증거는 없다.
- 디렉터리 책임을 나눈다. `src/` 구현체, `docs/product` 제품 명세와 기획, `docs/architecture` 구조, `docs/ops` 운영, `docs/checklists` 수동 점검, `docs/features/<id>` 기능별 문서, `content/licks` 릭 모음 콘텐츠, `harness/` 작업 상태, `.claude/` 절차. 릭 모음은 앱 구현과 무관한 산출물이라 `docs/` 밖으로 뺐다.
- 릭 모음 다섯 개를 모두 커밋한다. Hooktheory 파생본은 출처(Sheet Sage, CC BY-NC-SA 3.0)를 문서가 밝히고 있다. 다만 커뮤니티 DB 에 시드로 올릴지는 저작권 검토 뒤 따로 정한다.
- 저작권 검토 뒤 네 모음(GuitarSet, Nottingham, WJazzD, Omnibook)의 유일 383건을 시드 계정 "Lick Library"(randylee82@gmail.com, `profiles.public_id = JSztbE7e`, `auth.users.id = 4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf`)로 운영 DB 에 넣었다(`seed-licks`). Hooktheory 는 CC BY-NC-SA 에 현역 팝 멜로디라 보류한다. 태그는 진행, 장르, 스타일 세 개, 게시 시각은 2026-03-01 부터 345분 간격으로 분산해 Latest 피드를 덮지 않는다. 시드 SQL 은 `npm run seed-licks -- --out` 으로 다시 만들 수 있고 재실행은 멱등이다. 롤백: `delete from licks where author_id = '4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf';`
- `AGENTS.md` 와 `.agents/` 는 지운다. 7/19 에 다른 도구가 만든 CLAUDE.md 사본이라 둘 다 유지하면 어긋난다. 하네스는 `.claude/` 에만 둔다.
- 번들 분할은 React 와 supabase-js 를 별도 덩어리로 나누는 데서 멈춘다. 화면 단위 지연 로딩이 효과는 더 크지만 라우팅 코드 변경이 커서 보류한다.

## 2026-11-11

- 넘기기 재생(`swipe-play`)은 라우트가 아니라 목록 위 오버레이다. history 항목 하나로 뒤로 가기가 닫고 목록이 다시 마운트되지 않아 스크롤 위치가 남는다. 공유와 딥링크는 `/s/:id` 가 맡는다.
- 오버레이의 현재 장은 60% 이상 보인 상태가 120ms 유지될 때 바뀐다. 두 장을 한 번에 넘길 때 중간 장이 잠깐 재생되는 것을 막는다. 두 번 나눠 넘기면 중간 장이 1초 가까이 보여 재생되는데, 이는 60% 규칙의 당연한 결과로 둔다.
- 반복 사이 4박은 무음 카운트다운이다. 귀로 골라 보는 탐색 장면에 맞춘 선택이고, 연습 장면의 클릭 예비박과 템포 조절은 다음 기능이다.
- 긴 릭은 장 안에서 세로 스크롤한다. 축소(음표 크기 원칙 위반)와 고정 높이 자르기(플레이헤드 추적 작업)는 버렸다.
- 상세와 플레이어를 `/lick/:id` 라우트로 합치기로 하면서(`lick-page`) 같은 날의 "라우트 대신 오버레이" 결정을 뒤집는다.
  라우트 전환이 부르는 목록 재마운트와 스크롤 손실은 `feed-cache` 의 스냅샷 저장소로 푼다.

## 2026-11-14

- 릭 상세와 넘기기 플레이어를 `/lick/:id` 하나로 합치는 `lick-page` 를 명세 승인 전에 사용자 요청으로 취소했다.
  2026-11-11 마지막 항목(오버레이 결정을 뒤집는다)은 무효이고 "라우트 대신 오버레이" 결정이 그대로 유효하다.
  기획, 디자인, 명세 초안은 `docs/features/lick-page/` 에 취소됨 표시로 남긴다.
  바탕으로 먼저 만든 `feed-cache` 는 상세에 갔다 돌아올 때 목록과 스크롤이 남는 독립 가치가 있어 그대로 둔다.
