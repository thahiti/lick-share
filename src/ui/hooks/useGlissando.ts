/**
 * 글리산도 포인터 추적 — 컨테이너 안 [data-key] 건반들 위에서 pointerdown 후
 * 이동 경로의 건반이 바뀔 때마다 up(이전)+down(새) 콜백을 발화한다.
 * 터치 포인터는 pointerdown 대상에 암묵 캡처되어 이후 이벤트가 그 요소로
 * 리타게팅되므로, 이동 중 건반 판정은 좌표 기반 elementFromPoint로 한다
 * (흰/검 건반 겹침도 z-index 히트테스트로 자연히 해결).
 * 건반 밖으로 나가면 up, 다시 들어오면 down — 실제 피아노에서 손을 떼었다
 * 다시 누르는 것과 동일. 멀티터치는 pointerId별로 독립 추적한다.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { asMidi, type Midi } from '../../core/types';

export interface GlissandoCallbacks {
  readonly onDown: (p: Midi) => void;
  readonly onUp: (p: Midi) => void;
  /** pointercancel(시스템 인터럽트) — 생략 시 onUp */
  readonly onAbort?: (p: Midi) => void;
}

const keyOf = (el: unknown): number | null => {
  const k = el instanceof Element ? el.closest('[data-key]')?.getAttribute('data-key') : undefined;
  return k === undefined || k === null ? null : Number(k);
};

/* jsdom에는 elementFromPoint가 없다 — 없으면 건반 밖으로 판정 */
const keyAtPoint = (x: number, y: number): number | null =>
  typeof document.elementFromPoint === 'function' ? keyOf(document.elementFromPoint(x, y)) : null;

export const useGlissando = (ref: RefObject<HTMLElement | null>, cbs: GlissandoCallbacks): void => {
  /* 콜백은 렌더마다 새 객체 — 리스너 재등록 없이 최신만 참조 */
  const cbRef = useRef(cbs);
  useEffect(() => {
    cbRef.current = cbs;
  }, [cbs]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* pointerId → 현재 누르는 건반 (null=건반 밖으로 나간 상태) */
    const active = new Map<number, number | null>();

    const down = (e: PointerEvent): void => {
      const p = keyOf(e.target);
      if (p === null) return;
      active.set(e.pointerId, p);
      cbRef.current.onDown(asMidi(p));
    };

    const move = (e: PointerEvent): void => {
      const prev = active.get(e.pointerId);
      if (prev === undefined) return;
      const next = keyAtPoint(e.clientX, e.clientY);
      if (next === prev) return;
      active.set(e.pointerId, next);
      if (prev !== null) cbRef.current.onUp(asMidi(prev));
      if (next !== null) cbRef.current.onDown(asMidi(next));
    };

    const lift =
      (fin: (p: Midi) => void) =>
      (e: PointerEvent): void => {
        const p = active.get(e.pointerId);
        if (p === undefined) return;
        active.delete(e.pointerId);
        if (p !== null) fin(asMidi(p));
      };

    const up = lift((p) => cbRef.current.onUp(p));
    const cancel = lift((p) => (cbRef.current.onAbort ?? cbRef.current.onUp)(p));

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return (): void => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [ref]);
};
