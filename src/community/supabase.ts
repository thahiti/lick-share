import { createClient } from '@supabase/supabase-js';

/** anon key 클라이언트. 권한은 전부 DB의 RLS가 판정한다. service_role key 사용 금지. */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
