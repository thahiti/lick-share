/**
 * 단선율 겹침 해소 (SPEC §5.1).
 * 변경/추가된 노트의 구간과 겹치는 다른 노트를 자르거나 제거한 새 배열을 돌려준다.
 */
import type { Note } from './types';

export const resolveOverlap = (notes: readonly Note[], ch: Note): Note[] => {
  const s = ch.s;
  const e = ch.s + ch.d;
  return notes.flatMap((n) => {
    if (n.id === ch.id) return [n];
    const ns = n.s;
    const ne = n.s + n.d;
    if (ne <= s || ns >= e) return [n];
    if (ns < s && ne > s) {
      const d = s - ns;
      return d >= 1 ? [{ ...n, d }] : [];
    }
    return [];
  });
};
