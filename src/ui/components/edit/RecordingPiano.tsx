/**
 * 레코딩용 2옥타브 피아노 (piano-recording-design §3.2).
 * 흰건반 15개 균등 분할 + 검은건반은 경계 위 배치 (PianoKeys와 동일 기하).
 * pointerdown/up/cancel로 누른 길이를 캡처한다. 글리산도 미지원(키별 capture).
 */
import { useState, type JSX, type PointerEvent } from 'react';
import { BLACK_PC, pName } from '../../../core/constants';
import { asMidi, type Midi, type Song } from '../../../core/types';

export interface RecordingPianoProps {
  /** 창 시작 C 피치 (36~60) */
  readonly baseC: number;
  readonly onShift: (dir: 1 | -1) => void;
  readonly onKeyDown: (p: Midi) => void;
  readonly onKeyUp: (p: Midi) => void;
}

/** 초기 창: 노트 피치 중앙값의 아래 옥타브 C. 노트 없으면 C3(48). 36~60 클램프 */
export const initialBaseC = (song: Song): number => {
  const ps = [...song.notes].map((n) => n.p).sort((a, b) => a - b);
  const med = ps[Math.floor(ps.length / 2)];
  if (med === undefined) return 48;
  return Math.max(36, Math.min(60, Math.floor(med / 12) * 12 - 12));
};

const isWhite = (p: number): boolean => !BLACK_PC.has(p % 12);

export const RecordingPiano = ({
  baseC,
  onShift,
  onKeyDown,
  onKeyUp,
}: RecordingPianoProps): JSX.Element => {
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());

  const whites: number[] = [];
  const blacks: number[] = [];
  for (let p = baseC; p <= baseC + 24; p++) (isWhite(p) ? whites : blacks).push(p);
  const wPct = 100 / whites.length;

  const down = (p: number) => (e: PointerEvent<HTMLButtonElement>): void => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom·미지원 환경 무시 */
    }
    setPressed((s) => new Set(s).add(p));
    onKeyDown(asMidi(p));
  };
  const up = (p: number) => (): void => {
    setPressed((s) => {
      if (!s.has(p)) return s;
      const n = new Set(s);
      n.delete(p);
      return n;
    });
    onKeyUp(asMidi(p));
  };

  const keyProps = (p: number) => ({
    'data-key': p,
    onPointerDown: down(p),
    onPointerUp: up(p),
    onPointerCancel: up(p),
  });

  return (
    <div className="rpiano" role="group" aria-label="Recording piano">
      <div className="rp-top">
        <button
          type="button"
          className="rp-oct"
          aria-label="Octave down"
          disabled={baseC <= 36}
          onClick={() => onShift(-1)}
        >
          ◀
        </button>
        <span className="rp-range">{`${pName(baseC)} – ${pName(baseC + 24)}`}</span>
        <button
          type="button"
          className="rp-oct"
          aria-label="Octave up"
          disabled={baseC >= 60}
          onClick={() => onShift(1)}
        >
          ▶
        </button>
      </div>
      <div className="rp-keys">
        {whites.map((p) => (
          <button
            type="button"
            key={p}
            className={`rp-white${pressed.has(p) ? ' pressed' : ''}`}
            aria-label={pName(p)}
            {...keyProps(p)}
          >
            {p % 12 === 0 && <span className="rp-lab">{pName(p)}</span>}
          </button>
        ))}
        {blacks.map((p) => {
          // 검은건반(pc 1/3/6/8/10)은 바로 아래 흰건반(p-1) 경계 위에 얹힌다
          const wi = whites.indexOf(p - 1);
          return (
            <button
              type="button"
              key={p}
              className={`rp-black${pressed.has(p) ? ' pressed' : ''}`}
              aria-label={pName(p)}
              style={{ left: `${(wi + 1) * wPct}%`, width: `${wPct * 0.62}%` }}
              {...keyProps(p)}
            />
          );
        })}
      </div>
    </div>
  );
};
