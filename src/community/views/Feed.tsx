import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { PAGE_SIZE, countLicks, deleteLick, fetchFeedPage, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { DeleteLickDialog } from '../components/DeleteLickDialog';
import { LickCard } from '../components/LickCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface Props {
  readonly authorId?: string;
  readonly deletable?: boolean;
  readonly tag?: string;
}

interface ListProps {
  readonly authorId: string | undefined;
  readonly deletable: boolean | undefined;
  readonly tag: string | undefined;
}

/** 한 (authorId, tag)에 대한 목록 인스턴스 — 필터 전환은 바깥 Feed의 key 리마운트가 처리한다. */
const FeedList = ({ authorId, deletable, tag }: ListProps): JSX.Element => {
  const [licks, setLicks] = useState<LickRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const cursor = useRef<string | null>(null);
  const started = useRef(false);
  // 삭제 확인 다이얼로그 — 상세 페이지(LickDetail)와 동일한 확인 흐름
  const [pendingDelete, setPendingDelete] = useState<LickRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // 태그 피드 헤더의 총 개수 — 실패하면 조용히 생략 (헤더의 #tag는 유지)
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!tag) return;
    let alive = true;
    void countLicks({ tag })
      .then((n) => {
        if (alive) setTotal(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tag]);

  const loadMore = useCallback(async (): Promise<boolean> => {
    try {
      const page = await fetchFeedPage(cursor.current, { authorId, tag });
      const c = await fetchLikeCounts(canonicalIds(page));
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
      {licks.map((lick) => (
        <LickCard
          key={lick.id}
          lick={lick}
          likeCount={counts.get(likeTargetId(lick)) ?? 0}
          onDelete={deletable ? () => setPendingDelete(lick) : undefined}
        />
      ))}
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
export const Feed = ({ authorId, deletable, tag }: Props): JSX.Element => (
  <FeedList
    key={(authorId ?? '') + '|' + (tag ?? '')}
    authorId={authorId}
    deletable={deletable}
    tag={tag}
  />
);
