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
