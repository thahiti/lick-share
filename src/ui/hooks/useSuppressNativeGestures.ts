/**
 * iPadOS Safari의 네이티브 터치 제스처(long-press 선택·확대경·콜아웃, 스크롤 팬)를
 * 원천 차단한다. CSS user-select/touch-callout만으로는 WebKit이 선택을 시작하는
 * 케이스가 남는다(webkit.org #231161 계열). touchstart의 기본 동작을 취소하는 것이
 * 유일하게 확실한 차단이며, React 합성 onTouchStart는 root에 passive로 등록되어
 * preventDefault가 무시되므로 native 리스너(passive: false)로 직접 등록한다.
 * 포인터 이벤트(onPointerDown/Up)는 영향 없이 그대로 동작한다.
 */
import { useEffect, type RefObject } from 'react';

export const useSuppressNativeGestures = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevent = (e: Event): void => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('contextmenu', prevent);
    return (): void => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('contextmenu', prevent);
    };
  }, [ref]);
};
