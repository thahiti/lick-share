import { supabase } from '../supabase';
import type { LickRow } from './licks';

/** ilike 패턴에서 와일드카드로 해석되는 문자를 리터럴로 이스케이프 */
export const escapeLike = (q: string): string => q.replace(/[\\%_]/g, (c) => '\\' + c);

/** 입력 해석: '#bebop' → 태그 전용 검색, 그 외 → 제목+태그 검색 */
export const parseQuery = (raw: string): { text: string; tagOnly: boolean } => {
  const trimmed = raw.trim();
  return trimmed.startsWith('#')
    ? { text: trimmed.slice(1), tagOnly: true }
    : { text: trimmed, tagOnly: false };
};

// PostgREST or() 구문의 큰따옴표 값 — 내부의 "·\만 이스케이프하면 쉼표·괄호는 안전하다
const quoteEscape = (v: string): string => v.replace(/[\\"]/g, (c) => '\\' + c);

/** 제목 부분 매칭 OR 태그 정확 일치 — PostgREST or() 필터 문자열 */
export const licksOrFilter = (text: string): string => {
  const v = quoteEscape(text);
  return `title.ilike."*${v}*",tags.cs.{"${v}"}`;
};

export interface SearchOpts {
  limit: number;
  cursor?: string | null | undefined;
}

/** 릭 검색 — licks 테이블 1회 질의. keyset 커서는 피드와 동일 패턴. */
export async function searchLicks(raw: string, opts: SearchOpts): Promise<LickRow[]> {
  const { text, tagOnly } = parseQuery(raw);
  // profiles 임베딩 FK 명시 사유는 api/licks.ts의 LICK_COLS 주석 참조
  let q = supabase
    .from('licks')
    .select(
      'id, title, blob, author_id, canonical_id, tags, created_at, profiles!licks_author_id_fkey(public_id, display_name)',
    )
    .order('created_at', { ascending: false })
    .limit(opts.limit);
  if (opts.cursor) q = q.lt('created_at', opts.cursor);
  q = tagOnly ? q.contains('tags', [text]) : q.or(licksOrFilter(text));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as LickRow[];
}

export interface ProfileHit {
  public_id: string;
  display_name: string;
  avatar_url: string | null;
}

/** 유저 검색 — display_name 부분 매칭 */
export async function searchUsers(raw: string, limit: number): Promise<ProfileHit[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('public_id, display_name, avatar_url')
    .ilike('display_name', '%' + escapeLike(raw.trim()) + '%')
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ProfileHit[];
}
