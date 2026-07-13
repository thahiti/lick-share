/**
 * 코드 행 (SPEC §3.3). 좌: 마디별 반주 순환 버튼 / 우: 박 단위 코드 슬롯 (일반 4, 못갖춘 2).
 */
import type { JSX } from 'react';
import { measLen, measStart } from '../../../core/geometry';
import type { BarIndex, Song } from '../../../core/types';

export const ACC_LAB: Readonly<Record<string, string>> = {
  pad: 'Pad',
  comp: 'Comp',
  arp: 'Arp',
  off: 'Off',
};

export interface ChordRowProps {
  readonly song: Song;
  readonly curM: BarIndex;
  /** 피커가 열린 박 (없으면 null) */
  readonly openBeat: number | null;
  readonly onSlotTap: (b: number) => void;
  readonly onCycleAcc: () => void;
}

export const ChordRow = ({ song, curM, openBeat, onSlotTap, onCycleAcc }: ChordRowProps): JSX.Element => {
  const ov = song.mAcc[curM];
  const effective = ov ?? song.accPat;
  const beats = measLen(song, curM) / 4;
  const base = measStart(song, curM) / 4;

  return (
    <div className="chord-row">
      <div className="csp">
        <button
          type="button"
          className={`cacc${effective === 'off' ? ' off' : ''}`}
          onClick={onCycleAcc}
        >
          Acc<b>{ov ? ACC_LAB[ov] : 'Default'}</b>
        </button>
      </div>
      {Array.from({ length: beats }, (_, b) => {
        const ch = song.chords[base + b];
        return (
          <button
            type="button"
            key={b}
            data-b={b}
            className={`cslot${ch ? '' : ' empty'}${openBeat === b ? ' open' : ''}`}
            onClick={() => onSlotTap(b)}
          >
            {ch ?? '＋'}
          </button>
        );
      })}
    </div>
  );
};
