import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asBar, asMidi, asStep, type Note, type Song } from '../../../core/types';
import { Pad } from './Pad';

const note = (id: number, s: number, d: number, p: number): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

const rowsOf = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-row]')].map((el) => el.getAttribute('data-row') ?? '');

describe('Pad: 동적 행 구성 (SPEC §3.5)', () => {
  test('데모 곡(온음계만): 29행, ♯행 없음', () => {
    const { container } = render(<Pad song={demoSong} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    const rows = rowsOf(container);
    expect(rows).toHaveLength(29);
    expect(rows.some((p) => [1, 3, 6, 8, 10].includes(+p % 12))).toBe(false);
  });

  test('현재 마디에 ♯음이 있으면 그 행만 추가 (30행), 마디 이동 시 재계산', () => {
    const song: Song = { ...demoSong, notes: [...demoSong.notes, note(99, 16, 2, 70)] };
    const m1 = render(<Pad song={song} curM={asBar(1)} sel={null} onCellTap={vi.fn()} />);
    expect(rowsOf(m1.container)).toHaveLength(30);
    expect(rowsOf(m1.container)).toContain('70');
    const m0 = render(<Pad song={song} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    expect(rowsOf(m0.container)).toHaveLength(29);
  });

  test('보이는 ♯행의 빈 칸 탭 = 입력 가능', () => {
    const song: Song = { ...demoSong, notes: [note(99, 16, 2, 70)] };
    const onTap = vi.fn();
    const { container } = render(<Pad song={song} curM={asBar(1)} sel={null} onCellTap={onTap} />);
    const cell = container.querySelector('[data-p="70"][data-st="8"]');
    if (!cell) throw new Error('♯행 셀 없음');
    fireEvent.click(cell);
    expect(onTap).toHaveBeenCalledWith(70, 8);
  });
});

describe('Pad: 셀 상태 (SPEC §3.5)', () => {
  test('켜진 셀 on, 선택 셀 sel 클래스', () => {
    const { container } = render(
      <Pad song={demoSong} curM={asBar(0)} sel={1} onCellTap={vi.fn()} />,
    );
    expect(container.querySelector('[data-p="64"][data-st="0"]')?.className).toContain('sel');
    expect(container.querySelector('[data-p="69"][data-st="4"]')?.className).toContain('on');
  });

  test('마디 경계를 넘는 음: 마지막 칸에 ⤳', () => {
    const song: Song = { ...demoSong, meas: 2, notes: [note(1, 12, 8, 64)], chords: {} };
    const { container } = render(<Pad song={song} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    expect(container.querySelector('[data-p="64"][data-st="15"]')?.textContent).toContain('⤳');
  });

  test('pickup 마디: 경계 표시는 8스텝 기준 (SPEC 우선)', () => {
    const song: Song = {
      ...demoSong,
      pickup: 8,
      meas: 2,
      notes: [note(1, 4, 8, 64)], // pickup 마디 [4,8) + 다음 마디 [8,12)
      chords: {},
    };
    const { container } = render(<Pad song={song} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    expect(container.querySelector('[data-p="64"][data-st="7"]')?.textContent).toContain('⤳');
  });

  test('이전 마디에서 이어져 온 음: 현재 마디 첫 칸에 ⤳', () => {
    // pickup=8. 마디2=24..39. note 22..29(라) → 마디2 첫 칸(st0)이 이어짐
    const song: Song = {
      ...demoSong,
      pickup: 8,
      meas: 4,
      notes: [note(1, 22, 8, 57), note(2, 30, 4, 64)],
      chords: {},
    };
    const { container } = render(<Pad song={song} curM={asBar(2)} sel={null} onCellTap={vi.fn()} />);
    expect(container.querySelector('[data-p="57"][data-st="0"]')?.textContent).toContain('⤳');
  });

  test('쉼표 행: 음이 없는 칸만 점등, 탭 → onCellTap("rest", st)', () => {
    const song: Song = { ...demoSong, meas: 1, notes: [note(1, 0, 4, 64)], chords: {} };
    const onTap = vi.fn();
    const { container } = render(<Pad song={song} curM={asBar(0)} sel={null} onCellTap={onTap} />);
    expect(container.querySelector('[data-p="rest"][data-st="2"]')?.className).not.toContain('on');
    const lit = container.querySelector('[data-p="rest"][data-st="6"]');
    expect(lit?.className).toContain('on');
    if (!lit) throw new Error('쉼표 셀 없음');
    fireEvent.click(lit);
    expect(onTap).toHaveBeenCalledWith('rest', 6);
  });
});

describe('Pad: 박 헤더 (SPEC §3.5)', () => {
  test('일반 마디: 1 2 3 4, 16열', () => {
    const { container } = render(<Pad song={demoSong} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    const heads = [...container.querySelectorAll('[data-beat]')].map((el) => el.textContent);
    expect(heads).toEqual(['1', '2', '3', '4']);
  });

  test('못갖춘마디: 3 4, 8열', () => {
    const song: Song = { ...demoSong, pickup: 8, notes: [], chords: {} };
    const { container } = render(<Pad song={song} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />);
    const heads = [...container.querySelectorAll('[data-beat]')].map((el) => el.textContent);
    expect(heads).toEqual(['3', '4']);
    expect(container.querySelectorAll('[data-p="rest"]')).toHaveLength(8);
  });
});

describe('Pad: 스크롤 관리 (SPEC §3.5)', () => {
  const scroller = (container: HTMLElement): HTMLElement => {
    const el = container.querySelector('[data-testid="pad-scroll"]');
    if (!(el instanceof HTMLElement)) throw new Error('스크롤 영역 없음');
    return el;
  };

  test('초기 위치: 도5(72) 부근', () => {
    const { container } = render(
      <Pad song={{ ...demoSong, notes: [], chords: {} }} curM={asBar(0)} sel={null} onCellTap={vi.fn()} />,
    );
    expect(scroller(container).scrollTop).toBe(7 * 17 - 30); // rows.indexOf(72)=7
  });

  test('선택 노트가 밖이면 가시화 (y-60)', () => {
    const song: Song = { ...demoSong, meas: 1, notes: [note(1, 0, 4, 53)], chords: {} };
    const { container } = render(<Pad song={song} curM={asBar(0)} sel={1} onCellTap={vi.fn()} />);
    // 53은 마지막 행(18): y=306, 초기 keep=0 기준 밖 → 306-60
    expect(scroller(container).scrollTop).toBe(306 - 60);
  });

  test('선택 노트가 보이면 스크롤 보존', () => {
    const song: Song = { ...demoSong, meas: 1, notes: [note(1, 0, 4, 53)], chords: {} };
    const { container, rerender } = render(
      <Pad song={song} curM={asBar(0)} sel={1} onCellTap={vi.fn()} />,
    );
    scroller(container).scrollTop = 290; // y=306 가시 범위(290~429)
    rerender(<Pad song={{ ...song }} curM={asBar(0)} sel={1} onCellTap={vi.fn()} />);
    expect(scroller(container).scrollTop).toBe(290);
  });
});
