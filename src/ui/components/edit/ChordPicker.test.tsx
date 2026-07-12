import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asBar, type Song } from '../../../core/types';
import { ChordPicker } from './ChordPicker';

afterEach(cleanup);

describe('ChordPicker (SPEC §3.4)', () => {
  test('헤더: "마디 1 · 2박 코드" + 현재 코드', () => {
    render(
      <ChordPicker song={demoSong} curM={asBar(0)} beat={1} onApply={vi.fn()} onClear={vi.fn()} onDone={vi.fn()} />,
    );
    expect(screen.getByText('마디 1 · 2박 코드')).toBeTruthy();
  });

  test('pickup 마디의 박 표기는 3, 4', () => {
    const song: Song = { ...demoSong, pickup: 8, chords: {} };
    render(
      <ChordPicker song={song} curM={asBar(0)} beat={0} onApply={vi.fn()} onClear={vi.fn()} onDone={vi.fn()} />,
    );
    expect(screen.getByText('못갖춘 · 3박 코드')).toBeTruthy();
  });

  test('선택 즉시 적용: 루트→임시표→성질 누적 (루트+♯♭+접미 형식)', () => {
    const onApply = vi.fn();
    const { container } = render(
      <ChordPicker song={demoSong} curM={asBar(0)} beat={1} onApply={onApply} onClear={vi.fn()} onDone={vi.fn()} />,
    );
    const click = (sel: string): void => {
      const el = container.querySelector(sel);
      if (!el) throw new Error(`${sel} 없음`);
      fireEvent.click(el);
    };
    click('[data-root="F"]');
    expect(onApply).toHaveBeenLastCalledWith('F');
    click('[data-acc="♯"]');
    expect(onApply).toHaveBeenLastCalledWith('F♯');
    click('[data-qual="m7"]');
    expect(onApply).toHaveBeenLastCalledWith('F♯m7');
    expect(onApply).toHaveBeenCalledTimes(3);
  });

  test('선택 상태 반전(on) 표시', () => {
    const { container } = render(
      <ChordPicker song={demoSong} curM={asBar(0)} beat={1} onApply={vi.fn()} onClear={vi.fn()} onDone={vi.fn()} />,
    );
    const root = container.querySelector('[data-root="D"]');
    if (!root) throw new Error('루트 버튼 없음');
    fireEvent.click(root);
    expect(root.className).toContain('on');
  });

  test('코드 지우기 → onClear, 완료 → onDone', () => {
    const onClear = vi.fn();
    const onDone = vi.fn();
    render(
      <ChordPicker song={demoSong} curM={asBar(0)} beat={1} onApply={vi.fn()} onClear={onClear} onDone={onDone} />,
    );
    fireEvent.click(screen.getByText('코드 지우기'));
    expect(onClear).toHaveBeenCalled();
    fireEvent.click(screen.getByText('완료'));
    expect(onDone).toHaveBeenCalled();
  });
});
