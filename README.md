# ScoreLink

악보를 URL 해시에 담아 서버 없이 공유하는 모바일 웹앱.
크로매틱 드럼 패드로 멜로디를 입력하고, 코드 반주·메트로놈과 함께 재생하고,
링크 하나로 열람 화면을 공유한다. 백엔드 없음 — 곡 전체가 URL에 인코딩된다.

프로토타입(`docs/prototype-reference.html`)으로 검증된 동작을
TypeScript + React로 재작성한 프로젝트다. 구버전 프로토타입 URL 해시와 하위 호환된다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드 (typecheck 포함)
npx vite preview   # dist 로컬 서브
```

## 검증

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp   # 공통 게이트
npm run dump -- "#v1.…" [--metro] [--no-acc] [--from=N]              # 이벤트 테이블 + ASCII 피아노롤
```

`npm run dump`는 귀 없이도 재생 결과를 눈으로 검증하는 계기판이다.
인자가 없으면 데모 곡을 덤프한다.

## 구조 (의존 화살표는 항상 안쪽)

```
core     완전 순수: 곡 모델·편집·쉼표 파생·지오메트리·undo·URL 코덱
engine   schedule(song, opts, from, to) → SoundEvent[]  (재생의 심장부, 순수)
ports    AudioSink / Clock / HashStore 인터페이스
adapters WebAudioSink·RafClock·LocationHashStore·player + 테스트용 fakes
ui       React 컴포넌트 + Zustand 스토어(core 순수 함수 래핑만)
```

순수 레이어는 전용 tsconfig(lib에서 DOM 제거)와 ESLint 제한으로 강제된다.
자세한 규칙은 `CLAUDE.md`, 명세는 `docs/SPEC.md`, 설계는
`docs/superpowers/specs/2026-07-12-ts-react-rewrite-design.md` 참조.

## 배포

정적 호스팅이면 충분하다 (GitHub Pages, Netlify, Cloudflare Pages 등).
`dist/`를 그대로 올리면 된다. 서버 상태 없음 — 공유 링크의 해시가 데이터 전부다.

## 수동 점검

릴리스 전 `docs/e2e-checklist.md`의 시나리오를 실기기에서 확인한다
(iOS 해시 길이 실측 항목 포함).
