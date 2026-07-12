import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { navigate, type Route } from '../routing';

interface Props {
  readonly user: User | null;
  readonly route: Route;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

const NavLink = ({ to, label, active }: { to: string; label: string; active: boolean }): JSX.Element => (
  <a
    href={to}
    className={active ? 'active' : ''}
    onClick={(e) => {
      e.preventDefault();
      navigate(to);
    }}
  >
    {label}
  </a>
);

export const CommunityHeader = ({ user, route, onSignIn, onSignOut }: Props): JSX.Element => (
  <header className="c-header">
    <NavLink to="/" label="ScoreLink" active={false} />
    <nav className="c-nav">
      <NavLink to="/" label="최신" active={route.name === 'feed'} />
      <NavLink to="/ranking" label="랭킹" active={route.name === 'ranking'} />
      <NavLink to="/edit" label="만들기" active={route.name === 'edit'} />
      <NavLink to="/publish" label="게시" active={route.name === 'publish'} />
      {user ? (
        <>
          <NavLink to="/me" label="내 릭" active={route.name === 'me'} />
          <button type="button" className="c-linkbtn" onClick={onSignOut}>
            로그아웃
          </button>
        </>
      ) : (
        <button type="button" className="c-linkbtn" onClick={onSignIn}>
          Google 로그인
        </button>
      )}
    </nav>
  </header>
);
