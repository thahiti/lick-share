import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asBar, asMidi, asStep, type Note, type Song } from '../../../core/types';
import { Score } from './Score';

const note = (id: number, s: number, d: number, p: number): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

const fiveMeas: Song = { ...demoSong, meas: 5 };

const pickupSong: Song = {
  ...demoSong,
  pickup: 8,
  notes: demoSong.notes.map((n) => ({ ...n, s: asStep(n.s + 8) })),
  chords: { 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' },
};

describe('Score: edit 모드 (SPEC §3.2)', () => {
  test('svg viewBox 높이 126 (한 줄)', () => {
    const { container } = render(<Score song={demoSong} mode="edit" curM={asBar(0)} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 384 126');
  });

  test('5마디 곡 curM=4 → 2번째 라인의 마디 4만 렌더', () => {
    const { container } = render(<Score song={fiveMeas} mode="edit" curM={asBar(4)} />);
    const hits = [...container.querySelectorAll('[data-m]')];
    expect(hits.map((el) => el.getAttribute('data-m'))).toEqual(['4']);
  });

  test('빈 마디 = 온쉼표 1개(RestGlyph), SMP 문자 미사용', () => {
    const empty: Song = { ...demoSong, meas: 1, notes: [], chords: {} };
    const { container } = render(<Score song={empty} mode="edit" curM={asBar(0)} />);
    expect(container.querySelectorAll('[data-rest]')).toHaveLength(1);
    expect(container.querySelector('[data-rest]')?.getAttribute('data-rest')).toBe('16');
    expect(/[\u{1D100}-\u{1D1FF}]/u.test(container.innerHTML)).toBe(false);
  });

  test('마디 탭 → onMeasureTap(m), 음표에는 탭 핸들러 없음', () => {
    const onTap = vi.fn();
    const { container } = render(
      <Score song={demoSong} mode="edit" curM={asBar(0)} onMeasureTap={onTap} />,
    );
    const hit = container.querySelector('[data-m="2"]');
    if (!hit) throw new Error('마디 히트영역 없음');
    fireEvent.click(hit);
    expect(onTap).toHaveBeenCalledWith(2);
    expect(container.querySelectorAll('[data-note]')).toHaveLength(0);
  });

  test('pickup 곡: 첫 줄 히트영역 5개, pickup 폭 = 0.7×일반', () => {
    const { container } = render(<Score song={pickupSong} mode="edit" curM={asBar(0)} />);
    const hits = [...container.querySelectorAll('[data-m]')];
    expect(hits).toHaveLength(5);
    const w0 = Number(hits[0]?.getAttribute('width'));
    const w1 = Number(hits[1]?.getAttribute('width'));
    expect(w0).toBeCloseTo(w1 * 0.7);
  });

  test('현재 마디 음영 + 좌우 경계선', () => {
    const { container } = render(<Score song={demoSong} mode="edit" curM={asBar(1)} />);
    expect(container.querySelector('[data-shade]')).not.toBeNull();
  });
});

describe('Score: view 모드 (SPEC §4)', () => {
  test('전체 라인 렌더: 5마디 곡 → 높이 2줄(244), 마디 히트영역 없음', () => {
    const { container } = render(<Score song={fiveMeas} mode="view" />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 384 244');
    expect(container.querySelectorAll('[data-m]')).toHaveLength(0);
  });

  test('음표 탭 → onNoteTap(id)', () => {
    const onTap = vi.fn();
    const { container } = render(<Score song={demoSong} mode="view" onNoteTap={onTap} />);
    const el = container.querySelector('[data-note="3"]');
    if (!el) throw new Error('음표 히트 없음');
    fireEvent.click(el);
    expect(onTap).toHaveBeenCalledWith(3);
  });
});

describe('Score: 덧줄 (SPEC §3.2)', () => {
  test('F3 = 하단 덧줄 3개, C6 = 상단 덧줄 2개', () => {
    const song: Song = {
      ...demoSong,
      meas: 1,
      chords: {},
      notes: [note(1, 0, 4, 53), note(2, 4, 4, 84)],
    };
    const { container } = render(<Score song={song} mode="edit" curM={asBar(0)} />);
    const ledgers = [...container.querySelectorAll('[data-ledger]')];
    const byNote = (id: string): number =>
      ledgers.filter((el) => el.getAttribute('data-ledger') === id).length;
    expect(byNote('1')).toBe(3);
    expect(byNote('2')).toBe(2);
  });

  test('마디 경계를 넘는 음: 분할 + 타이', () => {
    const song: Song = {
      ...demoSong,
      meas: 2,
      chords: {},
      notes: [note(1, 12, 8, 64)], // [12,20) — 마디 0/1에 걸침
    };
    const { container } = render(<Score song={song} mode="view" />);
    expect(container.querySelectorAll('[data-note="1"]')).toHaveLength(2); // 분할 렌더
    expect(container.querySelectorAll('[data-tie]')).toHaveLength(1);
  });
});
