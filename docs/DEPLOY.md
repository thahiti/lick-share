# 배포 가이드 — Cloudflare Pages

ScoreLink은 서버 상태가 없는 정적 SPA다. 빌드 산출물(`dist/`)을 정적 호스트에
올리면 끝이며, 현재 운영 배포는 **Cloudflare Pages**를 사용한다.

- 프로덕션: <https://lickshare.pages.dev>
- 저장소: <https://github.com/thahiti/lick-share>

Cloudflare Pages 프로젝트명은 `lickshare`이며, 이 값이 `.pages.dev` 서브도메인을
결정한다. 프로젝트명과 산출물 경로는 리포지토리 루트 `wrangler.toml`에 고정돼 있어
배포 시 별도 지정이 필요 없다.

```toml
name = "lickshare"
pages_build_output_dir = "dist"
```

## 사전 준비

- Node **20.19+** (Vite 8 요구사항)
- Cloudflare 계정 + Pages 프로젝트 `scorelink`
- 배포 도구: `wrangler` (별도 설치 없이 `npx`로 실행)

첫 실행 시 브라우저 인증이 필요하다.

```bash
npx wrangler login
```

## 빌드

```bash
npm run build   # typecheck → vite build, 산출물은 dist/
```

`npm run build`는 `tsc` 타입체크를 먼저 돌리므로 타입 오류가 있으면 빌드가
중단된다. 커밋 전 게이트(`npm run typecheck && npm run lint && npm test &&
npm run check-smp`)를 통과한 상태에서 배포하는 것을 원칙으로 한다.

## 배포

```bash
npx wrangler pages deploy
```

`wrangler.toml`에 프로젝트명·산출물 경로가 있으므로 디렉터리나 `--project-name`
지정 없이 배포된다. 배포마다 고유 미리보기 URL이 발급되고, 브랜치별 alias URL도
함께 생성된다.

| 대상 | URL 예시 |
|------|----------|
| 프로덕션(기본 브랜치) | `https://lickshare.pages.dev` |
| 개별 배포(고유 해시) | `https://<hash>.lickshare.pages.dev` |
| 브랜치 alias | `https://<branch>.lickshare.pages.dev` (예: `feat-community`) |

### 표준 절차

1. 배포할 브랜치로 체크아웃 후 게이트 통과 확인
2. `npm run build`
3. `npx wrangler pages deploy`
4. 발급된 URL에서 동작 확인

## 필수 설정

### 1. SPA rewrite (경로 기반 라우팅)

커뮤니티 라우팅은 경로 기반(`/`, `/lick/:id`, `/user/:public_id` 등)이다.
rewrite가 없으면 이런 주소를 **직접 열거나 새로고침할 때 정적 호스트가 404**를
낸다. `public/_redirects` 파일로 모든 경로를 `index.html`로 폴백시킨다.

```
/*    /index.html   200
```

`public/` 아래 파일은 빌드 시 `dist/`로 복사되므로 배포에 그대로 포함된다.
(곡 데이터는 URL 해시 `#v1.…`가 점유하며, 해시는 서버로 전송되지 않으므로
rewrite 대상이 아니다.)

### 2. 환경 변수 (커뮤니티)

커뮤니티 기능은 Supabase(Postgres + RLS)를 백엔드로 쓴다. Cloudflare Pages
프로젝트 설정 → Environment variables에 **Production·Preview 모두** 등록한다.

| 변수 | 설명 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` 공개 키 |

- **`service_role` 키는 코드·환경 변수 어디에도 넣지 않는다.** 프론트는 `anon`
  키 + RLS로만 권한을 통제한다 (CLAUDE.md 절대 규칙).
- 환경 변수는 빌드 타임에 주입되므로, 값 변경 후에는 반드시 재빌드·재배포한다.

Supabase 자체 설정(스키마 적용, OAuth 등)은 `README.md`의 「커뮤니티 → 배포」
절을 따른다.

## 캐시 / iOS Safari

정적 자산은 파일명에 해시가 붙어(`index-<hash>.js`) 자동 무효화되지만,
`index.html`이 캐시되면 이전 번들을 계속 참조할 수 있다. 배포 직후 변경이
보이지 않으면 강력 새로고침으로 캐시를 우회한다.

- **iOS Safari**: 주소창의 새로고침 버튼을 길게 눌러 "완전히 새로고침" 선택,
  또는 설정 → Safari → "검색 기록 및 웹사이트 데이터 삭제" 후 재시작.

## 롤백

각 배포는 고유 URL로 보존된다. Cloudflare Pages 대시보드의 Deployments에서
이전 배포를 "Rollback"으로 즉시 프로덕션에 복귀시킬 수 있다.
