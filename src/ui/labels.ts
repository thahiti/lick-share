/**
 * 선택 노트 표시 라벨 (Steppers·DAW 인스펙터 공용).
 */
import { LEN_NAME } from '../core/constants';
import { measLabel, measOf, measStart } from '../core/geometry';
import type { Note, Song } from '../core/types';

/** 위치 라벨: "<마디> <박>.<16분>" */
export const posLabel = (song: Song, n: Note | null): string => {
  if (!n) return '—';
  const pm = measOf(song, n.s);
  const rel = n.s - measStart(song, pm);
  const beat = Math.floor(rel / 4) + (song.pickup && pm === 0 ? 3 : 1);
  return `${measLabel(song, pm)} ${beat}.${(rel % 4) + 1}`;
};

/** 길이 라벨: 음표 이름 또는 "N×16분" */
export const lenLabel = (n: Note | null): string =>
  n ? (LEN_NAME[n.d] ?? `${n.d}×16분`) : '—';
