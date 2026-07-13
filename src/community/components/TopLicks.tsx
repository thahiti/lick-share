/**
 * 우측 "Top Licks" 위젯 (community-layout §5.5) — ≥1024px에서만 표시.
 * ranking 상위 5건. 1위 숫자는 amber 강조. 로드 실패·빈 목록이면 위젯을 숨긴다.
 */
import { useEffect, useState, type JSX } from 'react';
import { Icon } from '../../ui/components/common/Icon';
import { fetchRankingPage, type RankingRow } from '../api/licks';
import { navigate } from '../routing';

export const TopLicks = (): JSX.Element | null => {
  const [rows, setRows] = useState<RankingRow[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchRankingPage(0)
      .then((r) => {
        if (alive) setRows(r.slice(0, 5));
      })
      .catch(() => {
        /* 실패 시 위젯 숨김 — rows는 빈 채로 둔다 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <aside className="c-toplicks" aria-label="Top licks">
      <div className="c-toplicks-h">
        <Icon name="trophy" color="var(--rank-accent)" size={16} />
        Top Licks
      </div>
      <ol className="c-toplicks-list">
        {rows.map((row, i) => (
          <li key={row.id}>
            <button type="button" onClick={() => navigate('/lick/' + row.id)}>
              <span className={i === 0 ? 'c-rank c-rank-1' : 'c-rank'}>{i + 1}</span>
              <span className="c-toplicks-title">{row.title}</span>
              <span className="c-toplicks-likes">♥ {row.like_count}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
};
