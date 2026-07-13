/**
 * DAW 인스펙터 — 선택한 노트(음높이·위치·길이) + 반주 설정.
 * 스테퍼(SPEC §3.7)와 동일한 액션·경계 규칙을 카드형 UI로 제공한다.
 */
import type { JSX } from 'react';
import { LEN_NAME, LEN_STEPS, PMAX, PMIN, pName } from '../../../../core/constants';
import { total } from '../../../../core/geometry';
import type { AccPattern, BarIndex, Song } from '../../../../core/types';
import { lenLabel, posLabel } from '../../../labels';
import { ACC_LAB } from '../ChordRow';
import { Icon } from '../../common/Icon';

const ACC_OPTIONS: readonly (readonly [AccPattern | 'off', string])[] = [
  ['off', 'Off'],
  ['pad', 'Pad'],
  ['comp', 'Comp'],
  ['arp', 'Arp'],
];

export interface InspectorProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
  readonly accOn: boolean;
  readonly onStepPitch: (dir: 1 | -1) => void;
  readonly onStepPos: (dir: 1 | -1) => void;
  readonly onStepLen: (dir: 1 | -1) => void;
  readonly onAccSelect: (v: AccPattern | 'off') => void;
  readonly onCycleAcc: () => void;
}

interface RowProps {
  readonly label: string;
  readonly value: string;
  readonly cur: string;
  readonly prevKey: string;
  readonly nextKey: string;
  readonly prevDis: boolean;
  readonly nextDis: boolean;
  readonly onStep: (dir: 1 | -1) => void;
}

const Row = ({ label, value, cur, prevKey, nextKey, prevDis, nextDis, onStep }: RowProps): JSX.Element => (
  <div className="insp-row">
    <span className="insp-lab">{label}</span>
    <span className="insp-ctl">
      <button type="button" data-i={prevKey} disabled={prevDis} onClick={() => onStep(-1)}>
        <Icon name="prev" size={11} />
      </button>
      <b data-cur={cur}>{value}</b>
      <button type="button" data-i={nextKey} disabled={nextDis} onClick={() => onStep(1)}>
        <Icon name="next" size={11} />
      </button>
    </span>
  </div>
);

export const Inspector = ({
  song,
  sel,
  curM,
  accOn,
  onStepPitch,
  onStepPos,
  onStepLen,
  onAccSelect,
  onCycleAcc,
}: InspectorProps): JSX.Element => {
  const n = song.notes.find((x) => x.id === sel) ?? null;
  const dis = n === null;

  const li = n ? LEN_STEPS.indexOf(n.d) : -1;
  const lenNextStep = n && li >= 0 && li < LEN_STEPS.length - 1 ? (LEN_STEPS[li + 1] as number) : undefined;
  const lenIncOk =
    n !== null &&
    lenNextStep !== undefined &&
    n.s + lenNextStep <= total(song) &&
    LEN_NAME[lenNextStep] !== undefined;

  const ov = song.mAcc[curM];

  return (
    <aside className="inspector">
      <section className="insp-card">
        <h2 className="insp-hd">Selected note</h2>
        <Row
          label="Pitch"
          value={n ? pName(n.p) : '—'}
          cur="pitch"
          prevKey="pitch-down"
          nextKey="pitch-up"
          prevDis={dis || (n !== null && n.p <= PMIN)}
          nextDis={dis || (n !== null && n.p >= PMAX)}
          onStep={onStepPitch}
        />
        <Row
          label="Position"
          value={posLabel(song, n)}
          cur="pos"
          prevKey="pos-prev"
          nextKey="pos-next"
          prevDis={dis || (n !== null && n.s - 1 < 0)}
          nextDis={dis || (n !== null && n.s + 1 + n.d > total(song))}
          onStep={onStepPos}
        />
        <Row
          label="Length"
          value={lenLabel(n)}
          cur="len"
          prevKey="len-prev"
          nextKey="len-next"
          prevDis={dis || li <= 0}
          nextDis={dis || !lenIncOk}
          onStep={onStepLen}
        />
      </section>

      <section className="insp-card">
        <h2 className="insp-hd">Accompaniment</h2>
        <div className="insp-acc">
          {ACC_OPTIONS.map(([v, label]) => (
            <button
              type="button"
              key={v}
              data-ap={v}
              className={(v === 'off' ? !accOn : accOn && song.accPat === v) ? 'on' : ''}
              onClick={() => onAccSelect(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" data-btn="macc" className="insp-macc" onClick={onCycleAcc}>
          This bar <b>{ov ? ACC_LAB[ov] : 'Default'}</b>
        </button>
      </section>
    </aside>
  );
};
