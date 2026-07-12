import { useEffect, useRef } from 'react';

/**
 * sentinel이 보이면 onLoadMore() 호출 (설계 §8.5). onLoadMore가 false를 반환하면 관찰 중단.
 * 반환한 ref를 목록 끝 요소에 부착한다. 동시 호출은 가드.
 */
export function useInfiniteScroll(onLoadMore: () => Promise<boolean>): (el: HTMLElement | null) => void {
  const busy = useRef(false);
  const cb = useRef(onLoadMore);
  const io = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    cb.current = onLoadMore;
  });
  useEffect(() => () => io.current?.disconnect(), []);

  return (el: HTMLElement | null): void => {
    io.current?.disconnect();
    if (!el) return;
    io.current = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting) || busy.current) return;
      busy.current = true;
      const hasMore = await cb.current();
      busy.current = false;
      if (!hasMore) io.current?.disconnect();
    });
    io.current.observe(el);
  };
}
