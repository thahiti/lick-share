/**
 * 마디 이동 바 (SPEC §3.6). 끝에서 ＋ 전환 (▶=마디 추가, ◀=못갖춘 추가).
 * 못갖춘마디가 이미 있으면 첫 마디에서 ◀ 흐림 처리.
 */
import type { JSX } from 'react';
import { measCountAll, measLabel } from '../../../core/geometry';
import type { BarIndex, Song } from '../../../core/types';
import { Icon } from '../common/Icon';

export interface MeasureBarProps {
  readonly song: Song;
  readonly curM: BarIndex;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export const MeasureBar = ({ song, curM, onPrev, onNext }: MeasureBarProps): JSX.Element => {
  const last = curM === measCountAll(song) - 1;
  const first = curM === 0;
  const prevAdds = first && !song.pickup;
  const prevDim = first && Boolean(song.pickup);

  return (
    <div className="measure-bar">
      <button
        type="button"
        data-btn="mprev"
        className={prevDim ? 'dim' : ''}
        aria-label="Previous bar"
        onClick={onPrev}
      >
        <Icon
          name={prevAdds ? 'plus' : 'prev'}
          color={prevAdds ? 'var(--red)' : 'var(--ink)'}
          size={13}
        />
      </button>
      <span data-mlabel="">{`${measLabel(song, curM)} / ${song.meas}`}</span>
      <button type="button" data-btn="mnext" aria-label="Next bar" onClick={onNext}>
        <Icon name={last ? 'plus' : 'next'} color={last ? 'var(--red)' : 'var(--ink)'} size={13} />
      </button>
    </div>
  );
};
