import { supabase } from '../supabase';

export interface Profile {
  id: string;
  public_id: string;
  display_name: string;
  avatar_url: string | null;
}

const COLS = 'id, public_id, display_name, avatar_url';

export async function fetchProfileByPublicId(publicId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select(COLS).eq('public_id', publicId).maybeSingle();
  return data as Profile | null;
}

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select(COLS).eq('id', id).maybeSingle();
  return data as Profile | null;
}

export type RenameResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'error'; message?: string };

/** 본인 표시 이름 변경 — 23505(대소문자 무시 unique)는 taken. 유일성은 DB가 판정한다. */
export async function updateDisplayName(id: string, name: string): Promise<RenameResult> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', id)
    .select('id');
  if (error) {
    return error.code === '23505'
      ? { ok: false, reason: 'taken' }
      : { ok: false, reason: 'error', message: error.message };
  }
  // RLS는 남의 행을 오류 없이 걸러내 0행으로 끝난다 — 조용한 성공으로 두지 않는다
  if (!data || data.length === 0) return { ok: false, reason: 'error', message: 'Not allowed' };
  return { ok: true };
}
