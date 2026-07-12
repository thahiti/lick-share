import { supabase } from '../supabase';

type CanonicalRef = { id: string; canonical_id: string | null };

/** 좋아요는 항상 원본 id로 기록 (설계 §7) */
export const likeTargetId = (l: CanonicalRef): string => l.canonical_id ?? l.id;

/** 목록에서 좋아요 카운트를 조회할 원본 id 집합 (설계 §8.2) */
export const canonicalIds = (ls: readonly CanonicalRef[]): string[] => [
  ...new Set(ls.map(likeTargetId)),
];

export const toCountMap = (rows: readonly { lick_id: string }[]): Map<string, number> =>
  rows.reduce((m, r) => m.set(r.lick_id, (m.get(r.lick_id) ?? 0) + 1), new Map<string, number>());

/** 랭킹 offset 스크롤의 순위 드리프트 중복 제거 (설계 §8.5) */
export const appendDeduped = <T extends { id: string }>(
  cur: readonly T[],
  next: readonly T[],
): T[] => {
  const seen = new Set(cur.map((x) => x.id));
  return [...cur, ...next.filter((x) => !seen.has(x.id))];
};

export async function fetchLikeCounts(ids: readonly string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('likes').select('lick_id').in('lick_id', [...ids]);
  return toCountMap(data ?? []);
}

export async function fetchMyLikedSet(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('likes').select('lick_id').eq('user_id', userId);
  return new Set((data ?? []).map((r) => r.lick_id));
}

export async function addLike(target: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ lick_id: target });
  if (error && error.code !== '23505') throw error; // 중복 클릭은 무해
}

export async function removeLike(target: string): Promise<void> {
  // RLS delete 정책이 본인 행만 지우도록 보장
  const { error } = await supabase.from('likes').delete().eq('lick_id', target);
  if (error) throw error;
}
