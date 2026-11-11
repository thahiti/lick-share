import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { PAGE_SIZE, countLicks, deleteLick, fetchFeedPage, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { DeleteLickDialog } from '../components/DeleteLickDialog';
import { LickCard } from '../components/LickCard';
import { PlayOverlay } from '../components/PlayOverlay';
import { feedKey, feedStore, type FeedSnapshot } from '../feed-store';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { lastNavKind } from '../routing';

interface Props {
  readonly authorId?: string;
  readonly deletable?: boolean;
  readonly tag?: string;
  readonly player: Player;
  readonly user: User | null;
}

interface ListProps {
  readonly authorId: string | undefined;
  readonly deletable: boolean | undefined;
  readonly tag: string | undefined;
  readonly player: Player;
  readonly user: User | null;
}

/** 한 (authorId, tag)에 대한 목록 인스턴스 — 필터 전환은 바깥 Feed의 key 리마운트가 처리한다. */
const FeedList = ({ authorId, deletable, tag, player, user }: ListProps): JSX.Element => {
  const key = feedKey(authorId, tag);
  // 뒤로 가기와 앞으로 가기로 돌아왔고 행이 있는 스냅샷이 있으면 복원 마운트다 (feed-cache R5).
  // 첫 렌더에 행이 있어야 하므로 이펙트가 아니라 초기값에서 꺼낸다
  const [snapshot] = useState<FeedSnapshot | undefined>(() => {
    const s = feedStore.get(key);
    return lastNavKind() === 'history' && s && s.rows.length > 0 ? s : undefined;
  });
  const [licks, setLicks] = useState<readonly LickRow[]>(snapshot?.rows ?? []);
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(snapshot?.counts ?? new Map());
  const [done, setDone] = useState(snapshot?.done ?? false);
  const [loaded, setLoaded] = useState(snapshot !== undefined);
  const [error, setError] = useState(false);
  const cursor = useRef<string | null>(snapshot?.cursor ?? null);
  // 복원 마운트는 첫 페이지를 받지 않는다
  const started = useRef(snapshot !== undefined);
  // 삭제 확인 다이얼로그 — 상세 페이지(LickDetail)와 동일한 확인 흐름
  const [pendingDelete, setPendingDelete] = useState<LickRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  // 넘기기 재생 오버레이가 열린 카드 인덱스 (swipe-play R4). 열려 있으면 다시 열지 않는다
  const [playAt, setPlayAt] = useState<number | null>(null);

  // 태그 피드 헤더의 총 개수 — 실패하면 조용히 생략 (헤더의 #tag는 유지)
  const [total, setTotal] = useState<number | null>(snapshot?.total ?? null);
  useEffect(() => {
    if (!tag || snapshot) return;
    let alive = true;
    void countLicks({ tag })
      .then((n) => {
        if (alive) setTotal(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tag, snapshot]);

  // 두 번째 scrollTo 는 카드 악보 폭이 실측으로 다시 그려져 높이가 바뀐 뒤의 보정이다 (R7, E1)
  useLayoutEffect(() => {
    if (!snapshot) return;
    window.scrollTo(0, snapshot.scrollY);
    requestAnimationFrame(() => window.scrollTo(0, snapshot.scrollY));
  }, [snapshot]);

  // 언마운트 때 되쓸 최신 상태. 렌더 중에는 ref 를 쓰지 않으므로 커밋마다 옮긴다
  const latest = useRef({ licks, counts, done, total });
  useLayoutEffect(() => {
    latest.current = { licks, counts, done, total };
  });
  // 떠나는 뷰의 레이아웃 정리는 새 뷰의 DOM 이 들어가기 전에 불려
  // 이때의 scrollY 가 떠나는 순간의 값이다 (R6, R8)
  useLayoutEffect(
    () => () => {
      const { licks: rows, counts: c, done: d, total: t } = latest.current;
      if (rows.length === 0) {
        // 첫 페이지가 실패했거나 빈 목록이면 옛 스냅샷이 뒤에 복원되지 않게 지운다
        feedStore.invalidate(key);
        return;
      }
      feedStore.set(key, {
        rows,
        counts: c,
        cursor: cursor.current,
        done: d,
        total: t,
        scrollY: Math.round(window.scrollY),
      });
    },
    [key],
  );

  // 언마운트 뒤에 끝난 페이지는 버린다. 진행 중이던 페이지는 복원 뒤 센티널이 다시 받는다 (R14)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadMore = useCallback(async (): Promise<boolean> => {
    try {
      const page = await fetchFeedPage(cursor.current, { authorId, tag });
      const c = await fetchLikeCounts(canonicalIds(page));
      if (!alive.current) return false;
      // 커서는 페이지가 화면에 반영될 때만 전진 — 카운트 조회 실패 시 재시도가 같은 페이지를 다시 받는다
      cursor.current = page.at(-1)?.created_at ?? cursor.current;
      setCounts((prev) => new Map([...prev, ...c]));
      setLicks((prev) => [...prev, ...page]);
      const hasMore = page.length === PAGE_SIZE;
      setDone(!hasMore);
      setError(false);
      return hasMore;
    } catch {
      // 사용자가 재시도 버튼을 누르거나(초기 로드) 스크롤로 다시 교차하면(페이지 로드) 재시도된다.
      setError(true);
      return true;
    }
  }, [authorId, tag]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    // StrictMode의 이중 이펙트에서도 첫 페이지 요청은 인스턴스당 정확히 1회
    if (started.current) return;
    started.current = true;
    void loadMore().finally(() => setLoaded(true));
  }, [loadMore]);

  const onConfirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await deleteLick(pendingDelete.id);
      setLicks((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      // 다른 키(Latest, 태그 피드)의 스냅샷에서도 빠지게 한다 (R10)
      feedStore.remove(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setDeleteErr('Delete failed. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="c-list">
      {tag && (
        <header className="c-tagfeed">
          <h2>{'#' + tag}</h2>
          {total !== null && <span className="c-tagcount">{total} licks</span>}
        </header>
      )}
      {licks.map((lick, i) => (
        <LickCard
          key={lick.id}
          lick={lick}
          likeCount={counts.get(likeTargetId(lick)) ?? 0}
          onDelete={deletable ? () => setPendingDelete(lick) : undefined}
          onPlay={() => setPlayAt((cur) => cur ?? i)}
        />
      ))}
      {playAt !== null && (
        <PlayOverlay
          licks={licks}
          counts={counts}
          startIndex={Math.min(playAt, licks.length - 1)}
          hasMore={!done}
          loadError={error}
          loadMore={loadMore}
          source={tag ? '#' + tag : authorId ? (licks[0]?.profiles?.display_name ?? 'Licks') : 'Latest'}
          player={player}
          user={user}
          onClose={() => setPlayAt(null)}
          onCount={(target, count) => setCounts((prev) => new Map(prev).set(target, count))}
        />
      )}
      <DeleteLickDialog
        open={pendingDelete !== null}
        busy={deleteBusy}
        error={deleteErr}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void onConfirmDelete()}
      />
      {loaded && !done && <div ref={sentinelRef} className="c-sentinel" />}
      {error ? (
        <p className="c-state">
          Couldn't load the list{' '}
          <button type="button" className="c-btn" onClick={() => void loadMore()}>
            Retry
          </button>
        </p>
      ) : (
        <p className="c-state">{done ? (licks.length ? 'No more' : 'No licks yet') : 'Loading…'}</p>
      )}
    </div>
  );
};

/**
 * 최신 피드 (설계 §8.2, §8.5). keyset 커서 무한 스크롤 — 첫 페이지는 마운트 시 로드하고,
 * 이후 페이지는 sentinel의 IntersectionObserver로 로드한다 (authorId는 유저 페이지/내 릭,
 * tag는 태그 피드 재사용). 필터가 바뀌면 key 리마운트로 커서·목록·카운트를 전부 초기화한다.
 * 정렬 pill(Latest/Popular)은 두지 않는다 — Popular는 내비의 Ranking과 중복이었다.
 */
export const Feed = ({ authorId, deletable, tag, player, user }: Props): JSX.Element => (
  <FeedList
    key={(authorId ?? '') + '|' + (tag ?? '')}
    authorId={authorId}
    deletable={deletable}
    tag={tag}
    player={player}
    user={user}
  />
);
