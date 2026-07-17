/**
 * 가로 피아노 건반 (설계 §6.3). 흰건반은 폭을 균등 분할, 검은건반은
 * 인접 흰건반 경계에 겹쳐 배치한다. 클릭 = 현재 위치(다음 빈 박) 입력.
 * 레코딩 중(recording)에는 pointer down/up으로 누른 길이를 캡처한다
 * (piano-recording-design §3.3). 재생 눌림 애니메이션은 범위 제외(설계 §2).
 */
import type { JSX, PointerEvent } from 'react';
import { BLACK_PC, PMAX, PMIN, pName } from '../../../../core/constants';
import { asMidi, type Midi } from '../../../../core/types';

export interface PianoKeysProps {
  readonly onKeyTap: (p: Midi) => void;
  /** 레코딩 중 — true면 클릭 삽입 대신 pointer down/up 캡처 */
  readonly recording?: boolean;
  readonly onRecKeyDown?: (p: Midi) => void;
  readonly onRecKeyUp?: (p: Midi) => void;
}

const isWhite = (p: number): boolean => !BLACK_PC.has(p % 12);

export const PianoKeys = ({
  onKeyTap,
  recording = false,
  onRecKeyDown,
  onRecKeyUp,
}: PianoKeysProps): JSX.Element => {
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let p = PMIN; p <= PMAX; p++) (isWhite(p) ? whites : blacks).push(p);

  const nWhite = whites.length;
  const whitePct = 100 / nWhite;

  const handlers = (p: number) =>
    recording
      ? {
          onPointerDown: (e: PointerEvent<HTMLButtonElement>): void => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* jsdom·미지원 환경 무시 */
            }
            onRecKeyDown?.(asMidi(p));
          },
          onPointerUp: (): void => onRecKeyUp?.(asMidi(p)),
          onPointerCancel: (): void => onRecKeyUp?.(asMidi(p)),
        }
      : { onClick: (): void => onKeyTap(asMidi(p)) };

  return (
    <div className={`pk${recording ? ' recording' : ''}`} role="group" aria-label="Piano keyboard">
      <div className="pk-keys">
        {whites.map((p) => (
          <button
            type="button"
            key={p}
            data-key={p}
            className="pk-white"
            aria-label={pName(p)}
            {...handlers(p)}
          >
            {p % 12 === 0 && <span className="pk-lab">{pName(p)}</span>}
          </button>
        ))}
        {blacks.map((p) => {
          // 검은건반(pc 1/3/6/8/10)은 항상 바로 아래 흰건반(p-1) 경계 위에 얹힌다
          const wi = whites.indexOf(p - 1);
          const left = (wi + 1) * whitePct;
          return (
            <button
              type="button"
              key={p}
              data-key={p}
              className="pk-black"
              aria-label={pName(p)}
              style={{ left: `${left}%`, width: `${whitePct * 0.62}%` }}
              {...handlers(p)}
            />
          );
        })}
      </div>
    </div>
  );
};
