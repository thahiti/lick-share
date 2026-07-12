import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { asMidi, asStep, type Song } from '../../../../core/types';
import { PianoRoll } from './PianoRoll';

afterEach(cleanup);

const renderRoll = (over: Partial<Parameters<typeof PianoRoll>[0]> = {}) => {
  const onCellTap = vi.fn();
  const utils = render(<PianoRoll song={demoSong} sel={null} onCellTap={onCellTap} {...over} />);
  return { ...utils, onCellTap };
};

describe('PianoRoll (전곡)', () => {
  test('노트 수만큼 블록 + 길이 스팬', () => {
    const { container } = renderRoll();
    const blocks = container.querySelectorAll('.roll-note');
    expect(blocks).toHaveLength(demoSong.notes.length);
    // id=1: s=0, d=4 → gridColumn "1 / span 4"
    const b1 = container.querySelector('[data-note="1"]') as HTMLElement;
    expect(b1.style.gridColumn).toBe('1 / span 4');
  });

  test('선택 노트에 sel 클래스', () => {
    const { container } = renderRoll({ sel: 2 });
    expect(container.querySelector('[data-note="2"]')?.className).toContain('sel');
    expect(container.querySelector('[data-note="1"]')?.className).not.toContain('sel');
  });

  test('빈 셀 클릭 → onCellTap(m, pv, st)', () => {
    const { container, onCellTap } = renderRoll();
    // 도6(84)은 데모 곡에 없음 → 마디 2(인덱스1)의 첫 칸 클릭
    const cell = container.querySelector('[data-m="1"][data-p="84"][data-st="0"]');
    expect(cell).not.toBeNull();
    fireEvent.click(cell as Element);
    expect(onCellTap).toHaveBeenCalledWith(1, 84, 0);
  });

  test('노트 블록 클릭 → 시작 칸으로 onCellTap', () => {
    const { container, onCellTap } = renderRoll();
    // id=8: s=32(마디 3의 0칸), p=65
    fireEvent.click(container.querySelector('[data-note="8"]') as Element);
    expect(onCellTap).toHaveBeenCalledWith(2, 65, 0);
  });

  test('플레이헤드: playheadStep 있을 때만', () => {
    const { container } = renderRoll({ playheadStep: 20 });
    expect(container.querySelector('.roll-playhead')).not.toBeNull();
    const { container: c2 } = renderRoll();
    expect(c2.querySelector('.roll-playhead')).toBeNull();
  });

  test('♯행은 곡에 존재할 때만', () => {
    const { container } = renderRoll();
    expect(container.querySelector('[data-row="66"]')).toBeNull(); // 파♯4 없음
    const withSharp: Song = {
      ...demoSong,
      notes: [...demoSong.notes, { id: 99, s: asStep(16), d: 4, p: asMidi(66) }],
    };
    const { container: c2 } = renderRoll({ song: withSharp });
    expect(c2.querySelector('[data-row="66"]')).not.toBeNull();
  });
});
