-- 0) 확장과 id 생성기
-- pgcrypto는 Supabase 관례대로 extensions 스키마에 설치한다.
-- (public에 설치하면 supabase_auth_admin의 search_path에서 gen_random_bytes가 안 잡힌다)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- gen_random_bytes는 pg_catalog가 아니라 pgcrypto(=extensions) 소속이라 스키마를 명시해야 한다.
-- 이 함수는 profiles.public_id / licks.id의 컬럼 DEFAULT로 호출되는데,
-- 가입 trigger는 search_path에 extensions가 없는 supabase_auth_admin 세션에서 발화한다.
-- 따라서 search_path를 ''로 고정하고 extensions.gen_random_bytes로 정규화한다
-- (translate·encode는 pg_catalog 소속이라 빈 search_path에서도 항상 해석된다).
create function gen_short_id(len int default 8) returns text
language sql volatile
set search_path = ''
as
$$ select translate(encode(extensions.gen_random_bytes(len), 'base64'), '+/=', '-_') $$;

-- 1) 프로필과 가입 trigger
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_id text not null unique default gen_short_id(6),
  -- 표시 이름은 라벨일 뿐 정체성이 아니다(릭과 좋아요는 id를 참조). 사용자가 바꿀 수 있다.
  display_name text not null
    constraint profiles_display_name_len check (length(btrim(display_name)) between 1 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 사칭 방지: 대소문자와 앞뒤 공백만 다른 이름은 같은 이름으로 본다
create unique index profiles_display_name_key on profiles (lower(btrim(display_name)));

create function public.handle_new_user() returns trigger
language plpgsql security definer as $$
declare
  base text := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), '이름없는 연주자'), 30);
  pid text := public.gen_short_id(6);
  name text := base;
begin
  -- 동명이인이 가입해도 실패하지 않도록 public_id 앞 4자를 꼬리로 붙인다. 본인이 나중에 바꾸면 된다.
  if exists (select 1 from public.profiles where lower(btrim(display_name)) = lower(name)) then
    name := left(base, 25) || ' ' || left(pid, 4);
  end if;
  insert into public.profiles (id, public_id, display_name, avatar_url)
  values (new.id, pid, name, new.raw_user_meta_data->>'avatar_url');
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
-- RLS는 행만 가르므로 열은 권한으로 막는다: 본인 행이라도 바꿀 수 있는 열은 display_name뿐
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;
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
