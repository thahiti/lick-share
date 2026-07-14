---
name: verify
description: ScoreLink 앱을 실제로 구동해 변경을 눈으로 검증하는 레시피 (dev 서버 + Playwright)
---

# ScoreLink 구동 검증

## 빌드/실행

- `.env.local`에 VITE_SUPABASE_URL/ANON_KEY가 이미 있다 — 별도 설정 불필요.
- dev 서버: `npm run dev -- --port 5199` (백그라운드로). 3초 내에 `curl localhost:5199` 200.

## 브라우저 구동 (Playwright)

- 프로젝트에 playwright devDep 없음. npx 캐시의 것을 재사용한다:
  `ln -sfn /Users/randy/.npm/_npx/e41f203b7505f1fb/node_modules <scratch>/node_modules`
  후 `<scratch>`에서 ESM 스크립트(`import { chromium } from 'playwright'`) 실행.
- 브라우저는 `chromium.launch({ channel: 'chrome', headless: true })` — 시스템 Chrome 사용
  (ms-playwright 캐시 브라우저 없음).
- ESM은 NODE_PATH를 무시하므로 심링크 방식이 필요하다.

## 구동할 플로우

- 데스크톱 1280px: 피드 카드/사이드바 태그 칩 → /tag/:name, AppBar 검색 타이핑
  (디바운스 300ms — 1.2초 대기 후 `.c-sug` 확인), Enter → /search?q=.
- 모바일 390px: `.c-msearch-btn` 탭 → 오버레이 `.c-msearch`, autoFocus 확인.
- 셀렉터: `.c-card`, `.c-tag`, `.c-tagfeed h2`, `.c-sug`, `.c-results-h`, `.c-state`.

## 함정

- `type="search"` input에서 Chrome은 Escape로 텍스트를 지운다 — Escape 시나리오를
  jsdom 결과만 믿지 말 것 (실제로 이 경로에서 버그를 잡았다).
- 테스트 데이터는 전부 "Spring Sketch" 제목이라 제목 검색은 'spring'으로.
