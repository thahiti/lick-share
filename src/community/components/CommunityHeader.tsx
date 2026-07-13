import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { navigate, type Route } from '../routing';

interface Props {
  readonly user: User | null;
  readonly route: Route;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

const NavLink = ({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}): JSX.Element => (
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
    <NavLink to="/" label="Lick Share" active={false} />
    <nav className="c-nav">
      <NavLink to="/" label="Latest" active={route.name === 'feed'} />
      <NavLink to="/ranking" label="Ranking" active={route.name === 'ranking'} />
      <NavLink to="/edit" label="Create" active={route.name === 'edit'} />
      <NavLink to="/publish" label="Publish" active={route.name === 'publish'} />
      {user ? (
        <>
          <NavLink to="/me" label="My licks" active={route.name === 'me'} />
          <button type="button" className="c-linkbtn" onClick={onSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="c-linkbtn" onClick={onSignIn}>
          Sign in with Google
        </button>
      )}
    </nav>
  </header>
);
