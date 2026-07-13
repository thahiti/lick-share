/**
 * 스테퍼 3종 (SPEC §3.7). 드래그 없음, 클릭 전용.
 * 선택 없으면 전체 비활성, 경계 도달 시 해당 방향 버튼 비활성.
 */
import type { JSX } from 'react';
import { LEN_NAME, LEN_STEPS, PMAX, PMIN, pName, pShort } from '../../../core/constants';
import { total } from '../../../core/geometry';
import type { Song } from '../../../core/types';
import { lenLabel, posLabel } from '../../labels';
import { Icon } from '../common/Icon';

export interface SteppersProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly onStepPitch: (dir: 1 | -1) => void;
  readonly onStepPos: (dir: 1 | -1) => void;
  readonly onStepLen: (dir: 1 | -1) => void;
}

export const Steppers = ({ song, sel, onStepPitch, onStepPos, onStepLen }: SteppersProps): JSX.Element => {
  const n = song.notes.find((x) => x.id === sel) ?? null;

  const li = n ? LEN_STEPS.indexOf(n.d) : -1;
  const lenPrev = n && li > 0 ? LEN_NAME[LEN_STEPS[li - 1] as number] : undefined;
  const lenNextStep = n && li >= 0 && li < LEN_STEPS.length - 1 ? (LEN_STEPS[li + 1] as number) : undefined;
  const lenNext =
    n && lenNextStep !== undefined && n.s + lenNextStep <= total(song)
      ? LEN_NAME[lenNextStep]
      : undefined;

  const dis = n === null;

  return (
    <div className="steppers">
      <div className={`stepper vert${dis ? ' dis' : ''}`}>
        <button
          type="button"
          data-dir="pitch-up"
          disabled={dis || n.p >= PMAX}
          onClick={() => onStepPitch(1)}
        >
          <Icon name="up" size={12} />
          <span className="lab">{n && n.p < PMAX ? pShort(n.p + 1) : '—'}</span>
        </button>
        <div className="cur" data-cur="pitch">
          {n ? pName(n.p) : '—'}
        </div>
        <button
          type="button"
          data-dir="pitch-down"
          disabled={dis || n.p <= PMIN}
          onClick={() => onStepPitch(-1)}
        >
          <span className="lab">{n && n.p > PMIN ? pShort(n.p - 1) : '—'}</span>
          <Icon name="down" size={12} />
        </button>
        <div className="cap">Pitch</div>
      </div>

      <div className="hsteppers">
        <div className={`stepper horiz${dis ? ' dis' : ''}`}>
          <button
            type="button"
            data-dir="pos-prev"
            disabled={dis || n.s - 1 < 0}
            onClick={() => onStepPos(-1)}
          >
            <Icon name="prev" size={12} />
            <span className="lab">Earlier</span>
          </button>
          <div className="cur">
            <b data-cur="pos">{posLabel(song, n)}</b>
            <span className="ccap">Position · 16th</span>
          </div>
          <button
            type="button"
            data-dir="pos-next"
            disabled={dis || n.s + 1 + n.d > total(song)}
            onClick={() => onStepPos(1)}
          >
            <span className="lab">Later</span>
            <Icon name="next" size={12} />
          </button>
        </div>

        <div className={`stepper horiz${dis ? ' dis' : ''}`}>
          <button
            type="button"
            data-dir="len-prev"
            disabled={dis || lenPrev === undefined}
            onClick={() => onStepLen(-1)}
          >
            <Icon name="prev" size={12} />
            <span className="lab">{lenPrev ?? '—'}</span>
          </button>
          <div className="cur">
            <b data-cur="len">{lenLabel(n)}</b>
            <span className="ccap">Length</span>
          </div>
          <button
            type="button"
            data-dir="len-next"
            disabled={dis || lenNext === undefined}
            onClick={() => onStepLen(1)}
          >
            <span className="lab">{lenNext ?? '—'}</span>
            <Icon name="next" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
