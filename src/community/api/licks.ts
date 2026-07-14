import { supabase } from '../supabase';

export const PAGE_SIZE = 20;

export interface LickRow {
  id: string;
  title: string;
  blob: string;
  author_id: string;
  canonical_id: string | null;
  tags: string[];
  created_at: string;
  profiles: { public_id: string; display_name: string } | null;
}

// profiles 임베딩은 FK를 명시한다 — licks↔profiles 관계가 둘이라(author_id 직접 FK,
// 그리고 likes 정션 테이블 경유 many-to-many) 수식어 없이 쓰면 PostgREST가 PGRST201(300)로 거부한다.
const LICK_COLS =
  'id, title, blob, author_id, canonical_id, tags, created_at, profiles!licks_author_id_fkey(public_id, display_name)';

export interface FeedFilter {
  authorId?: string | undefined;
  tag?: string | undefined;
}

/** keyset 커서 무한 스크롤 (설계 §8.5). authorId는 유저 페이지/내 릭, tag는 태그 피드. */
export async function fetchFeedPage(
  cursor: string | null,
  filter: FeedFilter = {},
): Promise<LickRow[]> {
  let q = supabase
    .from('licks')
    .select(LICK_COLS)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) q = q.lt('created_at', cursor);
  if (filter.authorId) q = q.eq('author_id', filter.authorId);
  if (filter.tag) q = q.contains('tags', [filter.tag]);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as LickRow[];
}

/** 필터에 맞는 릭 총 개수 — 행 없이 카운트만 (태그 피드 헤더용) */
export async function countLicks(filter: FeedFilter = {}): Promise<number> {
  let q = supabase.from('licks').select('id', { count: 'exact', head: true });
  if (filter.authorId) q = q.eq('author_id', filter.authorId);
  if (filter.tag) q = q.contains('tags', [filter.tag]);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchLick(id: string): Promise<LickRow | null> {
  const { data } = await supabase.from('licks').select(LICK_COLS).eq('id', id).maybeSingle();
  return data as unknown as LickRow | null;
}

export type PublishResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate' | 'error'; message?: string };

/** 게시 흐름 (설계 §10): 원본 탐색 → canonical_id 지정 insert → 23505는 본인 재게시 */
export async function publishLick(
  title: string,
  blob: string,
  melodyHash: string,
  tags: readonly string[],
): Promise<PublishResult> {
  const { data: canonical, error: lookupError } = await supabase
    .from('licks')
    .select('id')
    .eq('melody_hash', melodyHash)
    .is('canonical_id', null)
    .maybeSingle();
  if (lookupError) return { ok: false, reason: 'error', message: lookupError.message };
  const { data, error } = await supabase
    .from('licks')
    .insert({ title, blob, melody_hash: melodyHash, canonical_id: canonical?.id ?? null, tags })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' };
    return { ok: false, reason: 'error', message: error.message };
  }
  return { ok: true, id: data.id };
}

export async function deleteLick(id: string): Promise<void> {
  // 원본이면 DB trigger가 승계를 처리 (설계 §9)
  const { error } = await supabase.from('licks').delete().eq('id', id);
  if (error) throw error;
}

export interface RankingRow {
  id: string;
  title: string;
  blob: string;
  tags: string[];
  created_at: string;
  author_public_id: string;
  author_name: string;
  avatar_url: string | null;
  like_count: number;
}

/** 랭킹은 offset 방식 (설계 §8.5) — append 시 appendDeduped 필수 */
export async function fetchRankingPage(offset: number): Promise<RankingRow[]> {
  const { data, error } = await supabase
    .from('ranking')
    .select('*')
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as RankingRow[];
}
