/**
 * 데스크톱 좌측 사이드바 (community-layout §5) — ≥1024px에서만 표시.
 * 라우트 기반 내비 + 인기 태그 섹션(방어적 렌더). Publish 항목은 없다.
 */
import { useEffect, useState, type JSX } from 'react';
import { Icon, type IconName } from '../../ui/components/common/Icon';
import { fetchFeedPage } from '../api/licks';
import { topTags } from '../popular-tags';
import { navigate, type Route } from '../routing';

interface Props {
  readonly route: Route;
  readonly user: import('@supabase/supabase-js').User | null;
}

const NAV: readonly { to: string; label: string; icon: IconName; match: Route['name'] }[] = [
  { to: '/', label: 'Latest', icon: 'fire', match: 'feed' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy', match: 'ranking' },
  { to: '/me', label: 'My licks', icon: 'folder', match: 'me' },
];

export const Sidebar = ({ route, user }: Props): JSX.Element => {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    // 첫 피드 페이지를 재사용해 인기 태그를 집계한다 (전용 엔드포인트 없음).
    void fetchFeedPage(null)
      .then((rows) => {
        if (alive) setTags(topTags(rows, 6));
      })
      .catch(() => {
        /* 태그 집계는 실패해도 조용히 무시 — 섹션만 비워둔다 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // My licks는 로그인 사용자에게만 노출
  const items = NAV.filter((n) => n.match !== 'me' || user);

  return (
    <nav className="c-side" aria-label="Primary">
      <ul className="c-sidenav">
        {items.map((n) => (
          <li key={n.to}>
            <a
              href={n.to}
              className={route.name === n.match ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.to);
              }}
            >
              <Icon
                name={n.icon}
                size={16}
                color={route.name === n.match ? 'var(--brand-tint-text)' : 'var(--mut2)'}
              />
              {n.label}
            </a>
          </li>
        ))}
      </ul>

      {tags.length > 0 && (
        <div className="c-sidetags">
          <div className="c-sidetags-h">Tags</div>
          <ul>
            {tags.map((t) => (
              <li key={t} className="c-sidetag">
                {'#' + t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
};
