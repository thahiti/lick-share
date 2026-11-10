---
name: feature-spec
description: 진행 중 기능의 정밀 명세(03-spec.md)를 쓰고 사용자 승인을 받을 때. 기능이 spec 단계일 때 쓴다. 이 문서가 구현과 검증의 유일한 기준이다.
---
# 명세 (spec)

모델: Fable (planner 서브에이전트). 산출물: `docs/features/<id>/03-spec.md`.

1. `node harness/feature.mjs current` 로 대상을 확인한다.
2. planner 에게 위임한다. 프롬프트에 넣을 것.
   - 승인된 01-plan.md, 02-design.md(있으면), 템플릿 `harness/templates/03-spec.md`, `CLAUDE.md` 의 레이어 규칙과 절대 규칙.
   - 요구: 기준을 두 층으로. 시나리오 기준 S-n 은 기획의 종료 시나리오를 Given, When, Then 으로 옮긴 것이며 개발 서버에서 Playwright 스크립트로 실행하고 스크린샷을 남긴다(`.claude/skills/verify/SKILL.md` 방식). 단위 기준 AC-n 은 규칙(R-n)마다 하나 이상, 단위 테스트로 고정한다. 구현 태스크 표는 각 태스크가 어떤 S-n 을 처음 동작시키는지 적는다. 테스트 목록 표에 파일 경로까지.
   - 어느 레이어에 무엇이 들어가는지 적는다(core 순수 함수, community api, 화면). DB 변경이 있으면 `supabase/schema.sql` 과 SQL Editor 에서 실행할 마이그레이션 SQL 을 둘 다 적는다.
   - 엣지케이스를 명시적으로 나열. `docs/product/SPEC.md` 나 DESIGN.md 와 다른 점은 이유와 함께.
3. 명세를 검토한다. 다음이 있으면 planner 에게 되돌린다.
   - "적절히", "필요 시" 같은 해석이 갈리는 표현.
   - 테스트로 확인할 수 없는 AC. 브라우저나 명령으로 실행할 수 없는 S.
   - 기획의 종료 시나리오 중 S-n 으로 옮겨지지 않은 것.
   - 기획서 범위 밖의 규칙.
4. 사용자에게 시나리오 기준 S-n 전체와 규칙 요약을 보여 주고 AskUserQuestion 으로 승인을 묻는다. 문서 경로는 전체 경로로.
5. 승인되면
   - 문서 상태 "승인됨".
   - `node harness/feature.mjs approve <id> spec`
   - 커밋: `docs(<id>): add spec`
   - `stage <id> implement --model opus` 후 `/feature-implement`.

승인 뒤 명세를 바꾸려면 사용자 승인을 다시 받고 `approve <id> spec --note "<변경 이유>"` 로 기록한다.
