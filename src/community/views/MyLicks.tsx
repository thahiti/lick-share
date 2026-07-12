import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

export const MyLicks = (_props: Props): JSX.Element => <p className="c-state">내 릭 — 준비 중</p>;
