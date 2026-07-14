/**
 * 데스크톱 앱 바 (desktop-community-layout-design §5) — ≥1024px에서만 표시.
 * 로고 · 검색창(SearchBox) · Create primary · 아바타 드롭다운.
 */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { NAV_ITEMS } from '../nav-items';
import { navigate } from '../routing';
import { AvatarMenu } from './AvatarMenu';
import { SearchBox } from './SearchBox';

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

    <SearchBox />

    {NAV_ITEMS.filter((n) => n.match === 'edit').map((n) => (
      <button key={n.to} type="button" className="c-create" onClick={() => navigate(n.to)}>
        <Icon name={n.icon} color="var(--brand-primary-text)" size={14} />
        {n.label}
      </button>
    ))}

    <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
  </header>
);
