/**
 * 커뮤니티 네비게이션 단일 정의처 (unified-nav-share 설계).
 * 모든 메뉴 렌더러(AppBar·Sidebar·TabBar)는 이 모델만 읽는다 — 장치 간 메뉴 동일성 보장.
 */
import type { IconName } from '../ui/components/common/Icon';
import type { Route } from './routing';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  readonly match: Route['name'];
  /** true면 로그인 시에만 노출 */
  readonly auth?: true;
}

/** 순서 = 모바일 탭바 순서. 데스크톱 Sidebar는 'edit' 항목을 제외하고 사용한다. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Latest', icon: 'fire', match: 'feed' },
  { to: '/edit', label: 'Create', icon: 'plus', match: 'edit' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy', match: 'ranking' },
  { to: '/me', label: 'My licks', icon: 'folder', match: 'me', auth: true },
];

/** 로그인 여부에 따른 노출 목록 — 필터 규칙도 이 모듈 한 곳에만 */
export const visibleItems = (signedIn: boolean): readonly NavItem[] =>
  NAV_ITEMS.filter((n) => n.auth !== true || signedIn);
