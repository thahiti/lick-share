# 기능 분해 (INTAKE)

기획을 단위 기능으로 나눈 표.
레지스트리 등록은 `node harness/feature.mjs add` 로만 한다.

## 개정 1 (2026-11-10): 릭 모음 시드

근거: `content/licks/*.md` 다섯 모음과 `harness/DECISIONS.md` 2026-11-10 항목(시드 여부는 저작권 검토 뒤 결정).
검토 결과와 사용자 결정(2026-11-10): GuitarSet, Nottingham, WJazzD, Omnibook 네 모음을 올리고 Hooktheory 는 보류한다.
Hooktheory 는 CC BY-NC-SA 조건에 더해 현역 팝 곡 멜로디라 위험이 가장 크다.

| id | 제목 | 근거 | 트랙 | 의존 |
|---|---|---|---|---|
| `seed-licks` | 릭 모음을 전용 계정으로 커뮤니티 DB 에 시드 | `content/licks/` 네 모음, `harness/DECISIONS.md` 2026-11-10 | light | community |

화면이 없는 경량 트랙이다.
시드 스크립트가 md 를 파싱해 해시를 검증하고 melody_hash 를 계산한 뒤 SQL 을 만들고, 운영 DB 에는 Management API 로 넣는다.
