---
name: session-start
description: 세션을 시작할 때. 환경을 준비하고 진행 중 기능의 현재 단계로 이어간다. 훅이 주입한 컨텍스트를 읽은 직후 쓴다.
---
# 세션 시작

한 세션에 기능 하나. 이전 세션의 기억은 없으므로 파일에서 상태를 복원한다.

1. `harness/init.sh` 를 실행한다. 실패하면 원인을 해결하기 전에 다른 일을 하지 않는다.
2. `node harness/feature.mjs current` 로 진행 중 기능을 확인한다.
   - 있으면 `harness/PROGRESS.md` 의 "다음 행동"을 읽고 그 기능의 현재 단계 스킬로 간다.
     intake → `/feature-intake`, plan → `/feature-plan`, design → `/feature-design`,
     spec → `/feature-spec`, implement → `/feature-implement`, verify → `/feature-verify`.
   - 없으면 `node harness/feature.mjs next` 에서 하나를 골라 사용자에게 확인받고 `start` 한다.
     시작 가능한 기능이 없으면 `/feature-intake` 로 간다.
3. 현재 단계의 권장 모델을 한 줄로 안내한다(`CLAUDE.md` 파이프라인 표).
   기획, 디자인, 명세, 전체 트랙 검증은 Fable. 구현과 경량 검증은 Opus.
   메인 세션 모델은 사용자가 정한다. 강제하지 않는다.
4. 워킹트리에 미커밋 변경이 있으면 무엇인지 먼저 확인하고, 이전 세션이 남긴 작업이면 이어서 마무리하거나 사용자에게 묻는다.
5. 기능 파이프라인 밖의 요청(버그 수정, 배포, 문서 정리)은 하네스를 거치지 않고 전역 규칙(feature 브랜치, 게이트, atomic-commit)대로 처리한다. 다만 끝나면 `harness/PROGRESS.md` 의 "마지막 작업"에 한 줄 남긴다.

하지 않는 것
- 진행 중 기능이 있는데 다른 기능을 건드리는 것.
- 레지스트리 상태를 읽지 않고 "다 됐다"고 판단하는 것.
