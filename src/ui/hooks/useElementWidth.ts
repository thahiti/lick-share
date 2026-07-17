/**
 * 요소의 표시폭 추적 — ResizeObserver 기반. 아직 측정 전(0)이면 fallback.
 * 악보 조판은 컨테이너 실측 폭으로 계산해야 svg viewBox 스케일이 1:1이 된다.
 * 콜백 ref 방식 — 데이터 로딩 후 늦게 마운트되는 요소도 붙는 즉시 측정된다.
 */
import { useCallback, useRef, useState } from 'react';

export const useElementWidth = (
  fallback: number,
): readonly [(el: HTMLElement | null) => void, number] => {
  const [w, setW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null): void => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const update = (): void => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    roRef.current = ro;
  }, []);
  return [ref, w || fallback];
};
