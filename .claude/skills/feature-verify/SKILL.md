---
name: feature-verify
description: 구현이 끝난 기능을 독립 평가자로 검증하고 done 으로 보낼 때. 기능이 verify 단계일 때 쓴다.
---
# 검증 (verify)

모델: full 트랙은 Fable (evaluator), light 트랙은 Opus (evaluator-light).

1. `node harness/feature.mjs current` 로 대상과 트랙을 확인한다. PROGRESS.md 에서 기준 커밋을 읽는다.
2. 증거를 모은다. `harness/evidence/<id>/` 에
   - `check.txt`: `harness/check.sh` 출력. 스크래치패드에 먼저 쓰고(`harness/check.sh > $SCRATCH/check.txt`) `git rev-parse HEAD` 를 뒤에 붙인 다음 증거 폴더로 옮긴다. 저장소 안으로 바로 리다이렉트하면 트리가 더러워져 `.last-check` 가 갱신되지 않는다.
   - 시나리오별 스크린샷(전체 트랙). 명세의 시나리오 기준에 적힌 파일명으로. 전체 트랙은 스크린샷이 하나 이상 있어야 done 게이트를 통과한다.
   증거 파일을 커밋한 뒤 `check.sh` 를 한 번 더 돌려 `.last-check` 를 HEAD 로 맞춘다.
3. 평가자에게 위임한다. 프롬프트에 기능 id, 명세 경로, 기준 커밋, 증거 폴더를 넣는다. 평가자는 명세의 S-n 을 대본으로 개발 서버를 띄워 직접 수행하고 스크린샷을 남긴다.
   평가자가 `verdict.md` 를 쓴다. 메인 세션은 이 파일을 쓰지 않는다(훅이 막는다).
4. 판정을 읽고 사용자에게 알린다(verdict.md 전체 경로 포함).
   - `PASS`, light 트랙: verdict.md 를 커밋하고 `node harness/feature.mjs stage <id> done --model <평가 모델>`. 실패하면 게이트 메시지대로 조치한다.
   - `PASS`, full 트랙: verdict.md 를 커밋한 뒤 사용자가 휴대폰에서 확인할 수 있게 한다. `npm run build && npx wrangler pages deploy --branch preview-<id>` 로 운영본을 건드리지 않는 미리보기(`https://preview-<id>.lickshare.pages.dev`)를 올리거나, 개발 서버를 `npm run dev -- --host` 로 띄우고 `/mobile-view` 로 링크를 준다. 명세의 시나리오를 휴대폰에서 확인해 달라고 AskUserQuestion 으로 묻고, 확인되면 `stage <id> done`. 고칠 점이 나오면 NEEDS_WORK 와 같이 처리한다.
   - `NEEDS_WORK`: 발견 사항을 PROGRESS.md "다음 행동"에 옮기고 `stage <id> implement --note "NEEDS_WORK: <요약>"` 후 `/feature-implement`.
     같은 발견이 두 번째면 승격 규칙(planner 에게 원인 분석)을 적용한다.
5. done 이 되면 feature 브랜치를 main 으로 `--no-ff` 머지하고 push 한 뒤 운영 배포(`npx wrangler pages deploy`)는 사용자에게 확인하고 한다. 그리고 `/session-end` 로 마무리한다. 다음 기능은 새 세션에서 시작하는 것을 권장한다.

평가자 판정을 메인 세션이 뒤집지 않는다. 판정이 틀렸다고 생각되면 사용자에게 보여 주고 결정을 받는다.
