/**
 * 목록 스냅샷 저장소 (feed-cache 명세 R1, R2).
 * 라우트 전환으로 FeedList 가 언마운트돼도 행과 스크롤 위치를 남겨
 * 뒤로 가기 때 그대로 되살린다. React 와 DOM 을 쓰지 않는다.
 */
import type { LickRow } from './api/licks';

/** Feed 의 리마운트 key 와 같은 식이다 */
export const feedKey = (authorId: string | undefined, tag: string | undefined): string =>
  (authorId ?? '') + '|' + (tag ?? '');

export interface FeedSnapshot {
  readonly rows: readonly LickRow[];
  readonly counts: ReadonlyMap<string, number>;
  readonly cursor: string | null;
  readonly done: boolean;
  readonly total: number | null;
  readonly scrollY: number;
}

export interface FeedStore {
  get(key: string): FeedSnapshot | undefined;
  set(key: string, snapshot: FeedSnapshot): void;
  appendPage(
    key: string,
    rows: readonly LickRow[],
    counts: ReadonlyMap<string, number>,
    done: boolean,
  ): void;
  setCount(targetId: string, count: number): void;
  remove(lickId: string): void;
  invalidate(key: string): void;
  clear(): void;
}

// 탭마다 따로이고 새로고침이면 빈다. 키마다 하나뿐이라 크기 상한을 두지 않는다
const snapshots = new Map<string, FeedSnapshot>();

export const feedStore: FeedStore = {
  get: (key) => snapshots.get(key),
  set: (key, snapshot) => {
    snapshots.set(key, snapshot);
  },
  // 이 기능에는 부르는 곳이 없다. 다음 기능 lick-page 의 플레이어가 쓴다
  appendPage: (key, rows, counts, done) => {
    const cur = snapshots.get(key);
    if (!cur) return;
    snapshots.set(key, {
      ...cur,
      rows: [...cur.rows, ...rows],
      counts: new Map([...cur.counts, ...counts]),
      cursor: rows.at(-1)?.created_at ?? cur.cursor,
      done,
    });
  },
  setCount: (targetId, count) => {
    for (const [key, cur] of snapshots) {
      snapshots.set(key, { ...cur, counts: new Map(cur.counts).set(targetId, count) });
    }
  },
  // 커서가 뺀 행의 created_at 이어도 둔다. keyset 조건 created_at < cursor 는 그대로 성립한다
  remove: (lickId) => {
    for (const [key, cur] of snapshots) {
      snapshots.set(key, { ...cur, rows: cur.rows.filter((r) => r.id !== lickId) });
    }
  },
  invalidate: (key) => {
    snapshots.delete(key);
  },
  clear: () => {
    snapshots.clear();
  },
};
