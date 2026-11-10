---
name: session-end
description: 세션을 끝내거나 작업 단위를 마무리할 때. 커밋, 인수인계 문서, 레지스트리를 정리한다.
---
# 세션 종료

다음 세션이 이 세션의 기억 없이 이어받을 수 있게 만든다.

1. 코드가 바뀌었으면 `harness/check.sh` 를 실행한다. 실패는 그대로 보고하고 통과한 척하지 않는다.
2. `git status` 로 미커밋 변경을 확인한다. 논리 단위마다 커밋한다(`atomic-commit` 스킬).
   끝나지 않은 작업은 커밋하지 말고 PROGRESS.md 에 상태를 적는다.
3. feature 브랜치의 작업이 끝났으면 main 으로 `--no-ff` 머지(`merge:` 제목, 본문 한글)하고 브랜치를 지운 뒤 push 한다.
4. `harness/PROGRESS.md` 를 갱신한다.
   - 현재 상태: 배포본, 진행 중 기능과 단계, 테스트 수.
   - 마지막 작업: 오늘 날짜로 한두 줄.
   - 다음 행동: 다음 세션이 첫 번째로 할 일을 명령 수준으로. 예: "`/feature-implement` 로 T2 부터".
   - 막힌 것: 없으면 "없음".
   - 열린 결정: 사용자 답이 필요한 것.
5. 되돌리기 비싼 결정을 했으면 `harness/DECISIONS.md` 에 날짜와 이유를 적는다.
6. 단계가 바뀌었으면 `node harness/feature.mjs stage <id> <단계> --model <모델>` 로 기록했는지 확인한다.
7. PROGRESS.md 와 DECISIONS.md 변경을 커밋한다. 제목 예: `docs(harness): update progress after playlist spec`.
8. 백그라운드 개발 서버가 있으면 끝낸다.
9. 마지막으로 다음 행동을 한 줄로 사용자에게 말한다. 휴대폰으로 볼 링크가 필요하면 `/mobile-view` 스킬을 쓴다.
