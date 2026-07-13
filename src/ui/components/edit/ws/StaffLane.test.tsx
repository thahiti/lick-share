import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { LAYOUT } from '../../../../core/constants';
import { demoSong } from '../../../../core/demo-song';
import { measStart, total } from '../../../../core/geometry';
import { spanW, stepToX } from '../../../../core/timeline';
import { asBar, asMidi, asStep, type Song } from '../../../../core/types';
import { StaffLane } from './StaffLane';

afterEach(cleanup);

const PX = 14;

const setup = (over: Partial<Parameters<typeof StaffLane>[0]> = {}) =>
  render(<StaffLane song={demoSong} pxPerStep={PX} sel={null} {...over} />);

describe('StaffLane (공유 좌표)', () => {
  test('마디 경계 x = stepToX(measStart) (롤과 동일 좌표계)', () => {
    const { container } = setup();
    for (const m of [1, 2, 3]) {
      const line = container.querySelector(`[data-bar="${m}"]`) as SVGLineElement;
      expect(line).not.toBeNull();
      expect(Number(line.getAttribute('x1'))).toBe(stepToX(measStart(demoSong, asBar(m)), PX));
    }
  });

  test('노트 머리 x = stepToX(s) + spanW(d)/2 (블록 중앙)', () => {
    const { container } = setup();
    // id=1: s=0, d=4 → 0 + 4*14/2 = 28
    const g = container.querySelector('[data-note="1"]') as SVGGElement;
    expect(Number(g.getAttribute('data-hx'))).toBe(stepToX(0, PX) + spanW(4, PX) / 2);
  });

  test('노트 개수만큼 글리프', () => {
    const { container } = setup();
    expect(container.querySelectorAll('[data-note]')).toHaveLength(demoSong.notes.length);
  });

  test('선택 음표 표시', () => {
    const { container } = setup({ sel: 2 });
    expect(container.querySelector('[data-note="2"]')?.getAttribute('data-sel')).toBe('true');
    expect(container.querySelector('[data-note="1"]')?.getAttribute('data-sel')).toBe('false');
  });

  test('재생헤드: playheadStep 있을 때만 + x 동일 좌표', () => {
    const { container } = setup({ playheadStep: 20 });
    const ph = container.querySelector('[data-playhead]') as SVGGElement;
    expect(ph).not.toBeNull();
    expect(container.querySelector('[data-playhead] line')?.getAttribute('x1')).toBe(
      String(stepToX(20, PX)),
    );
    const { container: c2 } = setup();
    expect(c2.querySelector('[data-playhead]')).toBeNull();
  });

  test('음자리표 거터 존재', () => {
    const { container } = setup();
    expect(container.querySelector('.sl-gutter')).not.toBeNull();
  });

  test('body 폭 = total*px + 마지막 마디선', () => {
    const { container } = setup();
    const body = container.querySelector('.sl-body') as SVGSVGElement;
    expect(Number(body.getAttribute('width'))).toBe(stepToX(total(demoSong), PX));
    // 곡 끝 닫음 마디선
    const withSharp: Song = {
      ...demoSong,
      notes: [...demoSong.notes, { id: 99, s: asStep(0), d: 4, p: asMidi(66) }],
    };
    const { container: c2 } = setup({ song: withSharp });
    // ♯ 임시표 표기
    expect(c2.querySelector('[data-note="99"]')?.textContent).toContain('♯');
  });

  test('거터 폭 = GUTTER_W', () => {
    const { container } = setup();
    const gutter = container.querySelector('.sl-gutter svg') as SVGSVGElement;
    expect(Number(gutter.getAttribute('width'))).toBe(LAYOUT.GUTTER_W);
  });
});
