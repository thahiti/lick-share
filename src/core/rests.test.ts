import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { LEN_STEPS } from './constants';
import { total } from './geometry';
import { resolveOverlap } from './overlap';
import { deriveRests } from './rests';
import { asMidi, asStep, type Note } from './types';

const note = (id: number, s: number, d: number): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(64),
});

const takesOf = (rests: readonly { m: number; take: number }[], m: number): number[] =>
  rests.filter((r) => r.m === m).map((r) => r.take);

describe('deriveRests (SPEC §5.2)', () => {
  test('빈 마디 → 온쉼표 [16]', () => {
    const rests = deriveRests({ meas: 1, pickup: 0, notes: [] });
    expect(takesOf(rests, 0)).toEqual([16]);
  });

  test('구간 [4,16) → [4,8] 순', () => {
    const rests = deriveRests({ meas: 1, pickup: 0, notes: [note(1, 0, 4)] });
    expect(takesOf(rests, 0)).toEqual([4, 8]);
    expect(rests.map((r) => r.at)).toEqual([4, 8]);
  });

  test('구간 [1,4) → [1,2]', () => {
    const rests = deriveRests({
      meas: 1,
      pickup: 0,
      notes: [note(1, 0, 1), note(2, 4, 12)],
    });
    expect(takesOf(rests, 0)).toEqual([1, 2]);
  });

  test('[18,20) = 2번째 마디 내 [2,4) → [2]', () => {
    const rests = deriveRests({
      meas: 2,
      pickup: 0,
      notes: [note(1, 0, 16), note(2, 16, 2), note(3, 20, 12)],
    });
    expect(takesOf(rests, 1)).toEqual([2]);
  });

  test('pickup 마디(len 8) 전체 빈 경우 → [8]', () => {
    const rests = deriveRests({ meas: 1, pickup: 8, notes: [note(1, 8, 16)] });
    expect(takesOf(rests, 0)).toEqual([8]);
  });

  test('마디 경계를 넘는 노트는 다음 마디 점유로 계산', () => {
    // [12,20): 마디 0의 [12,16) + 마디 1의 [16,20) 점유
    const rests = deriveRests({ meas: 2, pickup: 0, notes: [note(1, 12, 8)] });
    expect(takesOf(rests, 0)).toEqual([8, 4]); // 빈 [0,12): c=0→8, c=8→4
    expect(takesOf(rests, 1)).toEqual([4, 8]); // 빈 [20,32) = 상대 [4,16): 4분+2분
  });

  test('프로퍼티: 노트 점유 + 쉼표 길이 합 = 곡 전체 스텝', () => {
    fc.assert(
      fc.property(
        fc.record({
          meas: fc.integer({ min: 1, max: 4 }),
          pickup: fc.constantFrom(0 as const, 8 as const),
          seeds: fc.array(
            fc.record({
              s: fc.nat({ max: 71 }),
              d: fc.constantFrom(...LEN_STEPS),
            }),
            { maxLength: 20 },
          ),
        }),
        ({ meas, pickup, seeds }) => {
          const spec = { meas, pickup };
          const tot = total(spec);
          let notes: Note[] = [];
          let id = 0;
          for (const seed of seeds) {
            if (seed.s >= tot) continue;
            const n = note(++id, seed.s, Math.min(seed.d, tot - seed.s));
            notes = resolveOverlap([...notes, n], n);
          }
          const occupied = notes.reduce((sum, n) => sum + n.d, 0);
          const restSum = deriveRests({ ...spec, notes }).reduce((sum, r) => sum + r.take, 0);
          expect(occupied + restSum).toBe(tot);
        },
      ),
    );
  });
});
