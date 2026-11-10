---
name: feature-intake
description: 제품 기획을 단위 기능으로 분해해 레지스트리에 등록할 때. 시작 가능한 기능이 없거나 새 영역(예: 청음 훈련)을 추가할 때 쓴다.
---
# 기능 분해 (intake)

모델: Fable (planner 서브에이전트).

1. planner 에게 위임한다. 프롬프트에 다음을 넣는다.
   - 읽을 것: 대상 제품 기획(예: `docs/product/ear-training-plan.md` 의 기능 분해 절), `docs/product/SPEC.md`, `docs/features/` 의 기존 기능 목록(`node harness/feature.mjs list`).
   - 할 것: 첫 버전 범위를 단위 기능으로 분해한다. 기능 하나는 한 세션(문서 셋 + 구현)에 끝날 크기.
     사용자 시나리오 하나가 화면부터 DB 까지 관통하는 세로 조각으로 자른다. 계층(core, api, 화면)은 기능 안의 태스크로 내려간다.
     각 기능에 id(소문자 하이픈), 제목, 근거 문서 절 번호, 트랙(full 은 화면 있음, light 는 없음), 의존 기능을 붙인다.
     의존은 실제로 코드나 데이터를 쓰는 기능만 적는다.
   - 결과는 `docs/features/INTAKE.md` 에 표로 쓴다. 기존 표가 있으면 개정 번호와 이유를 붙여 갱신한다. 코드와 레지스트리는 건드리지 않는다.
2. 표를 사용자에게 보여 주고 확인받는다. 기능이 너무 크거나 작으면 여기서 고친다. 기획 문서의 열린 질문이 남아 있으면 먼저 AskUserQuestion 으로 하나씩 답을 받는다.
3. 확인된 순서대로 등록한다.
   `node harness/feature.mjs add <id> --title "<제목>" --ref "<근거 문서 절>" --track <full|light> --deps <a,b>`
   의존 기능이 먼저 등록되어 있어야 한다.
4. `node harness/feature.mjs list` 결과와 함께 커밋한다. `docs(harness): register features from intake`.
5. 첫 기능을 `start` 하고 `/feature-plan` 으로 간다.
