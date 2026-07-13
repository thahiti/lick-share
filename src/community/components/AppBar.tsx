/**
 * 데스크톱 앱 바 (desktop-community-layout-design §5) — ≥1024px에서만 표시.
 * 로고 · 검색창(비활성 placeholder) · Create primary · 아바타 드롭다운.
 */
import { useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { navigate } from '../routing';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

/** 표시 이름 → 이니셜 1글자 (없으면 '?') */
const initial = (user: User): string => {
  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? '';
  return name.trim().charAt(0).toUpperCase() || '?';
};

export const AppBar = ({ user, onSignIn, onSignOut }: Props): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
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

      <div className="c-avatarwrap">
        <button
          type="button"
          className="c-avatar"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {user ? initial(user) : '?'}
        </button>
        {menuOpen && (
          <div className="c-avatarmenu" role="menu">
            {user ? (
              <>
                <button type="button" role="menuitem" onClick={() => navigate('/me')}>
                  My licks
                </button>
                <button type="button" role="menuitem" onClick={onSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" onClick={onSignIn}>
                Sign in with Google
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
