import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';

interface Props {
  readonly user: User | null;
}

export const Publish = (_props: Props): JSX.Element => <p className="c-state">게시 — 준비 중</p>;
