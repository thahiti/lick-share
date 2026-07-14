import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { PAGE_SIZE, deleteLick, fetchFeedPage, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { DeleteLickDialog } from '../components/DeleteLickDialog';
import { LickCard } from '../components/LickCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Ranking } from './Ranking';

interface Props {
  readonly user?: User | null;
  readonly player?: Player;
  readonly authorId?: string;
  readonly deletable?: boolean;
}

interface ListProps {
  readonly authorId: string | undefined;
  readonly deletable: boolean | undefined;
}

/** 한 authorId에 대한 목록 인스턴스 — authorId 전환은 바깥 Feed의 key 리마운트가 처리한다. */
const FeedList = ({ authorId, deletable }: ListProps): JSX.Element => {
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

  const loadMore = useCallback(async (): Promise<boolean> => {
    try {
      const page = await fetchFeedPage(cursor.current, authorId);
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
  }, [authorId]);

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
 * 이후 페이지는 sentinel의 IntersectionObserver로 로드한다 (authorId를 주면 유저 페이지/내 릭 재사용).
 * authorId가 바뀌면 key 리마운트로 커서·목록·카운트를 전부 초기화하고 새 작성자의 첫 페이지부터 로드한다.
 */
export const Feed = ({ player, authorId, deletable }: Props): JSX.Element => {
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  // 정렬 pill은 홈 피드(authorId 없음)에만. Popular는 기존 ranking 데이터 정렬을 재사용한다.
  if (authorId !== undefined)
    return <FeedList key={authorId} authorId={authorId} deletable={deletable} />;

  return (
    <>
      <div className="c-sort" role="tablist" aria-label="Sort">
        <button
          type="button"
          role="tab"
          aria-selected={sort === 'latest'}
          className={sort === 'latest' ? 'active' : ''}
          onClick={() => setSort('latest')}
        >
          Latest
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sort === 'popular'}
          className={sort === 'popular' ? 'active' : ''}
          onClick={() => setSort('popular')}
        >
          Popular
        </button>
      </div>
      {sort === 'popular' && player ? (
        <Ranking player={player} />
      ) : (
        <FeedList key="" authorId={undefined} deletable={deletable} />
      )}
    </>
  );
};
