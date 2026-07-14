/**
 * 모바일 하단 탭바 (<1024px 전용, CSS가 전환) — visibleItems 단일 모델 렌더.
 * Create 탭은 원형 brand primary로 강조한다 (unified-nav-share 설계).
 */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { visibleItems } from '../nav-items';
import { navigate, type Route } from '../routing';

interface Props {
  readonly route: Route;
  readonly user: User | null;
}

export const TabBar = ({ route, user }: Props): JSX.Element => (
  <nav className="c-tabbar" aria-label="Primary">
    {visibleItems(user !== null).map((n) => {
      const active = route.name === n.match;
      const create = n.match === 'edit';
      return (
        <button
          key={n.to}
          type="button"
          className={`c-tab${active ? ' active' : ''}`}
          {...(active ? { 'aria-current': 'page' as const } : {})}
          onClick={() => navigate(n.to)}
        >
          <span className={create ? 'c-tab-ring' : 'c-tab-ic'}>
            <Icon
              name={n.icon}
              size={create ? 18 : 19}
              color={
                create
                  ? 'var(--brand-primary-text)'
                  : active
                    ? 'var(--brand-primary)'
                    : 'var(--mut2)'
              }
            />
          </span>
          {n.label}
        </button>
      );
    })}
  </nav>
);
