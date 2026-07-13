/**
 * 데모 곡 — 프로토타입 초기값 (IMPLEMENTATION_PLAN "수용 픽스처").
 * 앱 초기 상태이자 테스트 공통 픽스처.
 */
import { asMidi, asStep, type Note, type Song } from './types';

const tuples: readonly (readonly [number, number, number])[] = [
  [0, 4, 64], [4, 2, 69], [6, 2, 67], [8, 4, 71], [12, 6, 69], [20, 4, 67], [24, 8, 64],
  [32, 4, 65], [36, 4, 69], [40, 8, 72], [48, 4, 71], [52, 4, 67], [56, 8, 64],
];

const notes: readonly Note[] = tuples.map(([s, d, p], i) => ({
  id: i + 1,
  s: asStep(s),
  d,
  p: asMidi(p),
}));

export const demoSong: Song = {
  title: 'Spring Sketch',
  tempo: 100,
  meas: 4,
  pickup: 0,
  accPat: 'pad',
  mAcc: {},
  notes,
  chords: { 0: 'C', 4: 'Am', 8: 'F', 12: 'G7' },
};
