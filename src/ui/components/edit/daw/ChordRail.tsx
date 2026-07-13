/**
 * 전곡 코드 레일 (데스크톱 DAW). 마디별 박 슬롯을 피아노롤 그리드와 같은
 * 컬럼 좌표로 정렬해 마디 경계가 시각적으로 일치한다.
 */
import type { JSX } from 'react';
import { measCountAll, measLen, measStart, total } from '../../../../core/geometry';
import { asBar, type BarIndex, type Song } from '../../../../core/types';

export interface ChordRailProps {
  readonly song: Song;
  readonly curM: BarIndex;
  /** 피커가 열린 박 (curM 기준, 닫힘 = null) */
  readonly openBeat: number | null;
  readonly onSlotTap: (m: number, b: number) => void;
}

export const ChordRail = ({ song, curM, openBeat, onSlotTap }: ChordRailProps): JSX.Element => {
  const T = total(song);
  const mCount = measCountAll(song);

  return (
    <div className="chord-rail">
      <div className="rail-lead">Chord</div>
      <div
        className="rail-grid"
        style={{ gridTemplateColumns: `repeat(${T}, minmax(12px, 1fr))` }}
      >
        {Array.from({ length: mCount }, (_, m) => {
          const ms = measStart(song, asBar(m));
          const len = measLen(song, asBar(m));
          const beats = len / 4;
          const base = ms / 4;
          return (
            <div
              className={`rail-meas${m === curM ? ' cur' : ''}`}
              key={m}
              data-rm={m}
              style={{ gridColumn: `${ms + 1} / span ${len}` }}
            >
              {Array.from({ length: beats }, (_, b) => {
                const ch = song.chords[base + b];
                const open = m === curM && openBeat === b;
                return (
                  <button
                    type="button"
                    key={b}
                    data-rm-b={`${m}:${b}`}
                    className={`rslot${ch ? '' : ' empty'}${open ? ' open' : ''}`}
                    onClick={() => onSlotTap(m, b)}
                  >
                    {ch ?? '＋'}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
