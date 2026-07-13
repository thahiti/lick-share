/**
 * 워크스페이스 속성 패널 (구 Inspector 대체, 설계 §6.4).
 * 제목·템포·박자 / 음길이 세그먼트 / 선택 노트 스테퍼 / 마디 코드 / 반주.
 * 상태·핸들러는 App이 소유하고 여기는 배치·표기만 담당한다.
 */
import { useState, type JSX } from 'react';
import { LEN_NAME, LEN_STEPS, PMAX, PMIN, pName } from '../../../../core/constants';
import { measLen, measStart, total } from '../../../../core/geometry';
import type { AccPattern, BarIndex, Song } from '../../../../core/types';
import { lenLabel, posLabel } from '../../../labels';
import { ACC_LAB } from '../ChordRow';
import { RestGlyph } from '../Score';
import { Icon } from '../../common/Icon';

const ACC_OPTIONS: readonly (readonly [AccPattern | 'off', string])[] = [
  ['off', 'Off'],
  ['pad', 'Pad'],
  ['comp', 'Comp'],
  ['arp', 'Arp'],
];

/** 음길이 세그먼트 표기 (분모 기준, 점음표는 '.') — SMP 문자 없이 컴팩트 */
const LEN_LABEL: Readonly<Record<number, string>> = {
  1: '16',
  2: '8',
  3: '8.',
  4: '4',
  6: '4.',
  8: '2',
  12: '2.',
  16: '1',
};

export interface PropertyPanelProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
  readonly accOn: boolean;
  /** 새 음 입력 기본 길이 (선택 없을 때 세그먼트 활성 표시) */
  readonly inputLen: number;
  /** 코드 피커가 열린 박 (curM 기준, 닫힘 = null) */
  readonly openBeat: number | null;
  readonly onSetTitle: (title: string) => void;
  readonly onTempoApply: (v: number) => void;
  readonly onSetLen: (len: number) => void;
  readonly onDelete: () => void;
  readonly onStepPitch: (dir: 1 | -1) => void;
  readonly onStepPos: (dir: 1 | -1) => void;
  readonly onStepLen: (dir: 1 | -1) => void;
  readonly onSlotTap: (m: number, b: number) => void;
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
  <div className="pp-row">
    <span className="pp-lab">{label}</span>
    <span className="pp-ctl">
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

export const PropertyPanel = ({
  song,
  sel,
  curM,
  accOn,
  inputLen,
  openBeat,
  onSetTitle,
  onTempoApply,
  onSetLen,
  onDelete,
  onStepPitch,
  onStepPos,
  onStepLen,
  onSlotTap,
  onAccSelect,
  onCycleAcc,
}: PropertyPanelProps): JSX.Element => {
  const [tempoInput, setTempoInput] = useState(String(song.tempo));
  const n = song.notes.find((x) => x.id === sel) ?? null;
  const dis = n === null;
  const activeLen = n ? n.d : inputLen;

  const li = n ? LEN_STEPS.indexOf(n.d) : -1;
  const lenNextStep = n && li >= 0 && li < LEN_STEPS.length - 1 ? (LEN_STEPS[li + 1] as number) : undefined;
  const lenIncOk =
    n !== null &&
    lenNextStep !== undefined &&
    n.s + lenNextStep <= total(song) &&
    LEN_NAME[lenNextStep] !== undefined;

  const beats = measLen(song, curM) / 4;
  const base = measStart(song, curM) / 4;
  const ov = song.mAcc[curM];

  return (
    <aside className="pp">
      <section className="pp-card">
        <h2 className="pp-hd">Song</h2>
        <input
          className="pp-title"
          data-prop="title"
          aria-label="Song title"
          value={song.title}
          onChange={(e) => onSetTitle(e.target.value)}
        />
        <div className="pp-grid2">
          <label className="pp-field">
            <span className="pp-lab">Tempo</span>
            <input
              type="number"
              inputMode="numeric"
              data-prop="tempo"
              aria-label="Tempo"
              min={40}
              max={240}
              value={tempoInput}
              onChange={(e) => {
                setTempoInput(e.target.value);
                onTempoApply(Number(e.target.value));
              }}
            />
          </label>
          <div className="pp-field">
            <span className="pp-lab">Time</span>
            <b className="pp-static">4/4</b>
          </div>
        </div>
      </section>

      <section className="pp-card">
        <h2 className="pp-hd">Note length</h2>
        <div className="pp-lens">
          {LEN_STEPS.map((step) => (
            <button
              type="button"
              key={step}
              data-len={step}
              className={step === activeLen ? 'on' : ''}
              aria-label={`Length ${LEN_NAME[step] ?? step}`}
              onClick={() => onSetLen(step)}
            >
              {LEN_LABEL[step] ?? step}
            </button>
          ))}
          <button
            type="button"
            data-btn="rest"
            className="pp-rest"
            disabled={dis}
            aria-label="Make rest (delete note)"
            onClick={onDelete}
          >
            <svg width={14} height={26} viewBox="0 0 14 40" aria-hidden="true">
              <RestGlyph x={7} top={4} take={4} />
            </svg>
          </button>
        </div>
      </section>

      <section className="pp-card">
        <h2 className="pp-hd">Selected note</h2>
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

      <section className="pp-card">
        <h2 className="pp-hd">Bar chords</h2>
        <div className="pp-chords">
          {Array.from({ length: beats }, (_, b) => {
            const ch = song.chords[base + b];
            return (
              <button
                type="button"
                key={b}
                data-b={b}
                className={`pp-slot${ch ? '' : ' empty'}${openBeat === b ? ' open' : ''}`}
                onClick={() => onSlotTap(curM, b)}
              >
                {ch ?? '＋'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="pp-card">
        <h2 className="pp-hd">Accompaniment</h2>
        <div className="pp-acc">
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
        <button type="button" data-btn="macc" className="pp-macc" onClick={onCycleAcc}>
          This bar <b>{ov ? ACC_LAB[ov] : 'Default'}</b>
        </button>
      </section>
    </aside>
  );
};
