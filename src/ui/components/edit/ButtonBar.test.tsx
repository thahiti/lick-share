import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asStep, type Song } from '../../../core/types';
import { ButtonBar } from './ButtonBar';

afterEach(cleanup);

const cbs = {
  onSelectDir: vi.fn(),
  onPlayMeasure: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
};

describe('ButtonBar (SPEC §3.8)', () => {
  test('중간 노트 선택: 양쪽 모두 "선택" 라벨', () => {
    const { container } = render(<ButtonBar song={demoSong} sel={5} {...cbs} />);
    expect(container.querySelector('[data-btn="prev"]')?.textContent).toContain('선택');
    expect(container.querySelector('[data-btn="next"]')?.textContent).toContain('선택');
  });

  test('마지막 노트 선택 → ▶는 레드 ＋추가 전환', () => {
    const { container } = render(<ButtonBar song={demoSong} sel={13} {...cbs} />);
    const next = container.querySelector('[data-btn="next"]');
    expect(next?.textContent).toContain('추가');
    expect(next?.className).toContain('add');
    expect(next?.querySelector('[data-icon="plus"]')).not.toBeNull();
  });

  test('첫 노트 선택 + s>0 → ◀는 ＋추가 / s=0이면 그대로 "선택"', () => {
    const shifted: Song = {
      ...demoSong,
      notes: demoSong.notes.map((n) => ({ ...n, s: asStep(n.s + 4) })),
    };
    const canAdd = render(<ButtonBar song={shifted} sel={1} {...cbs} />);
    expect(canAdd.container.querySelector('[data-btn="prev"]')?.textContent).toContain('추가');

    const atZero = render(<ButtonBar song={demoSong} sel={1} {...cbs} />);
    expect(atZero.container.querySelector('[data-btn="prev"]')?.textContent).toContain('선택');
  });

  test('선택 없음 → ▶는 추가(빈 곡 포함), 6버튼 콜백 배선', () => {
    const onSelectDir = vi.fn();
    const onPlayMeasure = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onDelete = vi.fn();
    const { container } = render(
      <ButtonBar
        song={demoSong}
        sel={null}
        onSelectDir={onSelectDir}
        onPlayMeasure={onPlayMeasure}
        onUndo={onUndo}
        onRedo={onRedo}
        onDelete={onDelete}
      />,
    );
    const click = (name: string): void => {
      const el = container.querySelector(`[data-btn="${name}"]`);
      if (!el) throw new Error(`${name} 버튼 없음`);
      fireEvent.click(el);
    };
    click('prev');
    expect(onSelectDir).toHaveBeenCalledWith(-1);
    click('next');
    expect(onSelectDir).toHaveBeenCalledWith(1);
    click('play');
    expect(onPlayMeasure).toHaveBeenCalled();
    click('undo');
    expect(onUndo).toHaveBeenCalled();
    click('redo');
    expect(onRedo).toHaveBeenCalled();
    click('del');
    expect(onDelete).toHaveBeenCalled();
  });
});
