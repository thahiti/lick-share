/**
 * 요소의 표시폭 추적 — ResizeObserver 기반. 아직 측정 전(0)이면 fallback.
 * 악보 조판은 컨테이너 실측 폭으로 계산해야 svg viewBox 스케일이 1:1이 된다.
 */
import { useEffect, useState, type RefObject } from 'react';

export const useElementWidth = (ref: RefObject<HTMLElement | null>, fallback: number): number => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return (): void => ro.disconnect();
  }, [ref]);
  return w || fallback;
};
