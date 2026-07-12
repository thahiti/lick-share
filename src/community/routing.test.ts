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
});
