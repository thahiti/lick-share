import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function signInWithGoogle(): Promise<unknown> {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 반환값은 구독 해제 함수 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
