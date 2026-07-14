import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, visibleItems } from './nav-items';

describe('nav-items', () => {
  it('메뉴 집합·순서: Latest → Create → Ranking → My licks', () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(['Latest', 'Create', 'Ranking', 'My licks']);
    expect(NAV_ITEMS.map((n) => n.to)).toEqual(['/', '/edit', '/ranking', '/me']);
  });

  it('비로그인이면 auth 항목(My licks)이 빠진다', () => {
    expect(visibleItems(false).map((n) => n.label)).toEqual(['Latest', 'Create', 'Ranking']);
    expect(visibleItems(true)).toEqual(NAV_ITEMS);
  });
});
