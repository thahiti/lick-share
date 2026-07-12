/**
 * MemoryHashStore — 해시를 메모리에만 보관 (테스트용).
 */
import type { HashStore } from '../../ports/hash-store';

export const createMemoryHashStore = (initial = ''): HashStore => {
  let hash = initial;
  return {
    read: () => hash,
    write(next: string) {
      hash = next;
    },
  };
};
