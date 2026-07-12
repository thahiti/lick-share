import type { JSX } from 'react';
import type { Player } from '../../adapters/player';

interface Props {
  readonly player: Player;
}

export const Ranking = (_props: Props): JSX.Element => <p className="c-state">랭킹 — 준비 중</p>;
