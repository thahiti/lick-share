/**
 * 가로 피아노 건반 (설계 §6.3). 흰건반은 폭을 균등 분할, 검은건반은
 * 인접 흰건반 경계에 겹쳐 배치한다. 건반 폭은 컨테이너의 2배 —
 * 휠/트랙패드 스크롤로 탐색하고, 첫 마운트에 중앙(C4 부근)으로 위치시킨다.
 * 건반 위 터치는 항상 연주 — 네이티브 제스처(선택·팬)는 차단하고,
 * 이동 경로의 건반을 글리산도로 발음한다 (useGlissando).
 * 노트 입력은 레코딩으로만 — 평소에는 홀드 프리뷰(onPreviewDown/Up),
 * 레코딩 중(recording)에는 down/up으로 누른 길이를 캡처하고
 * pointercancel(시스템 인터럽트)은 커밋 없이 버린다 (piano-recording-design §3.3).
 * 재생 눌림 애니메이션은 범위 제외(설계 §2).
 */
import { useEffect, useRef, type JSX } from 'react';
import { BLACK_PC, PMAX, PMIN, pName } from '../../../../core/constants';
import type { Midi } from '../../../../core/types';
import { useGlissando } from '../../../hooks/useGlissando';
import { useSuppressNativeGestures } from '../../../hooks/useSuppressNativeGestures';

export interface PianoKeysProps {
  /** 비레코딩 — 건반 홀드 프리뷰 (누르는 동안 지속 발음, 노트 삽입 없음) */
  readonly onPreviewDown: (p: Midi) => void;
  readonly onPreviewUp: (p: Midi) => void;
  /** 레코딩 중 — true면 프리뷰 대신 down/up으로 연주 캡처 */
  readonly recording?: boolean;
  readonly onRecKeyDown?: (p: Midi) => void;
  readonly onRecKeyUp?: (p: Midi) => void;
  /** pointercancel — 시스템 인터럽트로 취소된 누름 (커밋 없음) */
  readonly onRecKeyAbort?: (p: Midi) => void;
}

const isWhite = (p: number): boolean => !BLACK_PC.has(p % 12);

export const PianoKeys = ({
  onPreviewDown,
  onPreviewUp,
  recording = false,
  onRecKeyDown,
  onRecKeyUp,
  onRecKeyAbort,
}: PianoKeysProps): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 건반 위 터치는 항상 연주 — 선택·스크롤 등 네이티브 제스처 차단 (iPadOS) */
  useSuppressNativeGestures(scrollRef);

  /* 누름·이동·뗌을 글리산도로 추적해 모드별 콜백에 배선 */
  useGlissando(
    scrollRef,
    recording
      ? {
          onDown: (p): void => onRecKeyDown?.(p),
          onUp: (p): void => onRecKeyUp?.(p),
          onAbort: (p): void => onRecKeyAbort?.(p),
        }
      : { onDown: onPreviewDown, onUp: onPreviewUp },
  );

  /* 첫 마운트에 스크롤을 중앙(C4 부근)으로 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const whites: number[] = [];
  const blacks: number[] = [];
  for (let p = PMIN; p <= PMAX; p++) (isWhite(p) ? whites : blacks).push(p);

  const nWhite = whites.length;
  const whitePct = 100 / nWhite;

  return (
    <div className={`pk${recording ? ' recording' : ''}`} role="group" aria-label="Piano keyboard">
      <div className="pk-scroll" ref={scrollRef}>
        <div className="pk-keys">
          {whites.map((p) => (
            <button type="button" key={p} data-key={p} className="pk-white" aria-label={pName(p)}>
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
                style={{ left: `${left}%`, width: `${whitePct * 0.66}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
