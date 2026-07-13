# ScoreLink 커뮤니티 기능 설계 문서 (v1.1)

| 항목 | 내용 |
|---|---|
| 버전 | 1.1 |
| 작성일 | 2026-07-10 |
| 상태 | 설계 확정 |
| 범위 | 게시, 계정, 좋아요, 랭킹, 게시판, 중복과 유사릭 처리, 원본 승계 |
| 구현 위치 | 기존 scorelink React 앱에 통합 (codec·Score·Viewer·player 재사용) |

## 설계 원칙

1. **URL 원본 원칙 유지**: 편집과 임시 공유는 기존 URL 방식 그대로. 게시는 URL에 담던 압축 blob을 DB 한 컬럼에 저장하는 행위일 뿐이며, 재생도 기존 URL 디코딩 경로(`decodeSong`)를 그대로 쓴다.
2. **얇은 구현, 안티 패턴 없이**: 자체 백엔드 서버 0대. 표준 패턴(profiles + 가입 trigger)은 훼손하지 않는다.
3. **계정 정보 최소화**: 비밀번호 없음. 이름·프로필 사진·공개 id 수준만 저장.

## 요구사항

- 편집 완료된 릭의 게시
- 최소한의 사용자 계정 (Google OAuth)
- 좋아요와 좋아요 랭킹
- 기본 화면은 최신순 게시판, 내가 만든 릭만 보기 제공
- 본인의 동일 릭 재게시 차단
- 유사릭(멜로디가 완전히 동일한 릭)은 게시 가능하되 좋아요는 최초 릭(원본)만 수령
- **동일 판정은 멜로디 기준**: 조옮김·템포·코드가 달라도 멜로디가 같으면 동일 릭
- 원본 삭제 시 다음으로 오래된 유사릭이 원본 지위와 좋아요를 승계
- **영속 링크**: `/lick/:id`로 릭 접근, `/user/:public_id`로 유저 릭 모아보기
- 목록은 **무한 스크롤**

## 기술 스택

| 계층 | 선택 |
|---|---|
| Frontend | 기존 scorelink 앱 (React 19 + Zustand + Vite 8), 정적 호스팅 |
| Auth | Supabase Auth (GoTrue), Google OAuth (대안: 이메일 매직링크) |
| DB·API | Supabase Postgres + PostgREST 자동 REST API |
| 권한 | RLS (Row Level Security) |
| SDK | @supabase/supabase-js v2 |

권한 계층이 미들웨어가 아니라 DB 안(RLS)에 있는 것이 구조의 핵심. anon key는 공개용(RLS가 보호), service_role key는 절대 클라이언트에 넣지 않는다. 프론트 환경 변수는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 둘.

## 인증과 프로필

- Google OAuth 단일. `signInWithOAuth({ provider: 'google' })`. 이름·아바타를 provider 메타데이터로 자동 수령.
- `auth.uid()`로 로그인 uuid를 읽고 컬럼 `default auth.uid()`와 결합해 명의 도용 차단.
- `auth.users`에 직접 컬럼 추가 금지(안티 패턴). `public.profiles`를 두고 가입 시 trigger로 자동 생성.

## 데이터 모델

id는 순차 숫자 대신 **짧은 랜덤 id**(영속 permalink, 열거 방지, DB default 생성). `/lick/:id`(11자), `/user/:public_id`(8자).

동일 판정은 **멜로디만**: 음정 간격 시퀀스(조옮김 불변) + 리듬(음길이·쉼표 배치)이 모두 같아야 동일. 조성·템포·코드·제목·박자표·마디 구분은 무시. 좋아요는 항상 원본 id로 기록(`canonical_id ?? id`), 복합 PK가 중복·이중 카운트를 스키마 차원에서 차단.

### melody_hash 알고리즘 (scorelink Note 모델 반영)

해시 대상은 압축 blob이 아니라 **디코딩한 노트 배열**. Note는 `{id, s, d, p}`이고 쉼표는 저장하지 않고 파생하므로, 토큰을 `[p−첫음p, s−첫음s, d]` 삼중항으로 정의한다(피치 델타=조옮김 불변, s 오프셋 갭=쉼표 위치·길이, d=리듬). 첫 음 이전·마지막 음 이후의 무음은 판정에서 제외. 직렬화 → SHA-256(`crypto.subtle`) → hex.

## 권한 (RLS)

RLS 기본 전부 거부. 읽기는 누구나(게시판·랭킹·유저 페이지 공개). licks/likes insert는 본인 명의만, delete는 본인 것만. licks **update 정책 없음(전면 불가)** — 게시물 수정은 "삭제 후 재게시". profiles update는 본인만, insert는 definer trigger 전담.

## 좋아요·랭킹·목록

- 좋아요는 `canonical_id ?? id`로 기록. 취소는 RLS가 본인 행만 삭제.
- 랭킹 view: `canonical_id is null`(원본만) + 조회 시점 실시간 집계(`count`). canonical 필터 필수(없으면 유사릭 개수만큼 중복 노출).
- 최신순 게시판: keyset 커서(`created_at < cursor`) 무한 스크롤. 목록 좋아요 수는 canonical 기준(유사릭 행에도 원본 카운트 표시).
- 유저 페이지: `public_id → uuid` 해석 후 그 author_id로 keyset 페이지네이션. 내 릭은 같은 쿼리에 삭제/관리 UI 추가.
- 랭킹은 offset 무한 스크롤(정렬 키가 실시간 변동) + id dedupe.

## 원본 삭제와 승계 (DB trigger)

원본 삭제 시 가장 오래된 유사릭이 새 원본으로 승격, 좋아요 전부와 나머지 유사릭의 canonical_id를 승계. 유사릭 없으면 좋아요는 cascade로 소멸. `before delete` trigger(cascade가 좋아요를 지우기 전에 이관, self-FK 재지정으로 FK 위반 방지), `security definer`(삭제 사용자에게 update 권한 없음).

## 게시 흐름

편집 완료 → 노트 디코딩 → melodyHash → 같은 해시의 원본 조회(`melody_hash = h AND canonical_id is null`) → 있으면 canonical_id 지정 insert(유사릭), 없으면 null insert(원본) → id 회수 후 `/lick/:id` 이동 → unique violation(23505)이면 "이미 게시한 릭" 안내(본인 재게시 차단).

## 수용한 리스크 (v1)

동시 게시 race(원본 2개)·클라이언트 해시 조작·좋아요 원본 귀속의 클라이언트 의존은 v1 수용(피해가 좋아요 수준, 필요 시 Edge Function 검증 추가). 음 하나짜리 릭의 광범위 동일 판정·옥타브 이동 동일 판정은 정의의 논리적 귀결로 수용.
- CLOSED: 원본·승계자 양쪽에 좋아요가 있는 사용자로 인한 승계 시 좋아요 PK 충돌(원본 삭제 불가)은 `succeed_canonical()`의 사전 delete로 차단.
- CLOSED: `licks.created_at` 클라이언트 조작(피드 고정·승계 탈취)은 `trg_lick_created_at` before-insert trigger로 서버 시각 강제.

## 범위 제외

게시물 수정(삭제 후 재게시로 갈음), 핸들 URL(/@handle), 프로필 편집 화면, like_count 비정규화/toggle RPC(view 실시간 집계로 대체), 댓글·팔로우·태그·검색·알림(성장 후), 주간 랭킹.

## 부록 A. 통합 SQL 스크립트

```sql
-- 0) 확장과 id 생성기
create extension if not exists pgcrypto;

create function gen_short_id(len int default 8) returns text
language sql volatile as
$$ select translate(encode(gen_random_bytes(len), 'base64'), '+/=', '-_') $$;

-- 1) 프로필과 가입 trigger
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_id text not null unique default gen_short_id(6),
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', '이름없는 연주자'),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 릭과 좋아요
create table licks (
  id text primary key default gen_short_id(8),
  author_id uuid not null default auth.uid()
    references profiles(id) on delete cascade,
  title text not null,
  blob text not null,
  melody_hash text not null,
  canonical_id text references licks(id),
  -- 개수 상한(3)은 DB CHECK, 원소 길이(15자)·정규화는 앱 계층(normalizeTags)에서 강제
  tags text[] not null default '{}'
    check (array_length(tags, 1) is null or array_length(tags, 1) <= 3),
  created_at timestamptz not null default now()
);

create table likes (
  user_id uuid not null default auth.uid()
    references profiles(id) on delete cascade,
  lick_id text not null references licks(id) on delete cascade,
  primary key (user_id, lick_id)
);

-- 3) 인덱스
create unique index licks_self_dup on licks (author_id, melody_hash);
create index licks_hash_idx on licks (melody_hash);
create index licks_feed_idx on licks (created_at desc);
create index licks_author_idx on licks (author_id, created_at desc);

-- 게시 시각은 서버가 정한다 (미래 시각 피드 고정·과거 시각 승계 탈취 차단)
create function public.force_lick_created_at() returns trigger
language plpgsql as $$
begin
  new.created_at := now();
  return new;
end $$;

create trigger trg_lick_created_at before insert on licks
  for each row execute function public.force_lick_created_at();

-- 4) RLS
alter table profiles enable row level security;
alter table licks enable row level security;
alter table likes enable row level security;

create policy "read profiles" on profiles for select using (true);
create policy "read licks" on licks for select using (true);
create policy "read likes" on likes for select using (true);
create policy "update own profile" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "insert own lick" on licks for insert with check (author_id = auth.uid());
create policy "delete own lick" on licks for delete using (author_id = auth.uid());
create policy "insert own like" on likes for insert with check (user_id = auth.uid());
create policy "delete own like" on likes for delete using (user_id = auth.uid());

-- 5) 랭킹 view (security_invoker: 조회자 권한 — 전 테이블 select 공개라 결과 동일)
create view ranking with (security_invoker = on) as
select
  l.id, l.title, l.blob, l.tags, l.created_at,
  p.public_id as author_public_id,
  p.display_name as author_name,
  p.avatar_url,
  count(lk.user_id) as like_count
from licks l
join profiles p on p.id = l.author_id
left join likes lk on lk.lick_id = l.id
where l.canonical_id is null
group by l.id, p.public_id, p.display_name, p.avatar_url
order by like_count desc, l.created_at desc;

-- 6) 원본 승계 trigger
create function succeed_canonical() returns trigger as $$
declare successor text;
begin
  if old.canonical_id is null then
    select id into successor from licks
      where canonical_id = old.id
      order by created_at limit 1;
    if successor is not null then
      update licks set canonical_id = null where id = successor;
      update licks set canonical_id = successor
        where canonical_id = old.id and id <> successor;
      -- 승계자와 원본 양쪽에 좋아요가 있는 사용자의 원본 좋아요는 버린다 (PK 충돌 방지)
      delete from likes where lick_id = old.id
        and user_id in (select user_id from likes where lick_id = successor);
      update likes set lick_id = successor where lick_id = old.id;
    end if;
  end if;
  return old;
end $$ language plpgsql security definer;

create trigger trg_succeed before delete on licks
  for each row execute function succeed_canonical();
```
