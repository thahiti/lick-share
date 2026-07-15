import { describe, expect, it } from 'vitest';
import { parseRoute } from './routing';

describe('parseRoute', () => {
  it('mode=view 쿼리는 레거시 열람 (경로 무관, 하위 호환)', () => {
    expect(parseRoute('/', '?mode=view')).toEqual({ name: 'legacyView' });
    expect(parseRoute('/', '?mode=view&x=1')).toEqual({ name: 'legacyView' });
  });

  it('경로를 라우트로 해석', () => {
    expect(parseRoute('/', '')).toEqual({ name: 'feed' });
    expect(parseRoute('/edit', '')).toEqual({ name: 'edit' });
    expect(parseRoute('/ranking', '')).toEqual({ name: 'ranking' });
    expect(parseRoute('/publish', '')).toEqual({ name: 'publish' });
    expect(parseRoute('/me', '')).toEqual({ name: 'me' });
    expect(parseRoute('/lick/kX9-3fA_2bQ', '')).toEqual({ name: 'lick', id: 'kX9-3fA_2bQ' });
    expect(parseRoute('/user/Zq81wLm4', '')).toEqual({ name: 'user', publicId: 'Zq81wLm4' });
  });

  it('모르는 경로는 notfound', () => {
    expect(parseRoute('/lick/', '')).toEqual({ name: 'notfound' });
    expect(parseRoute('/xyz', '')).toEqual({ name: 'notfound' });
  });

  it('/s/:id는 단축 공유 리다이렉트', () => {
    expect(parseRoute('/s/abc-123', '')).toEqual({ name: 'share', id: 'abc-123' });
    expect(parseRoute('/s/', '')).toEqual({ name: 'notfound' });
  });

  it('/tag/:name은 태그 피드 (URL 인코딩 복원)', () => {
    expect(parseRoute('/tag/bebop', '')).toEqual({ name: 'tag', tag: 'bebop' });
    expect(parseRoute('/tag/ii-v-i', '')).toEqual({ name: 'tag', tag: 'ii-v-i' });
    expect(parseRoute('/tag/%EB%B0%9C%EB%9D%BC%EB%93%9C', '')).toEqual({
      name: 'tag',
      tag: '발라드',
    });
    expect(parseRoute('/tag/', '')).toEqual({ name: 'notfound' });
  });

  it('/search는 q 쿼리로 검색 (없거나 비면 빈 질의)', () => {
    expect(parseRoute('/search', '?q=blues')).toEqual({ name: 'search', query: 'blues' });
    expect(parseRoute('/search', '?q=%23bebop')).toEqual({ name: 'search', query: '#bebop' });
    expect(parseRoute('/search', '')).toEqual({ name: 'search', query: '' });
    expect(parseRoute('/search', '?q=')).toEqual({ name: 'search', query: '' });
  });
});
