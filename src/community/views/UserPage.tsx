import type { JSX } from 'react';
import type { Player } from '../../adapters/player';

interface Props {
  readonly publicId: string;
  readonly player: Player;
}

export const UserPage = (_props: Props): JSX.Element => <p className="c-state">사용자 — 준비 중</p>;
