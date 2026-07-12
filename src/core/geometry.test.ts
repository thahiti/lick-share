import { describe, expect, test } from 'vitest';
import { asBar, asStep } from './types';
import {
  computeMw,
  lineOf,
  measCountAll,
  measLabel,
  measLen,
  measOf,
  measStart,
  measW,
  measX,
  posX,
  total,
} from './geometry';

/** DoD 검증용 마디 스펙 (IMPLEMENTATION_PLAN P1) */
const noPickup = { meas: 4, pickup: 0 as const };
const withPickup = { meas: 8, pickup: 8 as const };

describe('geometry: pickup=0', () => {
  test('measStart(2)=32', () => {
    expect(measStart(noPickup, asBar(2))).toBe(32);
  });
  test('measOf(31)=1', () => {
    expect(measOf(noPickup, asStep(31))).toBe(1);
  });
  test('total = meas*16', () => {
    expect(total(noPickup)).toBe(64);
  });
  test('measCountAll = meas', () => {
    expect(measCountAll(noPickup)).toBe(4);
  });
  test('measLen 항상 16', () => {
    expect(measLen(noPickup, asBar(0))).toBe(16);
    expect(measLen(noPickup, asBar(3))).toBe(16);
  });
  test('lineOf: floor(m/4)', () => {
    expect(lineOf(noPickup, asBar(3))).toBe(0);
    expect(lineOf(noPickup, asBar(4))).toBe(1);
  });
  test('measLabel: 1-기반 표기', () => {
    expect(measLabel(noPickup, asBar(0))).toBe('마디 1');
    expect(measLabel(noPickup, asBar(3))).toBe('마디 4');
  });
});

describe('geometry: pickup=8', () => {
  test('measStart(0)=0, measStart(1)=8', () => {
    expect(measStart(withPickup, asBar(0))).toBe(0);
    expect(measStart(withPickup, asBar(1))).toBe(8);
  });
  test('measLen(0)=8', () => {
    expect(measLen(withPickup, asBar(0))).toBe(8);
    expect(measLen(withPickup, asBar(1))).toBe(16);
  });
  test('measOf(7)=0, measOf(8)=1', () => {
    expect(measOf(withPickup, asStep(7))).toBe(0);
    expect(measOf(withPickup, asStep(8))).toBe(1);
  });
  test('lineOf(4)=0, lineOf(5)=1', () => {
    expect(lineOf(withPickup, asBar(4))).toBe(0);
    expect(lineOf(withPickup, asBar(5))).toBe(1);
  });
  test('measCountAll = meas+1', () => {
    expect(measCountAll(withPickup)).toBe(9);
  });
  test('total = pickup + meas*16', () => {
    expect(total(withPickup)).toBe(8 + 8 * 16);
  });
  test('measLabel: 못갖춘 / 마디 m', () => {
    expect(measLabel(withPickup, asBar(0))).toBe('못갖춘');
    expect(measLabel(withPickup, asBar(1))).toBe('마디 1');
  });
});

describe('geometry: 가로 배치 (W=384 기준)', () => {
  const W = 384;

  test('measW(pickup 마디) = 0.7 × mw', () => {
    const mw = computeMw(withPickup, W);
    expect(measW(withPickup, mw, asBar(0))).toBeCloseTo(mw * 0.7);
    expect(measW(withPickup, mw, asBar(1))).toBeCloseTo(mw);
  });

  test('posX(m, 15/16)는 모든 마디에서 우측 마디선을 넘지 않음', () => {
    for (const spec of [noPickup, withPickup]) {
      const mw = computeMw(spec, W);
      const cnt = measCountAll(spec);
      for (let m = 0; m < cnt; m++) {
        const bar = asBar(m);
        expect(posX(spec, mw, bar, 15 / 16)).toBeLessThan(
          measX(spec, mw, bar) + measW(spec, mw, bar) - 4,
        );
      }
    }
  });

  test('measX: 같은 줄에서 mw 간격, 줄 바뀌면 x0으로 복귀', () => {
    const mw = computeMw(noPickup, W);
    const x0 = measX(noPickup, mw, asBar(0));
    expect(measX(noPickup, mw, asBar(1))).toBeCloseTo(x0 + mw);
    expect(measX(noPickup, mw, asBar(4))).toBeCloseTo(x0); // 다음 줄 첫 마디
  });

  test('measX(pickup): 첫 줄만 pickup 폭만큼 밀림', () => {
    const mw = computeMw(withPickup, W);
    const x0 = measX(withPickup, mw, asBar(0));
    expect(measX(withPickup, mw, asBar(1))).toBeCloseTo(x0 + mw * 0.7);
    expect(measX(withPickup, mw, asBar(5))).toBeCloseTo(x0); // 둘째 줄 첫 마디
  });
});
