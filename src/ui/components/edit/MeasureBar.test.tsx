import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asBar, type Song } from '../../../core/types';
import { MeasureBar } from './MeasureBar';

afterEach(cleanup);

const pickupSong: Song = { ...demoSong, pickup: 8 };

describe('MeasureBar (SPEC §3.6)', () => {
  test('라벨: "마디 1 / 4"', () => {
    const { container } = render(
      <MeasureBar song={demoSong} curM={asBar(0)} onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('마디 1 / 4');
  });

  test('마지막 마디: ▶ = 레드 ＋(마디 추가)', () => {
    const { container } = render(
      <MeasureBar song={demoSong} curM={asBar(3)} onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    expect(container.querySelector('[data-btn="mnext"] [data-icon="plus"]')).not.toBeNull();
  });

  test('첫 마디 + pickup 없음: ◀ = 레드 ＋(못갖춘 추가)', () => {
    const { container } = render(
      <MeasureBar song={demoSong} curM={asBar(0)} onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    expect(container.querySelector('[data-btn="mprev"] [data-icon="plus"]')).not.toBeNull();
  });

  test('pickup 존재 시 첫 마디 ◀은 흐림(dim) + prev 아이콘', () => {
    const { container } = render(
      <MeasureBar song={pickupSong} curM={asBar(0)} onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    const prev = container.querySelector('[data-btn="mprev"]');
    expect(prev?.className).toContain('dim');
    expect(prev?.querySelector('[data-icon="prev"]')).not.toBeNull();
  });

  test('중간 마디: 양쪽 내비 아이콘 + 클릭 콜백', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { container } = render(
      <MeasureBar song={demoSong} curM={asBar(1)} onPrev={onPrev} onNext={onNext} />,
    );
    const prev = container.querySelector('[data-btn="mprev"]');
    const next = container.querySelector('[data-btn="mnext"]');
    expect(prev?.querySelector('[data-icon="prev"]')).not.toBeNull();
    expect(next?.querySelector('[data-icon="next"]')).not.toBeNull();
    if (!prev || !next) throw new Error('버튼 없음');
    fireEvent.click(prev);
    fireEvent.click(next);
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });
});
