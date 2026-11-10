---
name: feature-plan
description: 진행 중 기능의 기획서(01-plan.md)를 쓰고 사용자 승인을 받을 때. 기능이 intake 또는 plan 단계일 때 쓴다.
---
# 기획 (plan)

모델: Fable (planner 서브에이전트). 산출물: `docs/features/<id>/01-plan.md`.

1. `node harness/feature.mjs current` 로 대상 기능과 트랙을 확인한다. 단계가 intake 면 `stage <id> plan --model fable` 로 올린다.
2. planner 에게 위임한다. 프롬프트에 기능 id, 제목, 근거 문서 절, 트랙, 의존 기능, `docs/features/INTAKE.md` 의 종료 시나리오 요지, 템플릿 경로(`harness/templates/01-plan.md`)를 넣는다.
   기획서의 핵심은 "종료 시나리오" 절이다. 브라우저에서 무엇을 하면 무엇이 보이는지가 이 기능의 종료 조건이 된다. 휴대폰 폭에서 확인할 시나리오인지 적는다.
   비슷한 기능 두세 개를 한 번에 기획해도 된다(승인 묶어 받기). 단, 레지스트리 단계는 각각 올린다.
3. 결과 문서를 읽고 사용자에게 요약을 보여 준다. 목적, 종료 시나리오 전체, 범위, 열린 질문 순서. 승인은 "이 시나리오들이 브라우저에서 되면 이 기능은 끝" 에 대한 합의다. 문서 전체를 붙여넣지 않는다. 문서 경로는 전체 경로로 적고, 휴대폰으로 볼 링크가 필요하면 `/mobile-view` 스킬을 쓴다.
4. 열린 질문이 있으면 하나씩 AskUserQuestion 으로 묻고 답을 문서에 반영한다. 질문마다 배경, 예시, 파급효과, 추천 이유를 같이 적는다.
5. 승인을 AskUserQuestion 으로 묻는다. 수정 요청이면 planner 에게 다시 위임하고 3 으로 돌아간다.
6. 승인되면
   - 문서 상단 상태를 "승인됨"으로 바꾼다.
   - `node harness/feature.mjs approve <id> plan`
   - 커밋: `docs(<id>): add plan`
   - full 트랙은 `stage <id> design --model fable` 후 `/feature-design`. light 트랙은 `stage <id> spec --model fable` 후 `/feature-spec`.
