import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { PAGE_SIZE, deleteLick, fetchFeedPage, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { LickCard } from '../components/LickCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

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
  const cursor = useRef<string | null>(null);
  const started = useRef(false);

  const loadMore = useCallback(async (): Promise<boolean> => {
    const page = await fetchFeedPage(cursor.current, authorId);
    cursor.current = page.at(-1)?.created_at ?? cursor.current;
    const c = await fetchLikeCounts(canonicalIds(page));
    setCounts((prev) => new Map([...prev, ...c]));
    setLicks((prev) => [...prev, ...page]);
    const hasMore = page.length === PAGE_SIZE;
    setDone(!hasMore);
    return hasMore;
  }, [authorId]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    // StrictMode의 이중 이펙트에서도 첫 페이지 요청은 인스턴스당 정확히 1회
    if (started.current) return;
    started.current = true;
    void loadMore().finally(() => setLoaded(true));
  }, [loadMore]);

  const onDelete = (lick: LickRow) => async (): Promise<void> => {
    if (!window.confirm('이 릭을 삭제할까요? 원본이면 좋아요는 다음 유사릭이 승계해요.')) return;
    await deleteLick(lick.id);
    setLicks((prev) => prev.filter((x) => x.id !== lick.id));
  };

  return (
    <div className="c-list">
      {licks.map((lick) => (
        <LickCard
          key={lick.id}
          lick={lick}
          likeCount={counts.get(likeTargetId(lick)) ?? 0}
          onDelete={deletable ? onDelete(lick) : undefined}
        />
      ))}
      {loaded && !done && <div ref={sentinelRef} className="c-sentinel" />}
      <p className="c-state">
        {done ? (licks.length ? '끝이에요' : '아직 게시된 릭이 없어요') : '불러오는 중…'}
      </p>
    </div>
  );
};

/**
 * 최신 피드 (설계 §8.2, §8.5). keyset 커서 무한 스크롤 — 첫 페이지는 마운트 시 로드하고,
 * 이후 페이지는 sentinel의 IntersectionObserver로 로드한다 (authorId를 주면 유저 페이지/내 릭 재사용).
 * authorId가 바뀌면 key 리마운트로 커서·목록·카운트를 전부 초기화하고 새 작성자의 첫 페이지부터 로드한다.
 */
export const Feed = ({ authorId, deletable }: Props): JSX.Element => (
  <FeedList key={authorId ?? ''} authorId={authorId} deletable={deletable} />
);
