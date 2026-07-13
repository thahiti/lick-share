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

## 커뮤니티

로그인한 사용자가 편집을 마친 릭을 게시하고, 좋아요·랭킹·게시판으로 서로 공유하는 기능.
동일 판정은 멜로디(음정 델타 + 리듬) 기준이라 조옮김·템포·코드가 달라도 같은 멜로디면
게시는 되지만(유사릭) 좋아요는 항상 최초 게시(원본)에 귀속된다. 원본이 삭제되면 가장
오래된 유사릭이 원본 지위와 좋아요를 승계한다. 백엔드는 Supabase(Postgres + RLS) 하나뿐,
자체 서버는 없다.

### 로컬 개발

```bash
cp .env.example .env.local   # *.local은 gitignore 대상 — 커밋 금지
# .env.local에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 채우기
npm run dev
```

### 배포

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행 — profiles·licks·likes, RLS, 랭킹 view,
   원본 승계 trigger를 한 번에 만든다
3. Authentication에서 Google OAuth(또는 이메일 매직링크) 활성화 + Site URL 등록
4. 정적 호스팅(Vercel, Cloudflare Pages 등)에 배포 — 환경 변수
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 개 등록,
   SPA rewrite 필수: `/(.*) → /index.html`
   (라우팅이 경로 기반이라 `/lick/:id` 같은 주소를 새로고침하거나 직접 열면 정적
   호스트가 rewrite 없이는 404를 낸다)

### 게시 방법

편집기 공유 버튼으로 얻은 링크(`?mode=view#v1.…`)에서 해시를 복사해 `/publish`에
붙여넣거나, `/publish#v1.…`로 바로 접속한다. 멜로디 해시로 중복을 판정하므로 본인이
같은 릭을 다시 게시하면 차단되고, 음표가 없는 링크는 게시할 수 없다.

## 수동 점검

릴리스 전 `docs/e2e-checklist.md`의 시나리오를 실기기에서 확인한다
(iOS 해시 길이 실측 항목 포함). 커뮤니티 기능은 `docs/community-e2e-checklist.md`를
별도로 확인한다.
