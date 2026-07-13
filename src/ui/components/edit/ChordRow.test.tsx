import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asBar, type Song } from '../../../core/types';
import { ChordRow } from './ChordRow';

const pickupSong: Song = {
  ...demoSong,
  pickup: 8,
  chords: { 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' },
};

describe('ChordRow (SPEC §3.3)', () => {
  test('일반 마디: 슬롯 4개, 코드 표기/빈 슬롯 ＋', () => {
    const { container } = render(
      <ChordRow song={demoSong} curM={asBar(1)} openBeat={null} onSlotTap={vi.fn()} onCycleAcc={vi.fn()} />,
    );
    const slots = [...container.querySelectorAll('[data-b]')];
    expect(slots).toHaveLength(4);
    expect(slots[0]?.textContent).toBe('Am'); // beat key 4
    expect(slots[1]?.textContent).toBe('＋');
    expect(slots[1]?.className).toContain('empty');
  });

  test('못갖춘마디: 슬롯 2개', () => {
    const { container } = render(
      <ChordRow song={pickupSong} curM={asBar(0)} openBeat={null} onSlotTap={vi.fn()} onCycleAcc={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-b]')).toHaveLength(2);
  });

  test('열린 슬롯 반전(open), 슬롯 탭 → onSlotTap(b)', () => {
    const onSlot = vi.fn();
    const { container } = render(
      <ChordRow song={demoSong} curM={asBar(0)} openBeat={2} onSlotTap={onSlot} onCycleAcc={vi.fn()} />,
    );
    expect(container.querySelector('[data-b="2"]')?.className).toContain('open');
    const slot = container.querySelector('[data-b="1"]');
    if (!slot) throw new Error('슬롯 없음');
    fireEvent.click(slot);
    expect(onSlot).toHaveBeenCalledWith(1);
  });

  test('반주 버튼: 기본/오버라이드 라벨 + 끔 흐림, 탭 → onCycleAcc', () => {
    const onCycle = vi.fn();
    const base = render(
      <ChordRow song={demoSong} curM={asBar(0)} openBeat={null} onSlotTap={vi.fn()} onCycleAcc={onCycle} />,
    );
    expect(base.container.querySelector('.cacc')?.textContent).toBe('AccDefault');

    const withOv: Song = { ...demoSong, mAcc: { 0: 'arp' } };
    const ov = render(
      <ChordRow song={withOv} curM={asBar(0)} openBeat={null} onSlotTap={vi.fn()} onCycleAcc={onCycle} />,
    );
    expect(ov.container.querySelector('.cacc')?.textContent).toBe('AccArp');

    const offSong: Song = { ...demoSong, mAcc: { 0: 'off' } };
    const off = render(
      <ChordRow song={offSong} curM={asBar(0)} openBeat={null} onSlotTap={vi.fn()} onCycleAcc={onCycle} />,
    );
    const btn = off.container.querySelector('.cacc');
    expect(btn?.className).toContain('off');
    if (!btn) throw new Error('반주 버튼 없음');
    fireEvent.click(btn);
    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
