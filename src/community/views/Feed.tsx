import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

export const Feed = (_props: Props): JSX.Element => <p className="c-state">최신 — 준비 중</p>;
