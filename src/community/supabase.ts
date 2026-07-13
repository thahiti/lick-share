import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * anon key 클라이언트. 권한은 전부 DB의 RLS가 판정한다. service_role key 사용 금지.
 *
 * env 미설정 시 임포트만으로 앱이 죽지 않도록 첫 사용 시점에 지연 생성한다 —
 * 편집기 라우트(/edit, ?mode=view)는 supabase 없이도 동작해야 한다.
 * 미설정 상태에서 실제로 사용하면 명확한 에러를 던진다.
 */
const env = (): { url: string | undefined; key: string | undefined } => ({
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
});

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = env();
  return Boolean(url && key);
};

let cached: SupabaseClient | null = null;

const init = (): SupabaseClient => {
  if (cached) return cached;
  const { url, key } = env();
  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). See .env.example and create a .env file.',
    );
  }
  cached = createClient(url, key);
  return cached;
};

/** 기존 사용처(supabase.auth / supabase.from …)를 그대로 유지하는 지연 프록시 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get: (_t, prop) => {
    const c = init();
    const v = Reflect.get(c, prop, c);
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
