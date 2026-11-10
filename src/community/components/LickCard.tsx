/**
 * 릭 카드 (설계 §8.2). 카드 전체 탭 = 상세 이동, 음표 개별 탭 동작은 없음.
 * 삭제는 상세 페이지와 동일하게 오버플로(⋯) 메뉴로 격하 — 인라인 danger 버튼 금지.
 */
import type { JSX } from 'react';
import { decodeSong } from '../../core/codec';
import { Icon } from '../../ui/components/common/Icon';
import { Score } from '../../ui/components/edit/Score';
import { useElementWidth } from '../../ui/hooks/useElementWidth';
import type { LickRow } from '../api/licks';
import { navigate } from '../routing';
import { OverflowMenu } from './OverflowMenu';
import { TagChips } from './TagChips';

interface Props {
  readonly lick: LickRow;
  readonly likeCount: number;
  readonly onDelete?: (() => void) | undefined;
  /** 있으면 재생 버튼을 그린다 (swipe-play R3). 검색 결과는 넘기지 않는다 */
  readonly onPlay?: (() => void) | undefined;
}

export const LickCard = ({ lick, likeCount, onDelete, onPlay }: Props): JSX.Element => {
  const song = decodeSong(lick.blob);
  const profiles = lick.profiles;
  /* 미리보기 악보도 실측 폭 1:1 — 모든 화면에서 음표 크기 동일 (편집 화면 기준) */
  const [scoreBoxRef, scoreW] = useElementWidth(420);
  return (
    <article className="c-card">
      <button type="button" className="c-cardhit" onClick={() => navigate('/lick/' + lick.id)}>
        <div className="c-cardhead">
          <span className="c-title">{lick.title}</span>
          <span className="c-date">{new Date(lick.created_at).toLocaleDateString('en-US')}</span>
        </div>
        {song ? (
          <div ref={scoreBoxRef}>
            <Score song={song} mode="view" width={scoreW} />
          </div>
        ) : (
          <p className="c-state">Couldn't read this score</p>
        )}
      </button>
      {onPlay && song && (
        /* .c-cardhit 가 button 이라 그 안에 둘 수 없어 형제로 두고 악보 위에 겹친다 */
        <button
          type="button"
          className={lick.tags.length ? 'c-card-play c-card-play--tags' : 'c-card-play'}
          aria-label="Play"
          onClick={onPlay}
        >
          <Icon name="play" color="var(--brand-primary-text)" size={22} />
        </button>
      )}
      <TagChips tags={lick.tags} />
      <div className="c-meta">
        {profiles && (
          <a
            href={'/user/' + profiles.public_id}
            onClick={(e) => {
              e.preventDefault();
              navigate('/user/' + profiles.public_id);
            }}
          >
            {profiles.display_name}
          </a>
        )}
        <span>♥ {likeCount}</span>
        {lick.canonical_id && <span className="c-badge">similar</span>}
        {onDelete && <OverflowMenu isOwner onDelete={onDelete} />}
      </div>
    </article>
  );
};
