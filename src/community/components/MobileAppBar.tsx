/**
 * 모바일 상단 앱 바 (<1024px 전용, CSS가 전환) — 로고 + 아바타.
 * 내비 이동은 하단 TabBar가 담당한다 (unified-nav-share 설계).
 */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { navigate } from '../routing';
import { AvatarMenu } from './AvatarMenu';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

export const MobileAppBar = ({ user, onSignIn, onSignOut }: Props): JSX.Element => (
  <header className="c-mappbar">
    <a
      className="c-brand"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate('/');
      }}
    >
      <Icon name="note" color="var(--brand-primary)" size={20} />
      <span>Lick Share</span>
    </a>
    <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
  </header>
);
