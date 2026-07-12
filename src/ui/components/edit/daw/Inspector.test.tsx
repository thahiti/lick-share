import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { asBar } from '../../../../core/types';
import { Inspector } from './Inspector';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof Inspector>[0]> = {}) => {
  const h = {
    onStepPitch: vi.fn(),
    onStepPos: vi.fn(),
    onStepLen: vi.fn(),
    onAccSelect: vi.fn(),
    onCycleAcc: vi.fn(),
  };
  const utils = render(
    <Inspector song={demoSong} sel={null} curM={asBar(0)} accOn={true} {...h} {...over} />,
  );
  return { ...utils, ...h };
};

describe('Inspector (DAW)', () => {
  test('선택 없음: — 표시 + 버튼 비활성', () => {
    const { container } = setup();
    expect(container.querySelector('[data-cur="pitch"]')?.textContent).toBe('—');
    expect(
      (container.querySelector('[data-i="pitch-up"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('선택 시 라벨: 음높이·위치·길이', () => {
    // id=2: s=4, d=2, p=69 (라 A4, 2박 1/16, 8분)
    const { container } = setup({ sel: 2 });
    expect(container.querySelector('[data-cur="pitch"]')?.textContent).toBe('라 A4');
    expect(container.querySelector('[data-cur="pos"]')?.textContent).toContain('2.1');
    expect(container.querySelector('[data-cur="len"]')?.textContent).toBe('8분');
  });

  test('± 버튼 → 스텝 액션 디스패치', () => {
    const { container, onStepPitch, onStepLen } = setup({ sel: 2 });
    fireEvent.click(container.querySelector('[data-i="pitch-up"]') as Element);
    expect(onStepPitch).toHaveBeenCalledWith(1);
    fireEvent.click(container.querySelector('[data-i="len-prev"]') as Element);
    expect(onStepLen).toHaveBeenCalledWith(-1);
  });

  test('반주: 전역 패턴 선택 + 켜짐 표시', () => {
    const { container, onAccSelect } = setup();
    expect(container.querySelector('[data-ap="pad"]')?.className).toContain('on');
    fireEvent.click(container.querySelector('[data-ap="off"]') as Element);
    expect(onAccSelect).toHaveBeenCalledWith('off');
  });

  test('마디 반주 오버라이드 순환', () => {
    const { container, onCycleAcc } = setup();
    fireEvent.click(container.querySelector('[data-btn="macc"]') as Element);
    expect(onCycleAcc).toHaveBeenCalledOnce();
  });
});
