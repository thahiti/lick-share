/**
 * 데스크톱 앱 바 (desktop-community-layout-design §5) — ≥1024px에서만 표시.
 * 로고 · 검색창(비활성 placeholder) · Create primary · 아바타 드롭다운.
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

export const AppBar = ({ user, onSignIn, onSignOut }: Props): JSX.Element => (
  <header className="c-appbar">
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

    <div className="c-searchwrap">
      <Icon name="search" color="var(--mut2)" size={16} />
      <input
        className="c-search"
        type="search"
        disabled
        placeholder="Search licks, songs, users"
        title="Search coming soon"
        aria-label="Search (coming soon)"
      />
    </div>

    <button type="button" className="c-create" onClick={() => navigate('/edit')}>
      <Icon name="plus" color="var(--brand-primary-text)" size={14} />
      Create
    </button>

    <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
  </header>
);
