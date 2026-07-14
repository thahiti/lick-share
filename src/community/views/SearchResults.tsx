/**
 * 검색 결과 페이지 /search?q=… (tag-search 설계 §3~4).
 * Users 섹션(단발 조회) + Licks 섹션(keyset 무한 스크롤 — 피드와 동일 패턴).
 * 질의 실패는 조용히 빈 목록 처리한다.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { PAGE_SIZE, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { searchLicks, searchUsers, type ProfileHit } from '../api/search';
import { LickCard } from '../components/LickCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { navigate } from '../routing';

const USER_LIMIT = 10;

interface Props {
  readonly query: string;
}

const Results = ({ query }: Props): JSX.Element => {
  const [users, setUsers] = useState<ProfileHit[]>([]);
  const [licks, setLicks] = useState<LickRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const cursor = useRef<string | null>(null);
  const started = useRef(false);

  const loadMore = useCallback(async (): Promise<boolean> => {
    try {
      const page = await searchLicks(query, { limit: PAGE_SIZE, cursor: cursor.current });
      const c = await fetchLikeCounts(canonicalIds(page));
      cursor.current = page.at(-1)?.created_at ?? cursor.current;
      setCounts((prev) => new Map([...prev, ...c]));
      setLicks((prev) => [...prev, ...page]);
      const hasMore = page.length === PAGE_SIZE;
      setDone(!hasMore);
      return hasMore;
    } catch {
      // 조용히 빈 목록 처리 (설계 §4)
      setDone(true);
      return false;
    }
  }, [query]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void searchUsers(query, USER_LIMIT)
      .then(setUsers)
      .catch(() => {});
    void loadMore().finally(() => setLoaded(true));
  }, [loadMore, query]);

  const empty = loaded && users.length === 0 && licks.length === 0;

  return (
    <div className="c-list">
      {users.length > 0 && (
        <section className="c-results-sec">
          <h3 className="c-results-h">Users</h3>
          <ul className="c-results-users">
            {users.map((u) => {
              const to = '/user/' + u.public_id;
              return (
                <li key={u.public_id}>
                  <a
                    href={to}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(to);
                    }}
                  >
                    {u.display_name}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {licks.length > 0 && <h3 className="c-results-h">Licks</h3>}
      {licks.map((lick) => (
        <LickCard key={lick.id} lick={lick} likeCount={counts.get(likeTargetId(lick)) ?? 0} />
      ))}
      {loaded && !done && <div ref={sentinelRef} className="c-sentinel" />}
      {empty ? (
        <p className="c-state">{'No results for "' + query + '"'}</p>
      ) : (
        !loaded && <p className="c-state">Searching…</p>
      )}
    </div>
  );
};

export const SearchResults = ({ query }: Props): JSX.Element => {
  const q = query.trim();
  if (!q) return <p className="c-state">Type something to search</p>;
  // 질의가 바뀌면 key 리마운트로 커서·목록을 초기화한다 (Feed와 동일 패턴)
  return <Results key={q} query={q} />;
};
