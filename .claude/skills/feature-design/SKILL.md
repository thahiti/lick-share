---
name: feature-design
description: 전체 트랙 기능의 디자인 문서(02-design.md)와 시안(mockup.html)을 만들고 사용자 승인을 받을 때. 기능이 design 단계일 때 쓴다.
---
# 디자인 (design)

모델: Fable (planner 서브에이전트). 산출물: `docs/features/<id>/02-design.md`, `docs/features/<id>/mockup.html`.

1. `node harness/feature.mjs current` 로 대상을 확인한다. 트랙이 light 면 이 단계는 없다. `/feature-spec` 으로 간다.
2. planner 에게 위임한다. 프롬프트에 넣을 것.
   - 승인된 `01-plan.md` 경로, 템플릿 `harness/templates/02-design.md`, `docs/product/DESIGN.md`(토큰과 화면 언어), `src/styles/tokens.css`.
   - 시안은 정적 HTML 하나(`mockup.html`). 외부 스크립트 없이 인라인 CSS. 색과 간격은 tokens.css 의 값을 그대로 쓴다. 악보 기호는 SMP 유니코드 대신 SVG 나 글자로 흉내 낸다. 실제 데이터 모양의 예시 값을 넣는다.
   - 시안은 종료 시나리오의 단계를 화면으로 보여 준다. 시나리오 하나에 상태 여러 개(입력 전, 입력 중, 저장 후)를 앵커로 나눠 휴대폰에서 순서대로 넘겨 볼 수 있게 한다. 사용자는 "이 흐름이면 된다" 를 승인한다.
   - 반응형으로 만든다. `<meta name="viewport">` 를 넣고 휴대폰 폭(390px)에서 먼저 보기 좋게, 태블릿(640~1023px)과 데스크톱(1024px 이상) 티어는 기존 화면의 브레이크포인트를 따른다. 사용자는 휴대폰으로 확인한다.
   - 기존에 승인된 다른 기능의 디자인이 있으면 같은 레이아웃 언어를 쓴다.
3. 시안을 Artifact 로 게시해 링크를 사용자에게 준다. 디자인 문서 경로도 전체 경로로 준다. 화면 구성과 상호작용을 요약한다.
4. 피드백을 받아 planner 에게 반영시킨다. 승인을 AskUserQuestion 으로 묻는다.
5. 승인되면
   - 문서 상태 "승인됨", Artifact 링크를 문서에 기록.
   - `node harness/feature.mjs approve <id> design`
   - 커밋: `docs(<id>): add design and mockup`
   - `stage <id> spec --model fable` 후 `/feature-spec`.
