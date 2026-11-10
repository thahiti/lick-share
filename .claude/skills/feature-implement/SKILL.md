---
name: feature-implement
description: 승인된 명세를 TDD 로 구현할 때. 기능이 implement 단계일 때 쓴다.
---
# 구현 (implement)

모델: Opus (implementer 서브에이전트). 기준: `docs/features/<id>/03-spec.md`.

1. `node harness/feature.mjs current` 로 대상을 확인한다. 단계가 implement 가 아니면 진행하지 않는다(승인 게이트는 `feature.mjs` 가 검사한다).
2. feature 브랜치를 만든다: `git checkout -b feature/<id>`. 기준 커밋을 적어 둔다: `git rev-parse HEAD` 를 `harness/PROGRESS.md` "현재 상태"에 `기준 커밋: <해시>` 로 기록한다. 검증 단계의 diff 범위가 된다.
3. implementer 에게 위임한다. 프롬프트에 명세 경로, 기준 커밋, 이번에 구현할 태스크(명세의 "구현 태스크" 절 T-n) 범위를 넣는다.
   태스크 단위로 위임한다. 한 번에 두세 태스크까지. 한 번의 위임이 컨텍스트를 다 쓰지 않게.
   태스크마다 "구현 → typecheck, lint, 단위 테스트 → 개발 서버에서 실제 실행 → 그 태스크가 처음 동작시키는 S-n 통과 → 커밋" 을 한 사이클로 돈다. 자동 테스트만 통과하고 시나리오 실행을 건너뛴 태스크는 끝난 것이 아니다. 종료 조건은 "파일을 만들었다" 가 아니라 "시나리오가 브라우저에서 동작한다" 다.
4. 보고를 받으면 확인한다.
   - `git log --oneline <기준>..HEAD` 커밋이 AC 단위로 나뉘어 있는가.
   - `harness/check.sh` 를 직접 실행해 통과를 확인한다. 보고만 믿지 않는다.
   - 명세에 없는 변경이 섞였으면 되돌리게 한다.
   - 명세의 테스트 목록 표와 실제 파일을 대조한다. 빠진 파일이 있으면 만들게 한다.
   - DB 변경이 있으면 마이그레이션 SQL 을 사용자에게 보여 주고 SQL Editor 실행 여부를 확인한다.
5. implementer 가 "명세가 틀렸다"고 멈추면 사용자에게 보여 주고 결정을 받는다. 명세를 고치면 `/feature-spec` 의 재승인 절차를 따른다.
6. 승격 규칙: 같은 원인의 실패가 두 번 반복되면 planner(Fable)에게 원인 분석과 명세 보강을 맡긴 뒤 다시 위임한다.
7. 모든 S-n 과 AC-n 이 통과하고 `check.sh` 가 통과하면 `stage <id> verify --model opus` 후 `/feature-verify`.

메인 세션이 직접 코드를 쓰는 경우는 한 줄짜리 수정뿐이다. 그 경우에도 테스트를 먼저 쓴다.
