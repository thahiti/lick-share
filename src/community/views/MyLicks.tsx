/** 내 릭 (설계 §8.4) — 로그인한 사용자의 피드(Feed 재사용, 삭제 가능). */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { Feed } from './Feed';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

export const MyLicks = ({ user }: Props): JSX.Element =>
  user ? <Feed authorId={user.id} deletable /> : <p className="c-state">로그인이 필요해요</p>;
