import { useCallback, useEffect, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../adapters/player';
import type { HashStore } from '../ports/hash-store';
import { App } from '../ui/components/App';
import { getSessionUser, onAuthChange, signInWithGoogle, signOut } from './api/auth';
import { AppBar } from './components/AppBar';
import { CommunityHeader } from './components/CommunityHeader';
import { Sidebar } from './components/Sidebar';
import { TopLicks } from './components/TopLicks';
import { navigate, useRoute } from './routing';
import { Feed } from './views/Feed';
import { LickDetail } from './views/LickDetail';
import { MyLicks } from './views/MyLicks';
import { NotFound } from './views/NotFound';
import { Publish } from './views/Publish';
import { Ranking } from './views/Ranking';
import { UserPage } from './views/UserPage';
import './community.css';

interface Props {
  readonly player: Player;
  readonly hashStore: HashStore;
}

export const Root = ({ player, hashStore }: Props): JSX.Element => {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void getSessionUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  const onSignIn = useCallback(() => void signInWithGoogle(), []);
  const onSignOut = useCallback(() => {
    void signOut().then(() => navigate('/'));
  }, []);

  // 편집기·레거시 열람은 기존 App을 그대로 마운트 (커뮤니티 헤더 없음)
  if (route.name === 'edit')
    return (
      <App
        player={player}
        hashStore={hashStore}
        initialMode="edit"
        onPublish={(hash) => navigate('/publish#' + hash)}
      />
    );
  if (route.name === 'legacyView')
    return <App player={player} hashStore={hashStore} initialMode="view" />;

  const view = ((): JSX.Element => {
    switch (route.name) {
      case 'feed':
        return <Feed user={user} player={player} />;
      case 'ranking':
        return <Ranking player={player} />;
      case 'publish':
        return <Publish user={user} />;
      case 'lick':
        return <LickDetail id={route.id} user={user} player={player} />;
      case 'user':
        return <UserPage publicId={route.publicId} player={player} />;
      case 'me':
        return <MyLicks user={user} player={player} />;
      default:
        return <NotFound />;
    }
  })();

  // 데스크톱(≥1024px)은 AppBar + 3컬럼 셸, 모바일(<1024px)은 CommunityHeader + 단일 컬럼.
  // 두 헤더 모두 DOM에 두고 표시 전환은 CSS 미디어쿼리가 담당한다.
  return (
    <div className="community">
      <CommunityHeader user={user} route={route} onSignIn={onSignIn} onSignOut={onSignOut} />
      <AppBar user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      <div className="community-shell">
        <Sidebar route={route} user={user} />
        <main className="c-main">{view}</main>
        <TopLicks />
      </div>
    </div>
  );
};
