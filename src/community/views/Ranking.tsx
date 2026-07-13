/**
 * 랭킹 (설계 §8.1, §8.5). offset 무한 스크롤 — 순위 드리프트로 인한 중복은
 * appendDeduped로 제거한다. 원본만 노출(ranking DB view가 canonical 필터).
 * 순위 번호는 병합된 목록에서의 위치로 매긴다.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { Score } from '../../ui/components/edit/Score';
import { PAGE_SIZE, fetchRankingPage, type RankingRow } from '../api/licks';
import { appendDeduped } from '../api/likes';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { TagChips } from '../components/TagChips';
import { navigate } from '../routing';

interface Props {
  readonly player: Player;
}

export const Ranking = (_props: Props): JSX.Element => {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const offset = useRef(0);
  const started = useRef(false);

  const loadMore = useCallback(async (): Promise<boolean> => {
    try {
      const page = await fetchRankingPage(offset.current);
      offset.current += PAGE_SIZE;
      setRows((prev) => appendDeduped(prev, page));
      const hasMore = page.length === PAGE_SIZE;
      setDone(!hasMore);
      setError(false);
      return hasMore;
    } catch {
      // 사용자가 재시도 버튼을 누르거나(초기 로드) 스크롤로 다시 교차하면(페이지 로드) 재시도된다.
      setError(true);
      return true;
    }
  }, []);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    // StrictMode의 이중 이펙트에서도 첫 페이지 요청은 인스턴스당 정확히 1회 (Feed와 동일 패턴)
    if (started.current) return;
    started.current = true;
    void loadMore().finally(() => setLoaded(true));
  }, [loadMore]);

  return (
    <div className="c-list">
      {rows.map((row, i) => {
        const song = decodeSong(row.blob);
        return (
          <article key={row.id} className="c-card">
            <button type="button" className="c-cardhit" onClick={() => navigate('/lick/' + row.id)}>
              <span className="c-eyebrow">{`#${i + 1}`}</span>
              <div className="c-title">{row.title}</div>
              {song ? (
                <Score song={song} mode="view" width={420} />
              ) : (
                <p className="c-state">Couldn't read this score</p>
              )}
            </button>
            <TagChips tags={row.tags} />
            <div className="c-meta">
              <a
                href={'/user/' + row.author_public_id}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/user/' + row.author_public_id);
                }}
              >
                {row.author_name}
              </a>
              <span>♥ {row.like_count}</span>
              <span>{new Date(row.created_at).toLocaleDateString('en-US')}</span>
            </div>
          </article>
        );
      })}
      {loaded && !done && <div ref={sentinelRef} className="c-sentinel" />}
      {error ? (
        <p className="c-state">
          Couldn't load the list{' '}
          <button type="button" className="c-btn" onClick={() => void loadMore()}>
            Retry
          </button>
        </p>
      ) : (
        <p className="c-state">
          {done ? (rows.length ? 'No more' : 'No rankings yet') : 'Loading…'}
        </p>
      )}
    </div>
  );
};
