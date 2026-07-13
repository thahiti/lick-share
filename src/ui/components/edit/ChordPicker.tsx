/**
 * 코드 피커 (SPEC §3.4). 3단 그리드(루트/임시표/성질), 선택 즉시 적용.
 * 저장 문자열 = 루트 + (♯|♭|"") + 성질접미 (maj=빈 문자열).
 */
import { useState, type JSX } from 'react';
import { measLabel, measStart } from '../../../core/geometry';
import type { BarIndex, Song } from '../../../core/types';

const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const ACCS: readonly (readonly [string, string])[] = [
  ['♮', ''],
  ['♯', '♯'],
  ['♭', '♭'],
];
const QUALS: readonly (readonly [string, string])[] = [
  ['maj', ''],
  ['min', 'm'],
  ['7', '7'],
  ['maj7', 'maj7'],
  ['m7', 'm7'],
  ['dim', 'dim'],
  ['aug', 'aug'],
  ['sus4', 'sus4'],
];

export interface ChordPickerProps {
  readonly song: Song;
  readonly curM: BarIndex;
  readonly beat: number;
  /** 선택 즉시 적용 */
  readonly onApply: (chord: string) => void;
  readonly onClear: () => void;
  readonly onDone: () => void;
}

export const ChordPicker = ({ song, curM, beat, onApply, onClear, onDone }: ChordPickerProps): JSX.Element => {
  const [root, setRoot] = useState('C');
  const [acc, setAcc] = useState('');
  const [qual, setQual] = useState('');

  const beatDisp = song.pickup && curM === 0 ? beat + 3 : beat + 1;
  const current = song.chords[measStart(song, curM) / 4 + beat] ?? root + acc + qual;

  const apply = (r: string, a: string, q: string): void => {
    setRoot(r);
    setAcc(a);
    setQual(q);
    onApply(r + a + q);
  };

  return (
    <div className="chord-pick">
      <div className="cp-hd">
        <span>{`${measLabel(song, curM)} · beat ${beatDisp} chord`}</span>
        <b>{current || '—'}</b>
      </div>
      <div className="cp-row">
        {ROOTS.map((r) => (
          <button
            type="button"
            key={r}
            data-root={r}
            className={root === r ? 'on' : ''}
            onClick={() => apply(r, acc, qual)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="cp-row">
        {ACCS.map(([label, value]) => (
          <button
            type="button"
            key={label}
            data-acc={label}
            className={acc === value ? 'on' : ''}
            onClick={() => apply(root, value, qual)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="cp-row q">
        {QUALS.map(([label, value]) => (
          <button
            type="button"
            key={label}
            data-qual={label}
            className={qual === value ? 'on' : ''}
            onClick={() => apply(root, acc, value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="cp-ft">
        <button type="button" onClick={onClear}>
          Clear chord
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
};
