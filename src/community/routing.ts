import { useEffect, useState } from 'react';

export type Route =
  | { name: 'legacyView' }
  | { name: 'feed' }
  | { name: 'edit' }
  | { name: 'ranking' }
  | { name: 'publish' }
  | { name: 'lick'; id: string }
  | { name: 'share'; id: string }
  | { name: 'user'; publicId: string }
  | { name: 'me' }
  | { name: 'tag'; tag: string }
  | { name: 'search'; query: string }
  | { name: 'notfound' };

export function parseRoute(pathname: string, search: string): Route {
  if (new URLSearchParams(search).get('mode') === 'view') return { name: 'legacyView' };
  if (pathname === '/') return { name: 'feed' };
  if (pathname === '/edit') return { name: 'edit' };
  if (pathname === '/ranking') return { name: 'ranking' };
  if (pathname === '/publish') return { name: 'publish' };
  if (pathname === '/me') return { name: 'me' };
  if (pathname === '/search')
    return { name: 'search', query: new URLSearchParams(search).get('q') ?? '' };
  const tag = /^\/tag\/([^/]+)$/.exec(pathname);
  if (tag?.[1]) return { name: 'tag', tag: decodeURIComponent(tag[1]) };
  const lick = /^\/lick\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (lick?.[1]) return { name: 'lick', id: lick[1] };
  const share = /^\/s\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (share?.[1]) return { name: 'share', id: share[1] };
  const user = /^\/user\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (user?.[1]) return { name: 'user', publicId: user[1] };
  return { name: 'notfound' };
}

/** SPA 네비게이션. hash(곡 blob)는 인자로 함께 넘길 수 있다 (예: '/edit#v1.…'). */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );
  useEffect(() => {
    const onPop = (): void =>
      setRoute(parseRoute(window.location.pathname, window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return route;
}
