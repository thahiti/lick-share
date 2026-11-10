# seed-licks: 릭 모음을 전용 계정으로 커뮤니티 DB 에 시드 명세

작성일: 2026-11-10. 모델: fable. 상태: 승인됨.
이 문서가 구현과 검증의 유일한 기준이다. 기획서 `01-plan.md` 는 참고 자료다.

## 입력과 출력

입력:
- `content/licks/guitarset.md`, `nottingham.md`, `omnibook.md`, `wjazzd.md`. 네 파일 고정. Hooktheory 는 읽지 않는다.
- 시드 계정 id 상수 `4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf`, 표시 이름 상수 `Lick Library`.
- 섹션 키와 태그 매핑표 (R4). 스크립트 안의 상수다.
- CLI 플래그. `--dry-run` 또는 `--out <경로>`. 둘 다 없거나 둘 다 있으면 사용법을 출력하고 종료 코드 1.

출력:
- `--dry-run`: 표준 출력에 집계. 파일을 만들지 않는다.
- `--out <경로>`: SQL 파일 하나. UTF-8, 문장 세 개 (R7).
- 스크립트는 DB 에 접속하지 않는다. 전송은 `node scripts/sbquery.mjs < <경로>` 가 한다.

DB 스키마 변경은 없다. 데이터만 넣는다.

레이어:
- `scripts/seed-licks-lib.ts`: 순수 함수. 파싱, 매핑, 중복 제거, 날짜, SQL 문자열. `src/core/codec.ts` 의 `decodeSong`, `src/community/melody-hash.ts` 의 `melodyHash`, `src/community/tags.ts` 의 `normalizeTags` 를 import 한다. 파일과 프로세스는 만지지 않는다.
- `scripts/seed-licks.ts`: CLI. 파일 읽기, 플래그 해석, 출력. `vite-node` 로 실행한다. `package.json` 에 `"seed-licks": "vite-node scripts/seed-licks.ts"`.
- `scripts/seed-licks.test.ts`: 단위 테스트. `vite.config.ts` 의 `test.include` 에 추가한다.

## 규칙

R1. 항목 파싱.
    파일을 줄 단위로 읽어 `## ` 로 시작하는 줄을 현재 섹션으로 둔다. 섹션 이름은 `## ` 뒤부터 ` (` 앞까지다.
    섹션 키는 섹션 이름을 공백으로 나눈 마지막 토큰이다. 예: `Major ii–V–I` 의 키는 `ii–V–I`, `Blues IV–I` 의 키는 `IV–I`. 대소문자를 구분한다.
    `### N. ` 로 시작하는 줄이 항목의 시작이다. 릭 이름은 `N. ` 뒤부터 마지막 ` — ` 앞까지, 접미는 마지막 ` — ` 뒤다.
    항목의 메타 줄은 헤딩 다음 첫 번째 비어 있지 않은 줄이다.
    항목의 해시는 헤딩 뒤 첫 `https://lickshare.pages.dev/?mode=view#v2` 링크의 `#` 뒤 문자열이다. 정규식 `v2[A-Za-z0-9_-]+`.
    다음 `### ` 나 `## ` 전에 링크가 없으면 실패다 (E1).
R2. 해시 검증. 항목마다 `decodeSong(해시)` 가 null 이면 파일명과 항목 번호를 담은 에러로 전체가 실패한다. 부분 출력은 없다.
R3. melody_hash 는 `melodyHash(song.notes)` 다. 앱의 게시 흐름과 같은 함수다.
R4. 태그는 `normalizeTags([진행, 장르, 스타일])` 다. 세 값은 아래 표에서 나온다. 표에 없는 섹션 키나 스타일 값은 에러다 (E2).

| 파일 | 섹션 키 | 진행 | 장르 | 스타일 |
|---|---|---|---|---|
| guitarset | `V–IV–I` | `turnaround` | `blues` | 헤딩 접미 표 |
| guitarset | `IV–I` | `iv-i` | `blues` | 헤딩 접미 표 |
| guitarset | `I–V–vi–iii` | `i-v-vi-iii` | `rock` | 헤딩 접미 표 |
| guitarset | `iii–IV–I` | `iii-iv-i` | `rock` | 헤딩 접미 표 |
| guitarset | `IV–I–IV–V` | `iv-i-iv-v` | `rock` | 헤딩 접미 표 |
| nottingham | `I–IV–V` | `i-iv-v` | `folk` | `traditional` |
| nottingham | `I–IV–V–I` | `i-iv-v-i` | `folk` | `traditional` |
| nottingham | `I–IV–I–V` | `i-iv-i-v` | `folk` | `traditional` |
| nottingham | `I–vi–IV–V` | `i-vi-iv-v` | `folk` | `traditional` |
| omnibook | `ii–V–I` | `ii-v-i` | `jazz` | `bebop` |
| omnibook | `ii–V–i` | `minor-ii-v-i` | `jazz` | `bebop` |
| omnibook | `I–VI–ii–V` | `turnaround` | `jazz` | `bebop` |
| wjazzd | `ii–V–I` | `ii-v-i` | `jazz` | 메타 스타일 표 |
| wjazzd | `ii–V–i` | `minor-ii-v-i` | `jazz` | 메타 스타일 표 |
| wjazzd | `I–VI–ii–V` | `turnaround` | `jazz` | 메타 스타일 표 |

    섹션 키의 구분자는 en dash(U+2013)다. md 파일에 있는 그대로 비교한다.
    guitarset 헤딩 접미 표: `Rock` 은 `rock`, `Funk` 는 `funk`, `Jazz` 는 `jazz`, `Bossa Nova` 는 `bossa-nova`, `Singer-Songwriter` 는 `songwriter`.
    `singer-songwriter` 는 17자라 15자 상한에 걸리므로 `songwriter` 로 줄인다.
    wjazzd 메타 스타일 표: 메타 줄을 양쪽에 공백이 있는 가운뎃점(U+00B7) 구분자로 나눈 세 번째 값. `HARDBOP` 은 `hardbop`, `POSTBOP` 은 `postbop`, `BEBOP` 은 `bebop`, `COOL` 은 `cool`, `SWING` 은 `swing`, `TRADITIONAL` 은 `traditional`.
    guitarset 의 `rock` 장르 섹션에 스타일 `rock` 이 오면 `normalizeTags` 가 중복을 지워 태그가 둘이 된다. 그대로 둔다 (E5).
R5. 순서와 중복 제거.
    시드 순서는 파일 알파벳 순(guitarset, nottingham, omnibook, wjazzd), 파일 안에서는 문서 순이다.
    같은 melody_hash 가 다시 나오면 뒤의 항목을 버리고 제외 목록에 (파일, 섹션 키, 릭 이름) 을 남긴다.
    네 파일 기준 제외는 Nottingham 3건, 유일 383건이다.
R6. 게시 시각. 유일 목록의 i 번째(0부터) 항목은 `2026-03-01T00:00:00Z + 345분 × i` 다.
    i = 382 는 `2026-05-31T12:30:00Z` 다. 모두 서로 다르고 2026-06 이전이다.
R7. SQL 구성. 파일은 문장 세 개를 이 순서로 담는다.
    1. `update profiles set display_name = 'Lick Library' where id = '<시드 id>';`
    2. `insert into licks (author_id, title, blob, melody_hash, tags) values (...), (...) on conflict (author_id, melody_hash) do nothing;`
       행마다 `('<시드 id>', '<릭 이름>', '<해시>', '<melody_hash>', array['<태그>', ...])`.
    3. `update licks l set created_at = v.ts from (values ('<melody_hash>', timestamptz '<R6 시각>'), ...) as v(h, ts) where l.author_id = '<시드 id>' and l.melody_hash = v.h;`
    문자열 값 안의 작은따옴표는 두 개로 쓴다. 다른 이스케이프는 없다.
    INSERT 가 UPDATE 앞에 와야 한다. 트리거가 insert 때 created_at 을 now() 로 덮기 때문이다 (E9).
R8. dry-run 출력. 파일별 항목 수, 제외 목록(파일, 섹션 키, 릭 이름), 유일 건수, 태그별 건수(태그 이름 알파벳 순)를 한 줄씩 출력한다. 파일은 만들지 않는다.

## 엣지케이스

E1. 항목에 링크가 없으면 파일명과 항목 번호로 실패한다. 네 파일에는 해당 항목이 없다. 테스트는 합성 입력으로 한다.
E2. 매핑표에 없는 섹션 키나 wjazzd 스타일 값이면 파일명과 값으로 실패한다.
E3. 같은 멜로디가 두 섹션에 있으면 첫 항목만 남는다. Nottingham 의 Bottom of the Punch Bowl, The Girl With the Blue Dress on, Tom Pate 가 `I–IV–V` 와 `I–IV–V–I` 두 곳에 있다.
E4. 릭 이름의 작은따옴표. 예 `Bird's Chromatic Climb and Turn`. SQL 에서 `Bird''s` 가 된다.
E5. 태그 중복. guitarset `rock` 장르 섹션에 스타일 `rock` 이면 태그 둘. 허용.
E6. 재실행. `on conflict do nothing` 으로 건수가 늘지 않고 created_at UPDATE 는 같은 값을 다시 쓴다.
E7. 표시 이름 unique 충돌. `Lick Library` 가 이미 있으면 DB 에러로 전체가 실패한다. 스크립트는 다루지 않는다.
E8. 접미가 두 번 이상 있는 헤딩. 마지막 ` — ` 를 기준으로 나눈다. 네 파일에는 없다. 테스트는 합성 입력으로 한다.
E9. 트리거. INSERT 뒤 UPDATE 순서를 바꾸면 날짜가 전부 오늘이 된다.
E10. 앱의 게시 흐름과 다른 점. 앱은 게시 전에 같은 melody_hash 의 원본을 찾아 canonical_id 를 붙이지만 시드는 canonical_id 를 null 로 넣는다. 시드 멜로디와 같은 멜로디를 사용자가 먼저 올린 경우는 없다고 보고 행마다 조회하지 않는다. 시드 뒤 사용자가 같은 멜로디를 올리면 앱 규칙대로 시드가 원본이 된다.

## 시나리오 기준 (S-n)

경량 트랙이다. S1 부터 S4 는 명령과 출력, S5 부터 S7 은 개발 서버(운영과 같은 DB)에서 Playwright 로 확인하고 스크린샷을 남긴다. S5 만 휴대폰 폭 390px 다.

S1. Given 네 md 파일. When 리포 루트에서 `npm run seed-licks -- --dry-run`. Then 표준 출력에 `guitarset 56`, `nottingham 59`, `omnibook 31`, `wjazzd 240`, 제외 3건의 (파일, 섹션 키, 릭 이름), `unique 383`, 태그별 건수가 있고 작업 디렉터리에 새 파일이 없다. 증거: `s1-dry-run.txt`.
S2. Given 네 md 파일. When `npm run seed-licks -- --out <스크래치패드>/seed-licks.sql`. Then 파일이 생기고 `update profiles` 문장이 처음, `on conflict` 가 한 번, `('4335250f-` 로 시작하는 values 행이 383개, `timestamptz '2026-` 가 383개다. 증거: `s2-sql-head.txt` (head 와 grep 건수).
S3. Given S2 파일. When `node scripts/sbquery.mjs < 파일` 을 두 번 실행하고 `select count(*) from licks where author_id = '4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf'` 를 조회한다. Then 두 번 다 383 이다. 증거: `s3-count.txt`.
S4. Given S3. When `select min(created_at), max(created_at), count(distinct created_at) from licks where author_id = '<시드 id>'`. Then `2026-03-01 00:00:00+00`, `2026-05-31 12:30:00+00`, 383 이다. `select display_name from profiles where id = '<시드 id>'` 는 `Lick Library` 다. 증거: `s4-dates.txt`.
S5. Given S3. When 휴대폰 폭 390px 에서 `/user/JSztbE7e` 를 연다. Then 표시 이름 `Lick Library` 와 릭 카드가 보인다. When 첫 카드를 누른다. Then `/lick/:id` 에서 악보가 그려지고 재생 버튼을 누르면 재생 상태로 바뀐다. 증거: `s5-user.png`, `s5-lick.png`.
S6. Given S3. When 검색에 `ii-v-i` 를 넣고 Enter. Then 결과에 태그 `#ii-v-i` 가 붙은 시드 릭이 있다. When 검색에 `Donna Lee` 를 넣고 Enter. Then 제목 `Donna Lee ii-V-I Bebop Line` 이 있다. 증거: `s6-search-tag.png`, `s6-search-title.png`.
S7. Given 시드 전에 Latest 첫 페이지 카드 제목 목록을 `s7-latest-before.txt` 에 기록했다. When 시드 뒤 `/` 를 연다. Then 시드 전 목록이 시드 후 첫 페이지의 맨 앞에 같은 순서로 있고, 시드 릭은 그 뒤에만 온다. 증거: `s7-latest-before.txt`, `s7-latest-after.txt`, `s7-latest.png`.
    (2026-11-10 재승인. 처음 문구 "목록이 같다" 는 게시물이 한 페이지 20건보다 적을 때 성립할 수 없어 고쳤다. 시드 전 게시물은 4건이었다.)

## 단위 기준 (AC-n)

AC-1. Given 섹션 하나와 항목 둘이 있는 합성 md 문자열. When 파싱한다. Then 항목마다 섹션 키, 릭 이름, 접미, 메타 줄, 해시가 R1 대로 나온다.
AC-2. Given 릭 이름 안에 ` — ` 가 한 번 더 있는 합성 헤딩. When 파싱한다. Then 마지막 ` — ` 앞까지가 릭 이름이다 (E8).
AC-3. Given 링크 없는 항목이 있는 합성 md. When 파싱한다. Then 파일명과 항목 번호를 담은 에러를 던진다 (E1).
AC-4. Given 디코딩되지 않는 해시(`v2zzzz`)가 있는 항목. When 검증한다. Then 파일명과 항목 번호를 담은 에러를 던진다 (R2).
AC-5. Given (wjazzd, 섹션 키 `ii–V–I`, 메타 스타일 `HARDBOP`), (guitarset, 섹션 키 `IV–I`, 접미 `Singer-Songwriter`), (nottingham, 섹션 키 `I–IV–V`). When 태그를 만든다. Then 각각 `['ii-v-i','jazz','hardbop']`, `['iv-i','blues','songwriter']`, `['i-iv-v','folk','traditional']` 이다 (R4).
AC-6. Given 매핑표에 없는 섹션 키. When 태그를 만든다. Then 파일명과 섹션 키를 담은 에러를 던진다 (E2).
AC-7. Given 같은 melody_hash 를 가진 항목 둘. When 중복을 제거한다. Then 첫 항목만 남고 제외 목록에 둘째의 (파일, 섹션 키, 릭 이름) 이 있다 (R5).
AC-8. Given i = 0, 1, 382. When 게시 시각을 계산한다. Then `2026-03-01T00:00:00.000Z`, `2026-03-01T05:45:00.000Z`, `2026-05-31T12:30:00.000Z` 다 (R6).
AC-9. Given 릭 이름 `Bird's Chromatic Climb and Turn` 인 항목 하나. When SQL 을 만든다. Then 문장 순서가 R7 과 같고 values 행에 `'Bird''s Chromatic Climb and Turn'` 과 `array['ii-v-i','jazz','bebop']` 이 있고 UPDATE 의 values 에 melody_hash 와 `timestamptz '2026-03-01T00:00:00.000Z'` 가 있다 (R7, E4).
AC-10. Given 실제 네 파일. When 파싱, 검증, 중복 제거까지 한다. Then 파일별 56, 59, 31, 240 이고 제외 3건은 모두 nottingham 이며 유일 383 이다 (R1, R2, R5).

## 구현 태스크

| id | 동작 | 포함 AC | 처음 동작시키는 S | 완료 조건 |
|---|---|---|---|---|
| T1 | md 파싱과 해시 검증, 파일별 건수 출력. `seed-licks-lib.ts`, CLI, npm 스크립트, vitest include | AC-1, AC-2, AC-3, AC-4 | S1 (건수 부분) | 단위 테스트 통과, dry-run 에 파일별 건수 |
| T2 | 태그 매핑, melody_hash, 중복 제거, dry-run 완성 | AC-5, AC-6, AC-7, AC-10 | S1 | 단위 테스트 통과, `s1-dry-run.txt` |
| T3 | 날짜 배정과 SQL 생성, `--out` | AC-8, AC-9 | S2 | 단위 테스트 통과, `s2-sql-head.txt` |
| T4 | 시드 전 Latest 기록, 운영 DB 실행 두 번, 건수와 날짜 조회, PROGRESS.md 와 DECISIONS.md 기록 | 없음 | S3, S4 | `s7-latest-before.txt`, `s3-count.txt`, `s4-dates.txt` |
| T5 | 개발 서버에서 작성자 페이지, 열람 재생, 검색, Latest 확인 | 없음 | S5, S6, S7 | 스크린샷 다섯 장과 `s7-latest-after.txt` |

## 테스트 목록

| id | 종류 | 파일 |
|---|---|---|
| S1, S2 | 시나리오 | 명령 출력을 `harness/evidence/seed-licks/s1-dry-run.txt`, `s2-sql-head.txt` 로 저장 |
| S3, S4 | 시나리오 | `node scripts/sbquery.mjs` 조회 출력을 `s3-count.txt`, `s4-dates.txt` 로 저장 |
| S5, S6, S7 | 시나리오 | Playwright 스크립트(스크래치패드), 증거 `harness/evidence/seed-licks/s5-user.png`, `s5-lick.png`, `s6-search-tag.png`, `s6-search-title.png`, `s7-latest-before.txt`, `s7-latest-after.txt`, `s7-latest.png` |
| AC-1 ~ AC-10 | 단위 | `scripts/seed-licks.test.ts` |

## 검증 증거

verify 단계에서 `harness/evidence/seed-licks/` 에 남길 것.
- `check.txt`: `harness/check.sh` 출력.
- 위 테스트 목록의 시나리오 증거 파일 전부.
- 롤백 명령을 `harness/DECISIONS.md` 에 적는다. `delete from licks where author_id = '4335250f-c7f6-4fc5-bf1d-d0d4a58e9baf';`
