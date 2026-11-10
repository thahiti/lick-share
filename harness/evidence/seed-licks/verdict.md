PASS

# seed-licks 경량 트랙 평가

- 기능 id: `seed-licks`
- 브랜치: `feature/seed-licks`, HEAD `073be23`, 기준 커밋 `1fadbf0`
- 기준 문서: /Users/randy/claude_code/lick_share/scorelink/docs/features/seed-licks/03-spec.md (S7 은 2026-11-10 재승인 문구)
- 평가일: 2026-11-10

## 직접 실행한 결과

- `harness/check.sh`: 통과. typecheck, lint, test(69 파일, 655 건), check-smp 모두 통과했고 `.last-check = 073be23` 으로 갱신됐다.
- `npx vitest run scripts/seed-licks.test.ts`: 10 건 전부 통과. AC-1 부터 AC-10 까지 이름이 붙은 테스트가 하나씩 있다.
- `npm run seed-licks -- --dry-run`: 종료 코드 0. 출력이 증거 `s1-dry-run.txt` 와 바이트 단위로 같다. 실행 전후 `git status --porcelain --untracked-files=all` 이 같아 새 파일이 없다.
- `npm run seed-licks -- --out <스크래치패드>/eval-seed.sql`: 첫 줄이 `update profiles ...`, `on conflict` 1 건, `('4335250f-` 행 383 건, `timestamptz '2026-` 383 건. 시각은 383 개가 모두 서로 다르고 처음 `2026-03-01T00:00:00.000Z`, 마지막 `2026-05-31T12:30:00.000Z` 다. 문장 순서는 profiles UPDATE(1행), INSERT(3행), on conflict(387행), created_at UPDATE(389행부터 773행).
- 플래그 없이 실행, `--dry-run` 과 `--out` 을 함께 실행: 둘 다 사용법을 출력하고 종료 코드 1. 파일은 생기지 않는다.
- `git diff --stat 1fadbf0..HEAD -- src supabase`: 변경 없음.
- `git log 1fadbf0..HEAD --format=%B | grep -i -c 'claude\|anthropic'`: 0.

## AC 표

| AC | 테스트 이름 | 판정 |
|---|---|---|
| AC-1 | parseLicks > AC-1 섹션 키, 릭 이름, 접미, 메타 줄, 해시를 항목마다 뽑는다 | 통과. 섹션 하나 항목 둘. `Major ii–V–I (...)` 에서 키 `ii–V–I`, 헤딩 뒤 빈 줄을 건너뛴 메타 줄, 링크가 둘일 때 첫 링크의 해시를 객체 전체 비교로 검사한다. |
| AC-2 | parseLicks > AC-2 헤딩에 구분자가 두 번이면 마지막 구분자 앞까지가 릭 이름이다 | 통과. `Call — Response Climb — Singer-Songwriter` 에서 이름과 접미를 정확히 비교한다. |
| AC-3 | parseLicks > AC-3 다음 헤딩 전까지 링크가 없으면 파일명과 항목 번호를 담은 에러를 던진다 | 통과. 링크 없는 2번 항목 뒤 `## ` 다음 섹션에 링크가 있어 `## ` 에서 탐색이 멈추는지도 함께 검사한다. |
| AC-4 | decodeLick > AC-4 디코딩되지 않는 해시는 파일명과 항목 번호를 담은 에러를 던진다 | 통과. 해시 `v2zzzz`, 항목 번호 7, 에러에 `omnibook` 과 `7번 항목`. |
| AC-5 | lickTags > AC-5 섹션 키와 접미, 메타 스타일에서 진행, 장르, 스타일 태그를 만든다 | 통과. 세 경우의 기대 배열이 명세와 정확히 같다. |
| AC-6 | lickTags > AC-6 매핑표에 없는 섹션 키는 파일명과 섹션 키를 담은 에러를 던진다 | 통과. nottingham 에 `ii–V–I` 를 넣어 파일명과 섹션 키가 에러에 있는지 검사한다. |
| AC-7 | dedupeByMelody > AC-7 같은 melody_hash 가 다시 나오면 첫 항목만 남기고 뒤 항목을 제외 목록에 둔다 | 통과. 사이에 다른 해시 항목을 끼워 순서 보존과 제외 목록의 (파일, 섹션 키, 릭 이름) 을 검사한다. |
| AC-8 | publishedAt > AC-8 i 번째 게시 시각은 2026-03-01 00:00 UTC 부터 345분 간격이다 | 통과. i = 0, 1, 382 의 ISO 문자열을 정확히 비교한다. |
| AC-9 | seedSql > AC-9 세 문장을 R7 순서로 쓰고 작은따옴표는 두 번 쓴다 | 통과. 다섯 조각의 위치가 0 에서 시작해 증가하는지, `'Bird''s Chromatic Climb and Turn'` 과 `array['ii-v-i','jazz','bebop']` 이 있는 행, UPDATE values 의 `('f00d', timestamptz '2026-03-01T00:00:00.000Z')` 를 검사한다. |
| AC-10 | buildSeed > AC-10 실제 네 파일은 56, 59, 31, 240 건이고 nottingham 3건을 빼면 유일 383건이다 | 통과. 실제 파일로 건수, 제외 3 건이 모두 nottingham, 유일 383 을 검사한다. |

모든 AC 에 같은 id 의 테스트가 있고, 기대값을 느슨하게 했거나 다른 것을 검사하는 테스트는 없다.

## S 표

증거 파일은 모두 /Users/randy/claude_code/lick_share/scorelink/harness/evidence/seed-licks/ 아래에 있다.

| S | 증거 | 판정 |
|---|---|---|
| S1 | `s1-dry-run.txt`, 직접 실행 | 통과. `guitarset 56`, `nottingham 59`, `omnibook 31`, `wjazzd 240`, 제외 3 건(모두 nottingham `I–IV–V–I`, E3 의 세 곡 Bottom of the Punch Bowl, The Girl With the Blue Dress on, Tom Pate 의 두 번째 항목과 일치), `unique 383`, 태그별 건수가 태그 이름 순으로 있다. 직접 실행 결과가 증거와 같고 새 파일이 없다. |
| S2 | `s2-sql-head.txt`, 직접 실행 | 통과. 증거와 직접 실행 모두 values 383, timestamptz 383, on conflict 1, `update profiles` 가 첫 문장. |
| S3 | `s3-count.txt` | 통과. 두 번 실행 뒤 건수가 모두 383. |
| S4 | `s4-dates.txt` | 통과. min `2026-03-01 00:00:00+00`, max `2026-05-31 12:30:00+00`, distinct 383, total 383, display_name `Lick Library`, public_id `JSztbE7e`. |
| S5 | `s5-user.png`, `s5-lick.png` | 통과. 780px 폭(390px 의 2배 밀도) 화면에 표시 이름 `Lick Library` 와 시드 카드가 보인다. 첫 카드 `Scale Dip, Arpeggio Leap` 의 상세 화면에서 악보가 그려지고 재생 버튼이 일시정지 아이콘으로 바뀌었으며 재생 위치선이 보인다. |
| S6 | `s6-search-tag.png`, `s6-search-title.png` | 통과. `ii-v-i` 검색 결과에 `#ii-v-i` 태그가 붙은 Lick Library 릭이 있다. `Donna Lee` 검색 결과에 `Donna Lee ii-V-I Bebop Line` 이 있다. |
| S7 | `s7-latest-before.txt`, `s7-latest-after.txt`, `s7-latest.png` | 통과. 시드 후 첫 페이지 20 건 중 앞 4 건이 시드 전 목록과 같은 순서로 같다. 뒤 16 건은 직접 만든 SQL 의 유일 목록 마지막 16 건을 최신순으로 뒤집은 것과 정확히 같아 모두 시드 릭이다. 스크린샷에서도 사용자 글 4 건이 맨 앞에 있다. |

## 확인 표

| 항목 | 결과 |
|---|---|
| 모든 AC 에 같은 id 의 테스트 | 있음 (10/10) |
| 테스트가 AC 의 Given, When, Then 을 그대로 검사 | 그렇다. 느슨한 기대값 없음 |
| 명세에 없는 공개 함수, 테이블, 정책 | 테이블과 정책 추가 없음. 공개 함수는 명세 레이어 책임(파싱, 검증, 매핑, 중복 제거, 날짜, SQL) 안에 있고 모두 테스트나 CLI 가 쓴다. 명세 밖 동작은 아래 발견 사항 1, 2, 3 |
| `src/`, `supabase/` 무변경 | 무변경. 순수 레이어 손대지 않음 |
| 레이어 | `scripts/seed-licks-lib.ts` 는 `src/core/codec.ts`, `src/community/melody-hash.ts`, `src/community/tags.ts` 만 import 하고 파일과 프로세스를 만지지 않는다. R3 의 `melodyHash(song.notes)` 는 앱 게시 흐름(`src/community/views/Publish.tsx` 152행 `melodyHash(validSong.notes)`)과 같은 호출이다 |
| 커밋 트레일러 | Claude, Anthropic 언급 0 건 |
| 롤백 기록 | `harness/DECISIONS.md` 에 롤백 명령이 있다 |

## 발견 사항

차단 사항은 없다. 아래는 명세에 적혀 있지 않은 동작과 참고 사항이다.

1. /Users/randy/claude_code/lick_share/scorelink/scripts/seed-licks-lib.ts 49~50행. 헤딩에 ` — ` 접미가 없으면 에러를 던진다.
   R1 은 마지막 ` — ` 로 나누는 규칙만 정하고 접미가 없는 경우를 정하지 않았으며 엣지케이스 목록에도 없다. 테스트도 없다.
   네 파일에는 해당 헤딩이 없어(AC-10 통과) 결과에 영향은 없다. R2 의 "부분 출력 없이 전체 실패" 방침과 같은 방향의 보수적 선택이다.
   권장: 다음 명세 수정 때 엣지케이스로 적거나 그대로 둔다.
2. /Users/randy/claude_code/lick_share/scorelink/scripts/seed-licks.ts 24행. `--out` 뒤에 경로가 없으면 사용법을 출력하고 종료 코드 1.
   명세의 "둘 다 없거나 둘 다 있으면" 을 자연스럽게 넓힌 것이며 영향 없음.
3. /Users/randy/claude_code/lick_share/scorelink/scripts/seed-licks.ts 35행. `--out` 실행 때 `<경로> 에 383건을 썼다` 한 줄을 표준 출력에 쓴다.
   명세는 `--out` 의 표준 출력을 정하지 않았다. 영향 없음.
4. /Users/randy/claude_code/lick_share/scorelink/scripts/seed-licks-lib.ts 29행. 에러 위치 문자열에 파일명과 항목 번호 외에 섹션 키도 넣는다.
   항목 번호가 섹션마다 1 부터 다시 시작하므로 위치를 특정하려는 것이고, R2, E1, E2 의 요구(파일명과 항목 번호, 파일명과 값)를 모두 담는다.
5. E2 의 wjazzd 스타일 값 미등록 경우와 guitarset 접미 미등록 경우는 코드(`mappedStyle`)로 에러를 던지지만 단위 테스트는 없다. AC-6 이 섹션 키만 요구하므로 기준 위반은 아니다.
6. 증거 `check.txt` 는 HEAD `fbc2d23` 에서 미커밋 변경이 있는 상태로 찍혔다. 평가자가 HEAD `073be23` 에서 다시 실행해 같은 655 건 통과와 `.last-check` 갱신을 확인했다.
