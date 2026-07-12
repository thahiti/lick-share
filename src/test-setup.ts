import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest globals가 꺼져 있으면 RTL 자동 cleanup이 등록되지 않아
// 같은 파일의 테스트 간 DOM 트리가 누적된다 — 명시적으로 등록.
afterEach(cleanup);

// jsdom에 없는 브라우저 API 목 (App의 ResizeObserver/matchMedia 사용 대비)
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom에 없는 IntersectionObserver 목 (커뮤니티 피드 무한 스크롤 useInfiniteScroll 대비)
class IntersectionObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver =
  IntersectionObserverMock as unknown as typeof IntersectionObserver;

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
