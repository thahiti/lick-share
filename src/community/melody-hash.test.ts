import { describe, expect, it } from 'vitest';
import { asMidi, asStep, type Note } from '../core/types';
import { melodyHash, melodyTokens } from './melody-hash';

const note = (s: number, d: number, p: number, id = s): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});
const base: Note[] = [note(0, 4, 64), note(4, 2, 69), note(8, 4, 67)];
const shift = (ns: Note[], dp: number): Note[] => ns.map((n) => ({ ...n, p: asMidi(n.p + dp) }));

describe('melodyTokens', () => {
  it('첫 음 기준 [상대 피치, 상대 시작, 길이] 삼중항', () => {
    expect(melodyTokens(base)).toEqual([
      [0, 0, 4],
      [5, 4, 2],
      [3, 8, 4],
    ]);
  });

  it('빈 입력은 빈 배열', () => {
    expect(melodyTokens([])).toEqual([]);
  });

  it('id·정렬 순서에 무관 (시작 스텝 기준 정규화)', () => {
    const unordered = [note(8, 4, 67, 99), note(0, 4, 64, 1), note(4, 2, 69, 2)];
    expect(melodyTokens(unordered)).toEqual(melodyTokens(base));
  });

  it('첫 음 이전 무음(전체 시작 오프셋)은 제외', () => {
    const led = base.map((n) => ({ ...n, s: asStep(n.s + 8) }));
    expect(melodyTokens(led)).toEqual(melodyTokens(base));
  });
});

describe('melodyHash', () => {
  it('64자 hex', async () => {
    expect(await melodyHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('조옮김(+5)·옥타브(+12)는 동일 해시', async () => {
    const h = await melodyHash(base);
    expect(await melodyHash(shift(base, 5))).toBe(h);
    expect(await melodyHash(shift(base, 12))).toBe(h);
  });

  it('리듬(길이)이 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 2, 64), note(4, 2, 69), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });

  it('음 사이 쉼표 위치가 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 4, 64), note(6, 2, 69), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });

  it('음높이 진행이 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 4, 64), note(4, 2, 71), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });
});
