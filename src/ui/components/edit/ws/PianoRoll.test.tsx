import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { spanW, stepToX } from '../../../../core/timeline';
import { asMidi, asStep, type Song } from '../../../../core/types';
import { PianoRoll } from './PianoRoll';

afterEach(cleanup);

const PX = 14;

const renderRoll = (over: Partial<Parameters<typeof PianoRoll>[0]> = {}) => {
  const onCellTap = vi.fn();
  const onDragNote = vi.fn();
  const utils = render(
    <PianoRoll
      song={demoSong}
      pxPerStep={PX}
      sel={null}
      onCellTap={onCellTap}
      onDragNote={onDragNote}
      {...over}
    />,
  );
  return { ...utils, onCellTap, onDragNote };
};

const block = (c: HTMLElement, id: number): HTMLElement =>
  c.querySelector(`[data-note="${id}"]`) as HTMLElement;

describe('PianoRoll (워크스페이스, 고정 pxPerStep)', () => {
  test('노트 수만큼 블록 + 폭 = spanW(d)', () => {
    const { container } = renderRoll();
    expect(container.querySelectorAll('[data-note]')).toHaveLength(demoSong.notes.length);
    // id=1: s=0, d=4 → left 0, width spanW(4)
    const b1 = block(container, 1);
    expect(b1.style.left).toBe(`${stepToX(0, PX)}px`);
    expect(b1.style.width).toBe(`${spanW(4, PX)}px`);
  });

  test('선택 노트에 sel 클래스', () => {
    const { container } = renderRoll({ sel: 2 });
    expect(block(container, 2).className).toContain('sel');
    expect(block(container, 1).className).not.toContain('sel');
  });

  test('빈 셀 클릭 → onCellTap(m, pv, st)', () => {
    const { container, onCellTap } = renderRoll();
    const cell = container.querySelector('[data-m="1"][data-p="84"][data-st="0"]');
    expect(cell).not.toBeNull();
    fireEvent.click(cell as Element);
    expect(onCellTap).toHaveBeenCalledWith(1, 84, 0);
  });

  test('드래그 이동: pointerdown→move→up = onDragNote 1회 (단일 undo)', () => {
    const { container, onDragNote } = renderRoll();
    const b1 = block(container, 1); // s=0, d=4, p=64
    fireEvent.pointerDown(b1, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(b1, { clientX: 100 + 2 * PX, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(b1, { clientX: 100 + 2 * PX, clientY: 100, pointerId: 1 });
    expect(onDragNote).toHaveBeenCalledTimes(1);
    expect(onDragNote).toHaveBeenCalledWith(1, expect.objectContaining({ s: 2, p: 64 }));
  });

  test('드래그 리사이즈: 우측 핸들 = 길이만 커밋', () => {
    const { container, onDragNote } = renderRoll();
    const b1 = block(container, 1); // d=4
    const handle = b1.querySelector('[data-resize]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(b1, { clientX: 200 + 2 * PX, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(b1, { clientX: 200 + 2 * PX, clientY: 100, pointerId: 1 });
    expect(onDragNote).toHaveBeenCalledTimes(1);
    expect(onDragNote).toHaveBeenCalledWith(1, { d: 6 });
  });

  test('임계값 미만 이동은 클릭으로 처리 (padTap 의미론)', () => {
    const { container, onCellTap, onDragNote } = renderRoll();
    const b1 = block(container, 1); // s=0 → m=0, st=0, p=64
    fireEvent.pointerDown(b1, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(b1, { clientX: 101, clientY: 100, pointerId: 1 });
    expect(onDragNote).not.toHaveBeenCalled();
    expect(onCellTap).toHaveBeenCalledWith(0, 64, 0);
  });

  test('플레이헤드: playheadStep 있을 때만, x = stepToX', () => {
    const { container } = renderRoll({ playheadStep: 20 });
    const ph = container.querySelector('.roll-playhead') as HTMLElement;
    expect(ph).not.toBeNull();
    expect(ph.style.left).toBe(`${stepToX(20, PX)}px`);
    const { container: c2 } = renderRoll();
    expect(c2.querySelector('.roll-playhead')).toBeNull();
  });

  test('♯행은 곡에 존재할 때만', () => {
    const { container } = renderRoll();
    expect(container.querySelector('[data-row="66"]')).toBeNull();
    const withSharp: Song = {
      ...demoSong,
      notes: [...demoSong.notes, { id: 99, s: asStep(16), d: 4, p: asMidi(66) }],
    };
    const { container: c2 } = renderRoll({ song: withSharp });
    expect(c2.querySelector('[data-row="66"]')).not.toBeNull();
  });
});
