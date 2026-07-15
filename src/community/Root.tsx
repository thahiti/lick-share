import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../adapters/player';
import type { HashStore } from '../ports/hash-store';
import { App } from '../ui/components/App';
import { getSessionUser, onAuthChange, signInWithGoogle, signOut } from './api/auth';
import { AppBar } from './components/AppBar';
import { MobileAppBar } from './components/MobileAppBar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TopLicks } from './components/TopLicks';
import { navigate, useRoute } from './routing';
import { Feed } from './views/Feed';
import { LickDetail } from './views/LickDetail';
import { MyLicks } from './views/MyLicks';
import { NotFound } from './views/NotFound';
import { Publish } from './views/Publish';
import { Ranking } from './views/Ranking';
import { SearchResults } from './views/SearchResults';
import { ShareRedirect } from './views/ShareRedirect';
import { UserPage } from './views/UserPage';
import './community.css';

interface Props {
  readonly player: Player;
  readonly hashStore: HashStore;
}

export const Root = ({ player, hashStore }: Props): JSX.Element => {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(null);

  // 편집 ←Back의 목적지: 마지막으로 머문 커뮤니티 화면 (편집·레거시열람·게시·공유 리다이렉트는 제외)
  const lastCommunityPath = useRef('/');
  useEffect(() => {
    if (
      route.name !== 'edit' &&
      route.name !== 'legacyView' &&
      route.name !== 'publish' &&
      route.name !== 'share'
    ) {
      lastCommunityPath.current = window.location.pathname;
    }
  }, [route]);

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
        onShare={(hash) => navigate('/publish#' + hash)}
        onExit={() => navigate(lastCommunityPath.current)}
      />
    );
  if (route.name === 'legacyView')
    return <App player={player} hashStore={hashStore} initialMode="view" />;

  const view = ((): JSX.Element => {
    switch (route.name) {
      case 'feed':
        return <Feed />;
      case 'tag':
        return <Feed tag={route.tag} />;
      case 'search':
        return <SearchResults query={route.query} />;
      case 'ranking':
        return <Ranking player={player} />;
      case 'publish':
        return <Publish user={user} player={player} />;
      case 'lick':
        return <LickDetail id={route.id} user={user} player={player} />;
      case 'share':
        return <ShareRedirect id={route.id} />;
      case 'user':
        return <UserPage publicId={route.publicId} player={player} />;
      case 'me':
        return <MyLicks user={user} player={player} />;
      default:
        return <NotFound />;
    }
  })();

  // 데스크톱(≥1024px)은 AppBar + 3컬럼 셸, 모바일(<1024px)은 MobileAppBar + 하단 TabBar.
  // 두 셸 모두 DOM에 두고 표시 전환은 CSS 미디어쿼리가 담당한다.
  return (
    <div className="community">
      <AppBar user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      <MobileAppBar user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      <div className="community-shell">
        <Sidebar route={route} user={user} />
        <main className="c-main">{view}</main>
        <TopLicks />
      </div>
      <TabBar route={route} user={user} />
    </div>
  );
};
