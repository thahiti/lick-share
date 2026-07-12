/**
 * LocationHashStore — URL 해시 읽기/쓰기.
 * 자동 저장이 잦으므로 replaceState로 히스토리를 오염시키지 않는다.
 */
import type { HashStore } from '../ports/hash-store';

export const createLocationHashStore = (): HashStore => ({
  read: () => window.location.hash.replace(/^#/, ''),
  write(hash: string) {
    window.history.replaceState(null, '', `#${hash}`);
  },
});
