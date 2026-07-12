import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import { asMidi, asStep, type Note, type Song } from '../../../core/types';
import { Steppers } from './Steppers';

afterEach(cleanup);

const note = (id: number, s: number, d: number, p: number): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

const song = (notes: Note[], over: Partial<Song> = {}): Song => ({
  ...demoSong,
  notes,
  chords: {},
  ...over,
});

const noop = { onStepPitch: vi.fn(), onStepPos: vi.fn(), onStepLen: vi.fn() };

describe('Steppers (SPEC §3.7)', () => {
  test('선택 없음 → 3종 모두 비활성(dis) + 라벨 —', () => {
    const { container } = render(<Steppers song={demoSong} sel={null} {...noop} />);
    expect(container.querySelectorAll('.stepper.dis')).toHaveLength(3);
    expect(container.querySelector('[data-cur="pitch"]')?.textContent).toBe('—');
  });

  test('음높이: 현재/이웃 라벨, 경계에서 방향 버튼 비활성', () => {
    const mid = render(<Steppers song={song([note(1, 0, 4, 64)])} sel={1} {...noop} />);
    expect(mid.container.querySelector('[data-cur="pitch"]')?.textContent).toBe('미 E4');
    expect(mid.container.querySelector('[data-dir="pitch-up"]')?.textContent).toContain('파4');
    expect(mid.container.querySelector('[data-dir="pitch-down"]')?.textContent).toContain('레♯4');

    const top = render(<Steppers song={song([note(1, 0, 4, 84)])} sel={1} {...noop} />);
    const up = top.container.querySelector('[data-dir="pitch-up"]');
    expect(up?.hasAttribute('disabled')).toBe(true);
    expect(up?.textContent).toContain('—');
  });

  test('위치 라벨: "마디 1 1.1" / pickup 곡은 "못갖춘 3.1"', () => {
    const normal = render(<Steppers song={song([note(1, 0, 4, 64)])} sel={1} {...noop} />);
    expect(normal.container.querySelector('[data-cur="pos"]')?.textContent).toBe('마디 1 1.1');

    const pk = render(
      <Steppers song={song([note(1, 0, 4, 64)], { pickup: 8 })} sel={1} {...noop} />,
    );
    expect(pk.container.querySelector('[data-cur="pos"]')?.textContent).toBe('못갖춘 3.1');
  });

  test('위치: s=0에서 앞으로 비활성, 끝에서 뒤로 비활성', () => {
    const first = render(<Steppers song={song([note(1, 0, 4, 64)], { meas: 1 })} sel={1} {...noop} />);
    expect(first.container.querySelector('[data-dir="pos-prev"]')?.hasAttribute('disabled')).toBe(true);
    const last = render(<Steppers song={song([note(1, 12, 4, 64)], { meas: 1 })} sel={1} {...noop} />);
    expect(last.container.querySelector('[data-dir="pos-next"]')?.hasAttribute('disabled')).toBe(true);
  });

  test('길이: 현재/이웃 단계명, 최대에서 다음 비활성', () => {
    const mid = render(<Steppers song={song([note(1, 0, 4, 64)])} sel={1} {...noop} />);
    expect(mid.container.querySelector('[data-cur="len"]')?.textContent).toBe('4분');
    expect(mid.container.querySelector('[data-dir="len-prev"]')?.textContent).toContain('점8분');
    expect(mid.container.querySelector('[data-dir="len-next"]')?.textContent).toContain('점4분');

    const whole = render(<Steppers song={song([note(1, 0, 16, 64)], { meas: 1 })} sel={1} {...noop} />);
    expect(whole.container.querySelector('[data-dir="len-next"]')?.hasAttribute('disabled')).toBe(true);
  });

  test('버튼 클릭 → 콜백 방향 전달', () => {
    const onStepPitch = vi.fn();
    const onStepPos = vi.fn();
    const onStepLen = vi.fn();
    const { container } = render(
      <Steppers
        song={song([note(1, 4, 4, 64)])}
        sel={1}
        onStepPitch={onStepPitch}
        onStepPos={onStepPos}
        onStepLen={onStepLen}
      />,
    );
    const click = (sel: string): void => {
      const el = container.querySelector(sel);
      if (!el) throw new Error(`${sel} 없음`);
      fireEvent.click(el);
    };
    click('[data-dir="pitch-up"]');
    expect(onStepPitch).toHaveBeenCalledWith(1);
    click('[data-dir="pos-prev"]');
    expect(onStepPos).toHaveBeenCalledWith(-1);
    click('[data-dir="len-next"]');
    expect(onStepLen).toHaveBeenCalledWith(1);
  });
});
