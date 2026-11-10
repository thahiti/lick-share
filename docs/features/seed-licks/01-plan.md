# seed-licks: 릭 모음을 전용 계정으로 커뮤니티 DB 에 시드 기획

작성일: 2026-11-10. 모델: fable. 상태: 승인됨.

## 목적

커뮤니티에는 게시물이 몇 개뿐이라 검색과 태그가 쓸모가 없다.
`content/licks/` 에 모아 둔 릭 모음 네 개(유일 383개)를 전용 계정으로 올려, 사용자가 코드 진행과 장르 태그로 릭을 찾아 열람하고 재생하고 복제 편집할 수 있게 한다.
시드는 Latest 피드를 덮지 않도록 과거 날짜로 넣고, 검색과 태그와 작성자 페이지로 찾게 한다.

## 근거

- `content/licks/guitarset.md`, `nottingham.md`, `wjazzd.md`, `omnibook.md`. 각 파일 머리말에 출처와 라이선스가 있다.
- `docs/features/INTAKE.md` 개정 1. 범위와 Hooktheory 보류 결정.
- `harness/DECISIONS.md` 2026-11-10 "릭 모음 다섯 개" 항목. 시드 여부는 저작권 검토 뒤 정하기로 했다.
- `supabase/schema.sql` licks 테이블, `licks_self_dup` unique 인덱스, `trg_lick_created_at` 트리거.
- `src/community/api/licks.ts` publishLick. 앱의 게시 흐름이 시드의 기준이다.
- `src/community/melody-hash.ts`, `src/community/tags.ts`. melody_hash 와 태그 정규화는 앱 함수를 그대로 쓴다.
- `scripts/dump.ts`. vite-node 로 src 를 import 하는 스크립트 선례.
- `scripts/sbquery.mjs`. 운영 DB 에 SQL 을 보내는 도구.

## 사용자 결정 (2026-11-10)

- 올릴 모음은 GuitarSet 56, Nottingham 59, WJazzD 240, Omnibook 31 의 386개.
  Hooktheory 292개는 보류한다. CC BY-NC-SA 조건에 현역 팝 곡 멜로디라 저작권 위험이 가장 크다.
- 카드 제목은 md 의 릭 이름을 쓴다. 곡명과 연주자는 해시 안 제목으로 열람 화면에 보인다.
- 게시 시각은 2026-06 이전 과거 날짜로 분산한다.
- 운영 DB 접근은 `node scripts/sbquery.mjs` 와 허용 규칙으로 한다.
- 시드 계정의 표시 이름은 "Lick Library".
- 태그는 진행, 장르, 스타일 세 개다. 예 `ii-v-i`, `jazz`, `bebop`. 출처명은 태그로 쓰지 않는다.
- 게시 시각은 2026-03-01 부터 2026-05-31 사이에 모음 순서대로 균등 분산하고 같은 시각이 없게 한다.
- 설명 문단은 올리지 않는다. 문서에만 남긴다.

## 확정된 사실

- 다섯 모음 해시 678개 전부 현재 `decodeSong` 으로 디코딩된다. URL 500자 초과 없음. 해시 안 제목 최대 40자.
- 네 모음 386개 중 같은 멜로디(melody_hash 동일)가 Nottingham 안에 3건 있다(Bottom of the Punch Bowl, The Girl With the Blue Dress on, Tom Pate 가 두 진행 섹션에 중복). 첫 항목만 남겨 유일 383개다.
- 시드 계정은 randylee82@gmail.com. `auth.users.id = 4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf`, `profiles.public_id = JSztbE7e`, 표시 이름은 현재 "이름없는 연주자".
  앱에는 구글 로그인만 있어 이 계정으로는 아무도 로그인할 수 없다.
- 트리거가 insert 때 created_at 을 now() 로 덮어쓰므로 과거 날짜는 insert 뒤 UPDATE 로 넣는다.
- Management API 는 postgres 역할이라 RLS 를 거치지 않는다. `insert ... on conflict (author_id, melody_hash) do nothing` 으로 재실행해도 중복이 생기지 않는다.
- blob 은 앱과 같이 `v2...` 무점 해시를 `#` 없이 저장한다.

## 종료 시나리오

경량 트랙이라 명령과 출력으로 적는다. S5 만 휴대폰 폭(390px)에서 확인한다.

S1. 리포 루트에서 `npm run seed-licks -- --dry-run` 을 실행하면 모음별 건수(guitarset 56, nottingham 59, wjazzd 240, omnibook 31), 중복으로 제외한 3건, 유일 383건, 태그별 건수가 출력되고 파일은 만들지 않는다.
S2. `npm run seed-licks -- --out <경로>` 를 실행하면 SQL 파일 하나가 생긴다.
    파일은 표시 이름 UPDATE, 383건 INSERT(on conflict do nothing), created_at UPDATE 순서다.
    파일 안 blob 은 전부 `decodeSong` 을 통과한 값이고 melody_hash 는 앱의 `melodyHash` 로 계산한 값이다.
S3. `node scripts/sbquery.mjs < <경로>` 로 넣은 뒤 `select count(*) from licks where author_id = '4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf'` 가 383 을 돌려준다.
    같은 파일을 한 번 더 넣어도 383 이다.
S4. 같은 작성자의 `min(created_at)`, `max(created_at)` 이 정한 날짜 범위 안이고, `count(distinct created_at)` 이 383 이다.
S5. 휴대폰 폭에서 https://lickshare.pages.dev/user/JSztbE7e 를 열면 표시 이름과 릭 카드가 보이고, 카드를 누르면 `/lick/:id` 에서 악보가 그려지고 재생된다. 한 건 확인한다.
S6. 검색에 `ii-v-i` 를 넣으면 태그 일치로 시드 릭이 나오고, `Donna Lee` 를 넣으면 제목 부분 일치로 Omnibook 릭이 나온다.
S7. Latest 피드 첫 페이지는 시드 전과 같다. 기존 게시물이 앞에 남고 시드는 뒤 페이지에 있다.

## 범위

포함:
- `scripts/seed-licks.ts`. md 파싱, 해시 디코딩 검증, melody_hash 계산, 태그 생성, 날짜 배정, SQL 파일 생성. vite-node 로 실행하고 `package.json` 에 `seed-licks` 스크립트를 둔다.
  실제 전송은 하지 않는다. SQL 을 실행 전에 눈으로 검토하고 git 밖에 두기 위해 `sbquery` 로 분리한다.
- 같은 멜로디가 두 섹션에 있으면 첫 항목만 남긴다.
- 태그 규칙과 날짜 분산 규칙. 구체 표는 명세에서 확정한다.
- 파서와 태그와 SQL 이스케이프의 단위 테스트.
- 운영 DB 에 1회 실행. 결과와 롤백 방법(`delete from licks where author_id = <시드 id>`)을 `harness/PROGRESS.md` 와 `harness/DECISIONS.md` 에 남긴다.

제외 (다음 기능 또는 다음 버전):
- Hooktheory 모음.
- 설명 문단 저장. DB 에 컬럼이 없다.
- 앱 화면 변경. 카드나 열람 화면에 데이터셋 출처를 표기하는 일은 다음 기능 후보다.
- 시드 계정 관리 화면.

## 의존 기능

- community. licks 테이블, 게시 흐름, 열람 화면.
- publish-tags. 태그 정규화 규칙.
- tag-search. S6 의 태그와 제목 검색.

## 열린 질문

없음.
표시 이름, 태그 규칙, 날짜 범위, 설명 문단 네 가지는 2026-11-10 에 답을 받아 "사용자 결정" 절에 반영했다.
