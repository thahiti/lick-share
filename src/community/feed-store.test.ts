/** 목록 스냅샷 저장소 (feed-cache 명세 R1, R2) */
import { beforeEach, describe, expect, it } from 'vitest';
import type { LickRow } from './api/licks';
import { feedKey, feedStore, type FeedSnapshot } from './feed-store';

const row = (id: string, created_at: string): LickRow => ({
  id,
  title: 'Lick ' + id,
  blob: 'invalid-blob',
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at,
  profiles: { public_id: 'pub-1', display_name: 'Author A' },
});

const snapshot = (over: Partial<FeedSnapshot> = {}): FeedSnapshot => ({
  rows: [row('a', 'c2'), row('b', 'c1')],
  counts: new Map([['a', 1]]),
  cursor: 'c1',
  done: false,
  total: null,
  scrollY: 0,
  ...over,
});

describe('feedKey', () => {
  it('AC-1 필터가 없으면 빈 칸, 작성자와 태그는 | 양쪽에 둔다', () => {
    expect(feedKey(undefined, undefined)).toBe('|');
    expect(feedKey('u1', undefined)).toBe('u1|');
    expect(feedKey(undefined, 'jazz')).toBe('|jazz');
  });
});

describe('feedStore', () => {
  beforeEach(() => {
    feedStore.clear();
  });

  it('AC-2 set 한 스냅샷을 get 이 돌려주고, 다시 set 하면 바뀌며, 모르는 키는 undefined', () => {
    const first = snapshot({ scrollY: 100 });
    feedStore.set('|', first);
    expect(feedStore.get('|')).toBe(first);

    const second = snapshot({ scrollY: 200 });
    feedStore.set('|', second);
    expect(feedStore.get('|')).toBe(second);

    expect(feedStore.get('|jazz')).toBeUndefined();
  });

  it('AC-3 appendPage 는 행을 잇고 커서를 마지막 행으로, done 을 인자로, counts 를 합친다', () => {
    feedStore.set('|', snapshot());
    feedStore.appendPage('|', [row('z', 'c0')], new Map([['x', 3]]), true);
    const s = feedStore.get('|');
    expect(s?.rows.map((r) => r.created_at)).toEqual(['c2', 'c1', 'c0']);
    expect(s?.cursor).toBe('c0');
    expect(s?.done).toBe(true);
    expect(s?.counts.get('x')).toBe(3);
  });

  it('AC-3 행이 빈 appendPage 는 행과 커서를 두고 done 만 바꾼다', () => {
    feedStore.set('|', snapshot());
    feedStore.appendPage('|', [], new Map(), true);
    const s = feedStore.get('|');
    expect(s?.rows.map((r) => r.created_at)).toEqual(['c2', 'c1']);
    expect(s?.cursor).toBe('c1');
    expect(s?.done).toBe(true);
  });

  it('AC-3 스냅샷이 없는 키의 appendPage 는 아무것도 만들지 않는다', () => {
    feedStore.appendPage('|', [row('z', 'c0')], new Map([['x', 3]]), true);
    expect(feedStore.get('|')).toBeUndefined();
  });

  it('AC-4 setCount 는 모든 스냅샷의 counts 에 넣는다 (대상 행이 없는 스냅샷도)', () => {
    feedStore.set('|', snapshot({ rows: [row('orig-1', 'c2')], counts: new Map([['orig-1', 7]]) }));
    feedStore.set('|jazz', snapshot({ rows: [row('other', 'c2')], counts: new Map() }));
    feedStore.setCount('orig-1', 8);
    expect(feedStore.get('|')?.counts.get('orig-1')).toBe(8);
    expect(feedStore.get('|jazz')?.counts.get('orig-1')).toBe(8);
  });

  it('AC-5 remove 는 모든 스냅샷에서 행만 빼고 커서, counts, done, total, scrollY 는 둔다', () => {
    const latest = snapshot({
      rows: [row('a', 'c3'), row('sim-1', 'c2'), row('b', 'c1')],
      counts: new Map([['orig-1', 7]]),
      cursor: 'c1',
      done: false,
      total: null,
      scrollY: 1200,
    });
    // 이쪽은 sim-1 이 마지막 행이라 커서가 그 created_at 이다
    const tagged = snapshot({
      rows: [row('a', 'c3'), row('sim-1', 'c2')],
      counts: new Map([['orig-1', 7]]),
      cursor: 'c2',
      done: true,
      total: 12,
      scrollY: 300,
    });
    feedStore.set('|', latest);
    feedStore.set('|jazz', tagged);

    feedStore.remove('sim-1');

    const l = feedStore.get('|');
    expect(l?.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(l).toMatchObject({ cursor: 'c1', done: false, total: null, scrollY: 1200 });
    expect(l?.counts).toEqual(new Map([['orig-1', 7]]));

    const t = feedStore.get('|jazz');
    expect(t?.rows.map((r) => r.id)).toEqual(['a']);
    expect(t).toMatchObject({ cursor: 'c2', done: true, total: 12, scrollY: 300 });
    expect(t?.counts).toEqual(new Map([['orig-1', 7]]));
  });

  it('AC-6 invalidate 는 그 키만 지우고 clear 는 전부 지운다', () => {
    feedStore.set('a|', snapshot());
    feedStore.set('b|', snapshot());

    feedStore.invalidate('a|');
    expect(feedStore.get('a|')).toBeUndefined();
    expect(feedStore.get('b|')).toBeDefined();

    feedStore.clear();
    expect(feedStore.get('a|')).toBeUndefined();
    expect(feedStore.get('b|')).toBeUndefined();
  });
});
