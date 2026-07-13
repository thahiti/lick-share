import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { asBar } from '../../../../core/types';
import { PropertyPanel } from './PropertyPanel';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof PropertyPanel>[0]> = {}) => {
  const h = {
    onSetTitle: vi.fn(),
    onTempoApply: vi.fn(),
    onSetLen: vi.fn(),
    onDelete: vi.fn(),
    onStepPitch: vi.fn(),
    onStepPos: vi.fn(),
    onStepLen: vi.fn(),
    onSlotTap: vi.fn(),
    onAccSelect: vi.fn(),
    onCycleAcc: vi.fn(),
  };
  const utils = render(
    <PropertyPanel
      song={demoSong}
      sel={null}
      curM={asBar(0)}
      accOn={true}
      inputLen={4}
      openBeat={null}
      {...h}
      {...over}
    />,
  );
  return { ...utils, ...h };
};

describe('PropertyPanel', () => {
  test('제목 입력 → onSetTitle', () => {
    const { container, onSetTitle } = setup();
    const input = container.querySelector('[data-prop="title"]') as HTMLInputElement;
    expect(input.value).toBe('Spring Sketch');
    fireEvent.change(input, { target: { value: 'New Title' } });
    expect(onSetTitle).toHaveBeenCalledWith('New Title');
  });

  test('템포 입력 → onTempoApply + 박자 4/4 표시', () => {
    const { container, onTempoApply } = setup();
    expect(container.textContent).toContain('4/4');
    const input = container.querySelector('[data-prop="tempo"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    expect(onTempoApply).toHaveBeenCalledWith(120);
  });

  test('음길이 세그먼트: 클릭 → onSetLen(step)', () => {
    const { container, onSetLen } = setup();
    fireEvent.click(container.querySelector('[data-len="8"]') as Element);
    expect(onSetLen).toHaveBeenCalledWith(8);
  });

  test('음길이 활성: 선택 없으면 inputLen, 선택 있으면 노트 길이', () => {
    // 선택 없음 → inputLen=4 활성
    const { container } = setup({ inputLen: 4 });
    expect(container.querySelector('[data-len="4"]')?.className).toContain('on');
    expect(container.querySelector('[data-len="8"]')?.className).not.toContain('on');
    cleanup();
    // id=3: s=6, d=2 (8분) → 길이 2 활성
    const { container: c2 } = setup({ sel: 3 });
    expect(c2.querySelector('[data-len="2"]')?.className).toContain('on');
  });

  test('쉼표 버튼 → onDelete', () => {
    const { container, onDelete } = setup({ sel: 3 });
    fireEvent.click(container.querySelector('[data-btn="rest"]') as Element);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  test('스테퍼: 선택 없으면 — + 비활성, 선택 시 값 + 디스패치', () => {
    const { container } = setup();
    expect(container.querySelector('[data-cur="pitch"]')?.textContent).toBe('—');
    expect((container.querySelector('[data-i="pitch-up"]') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    // id=2: s=4, d=2, p=69 (A4)
    const { container: c2, onStepPitch, onStepLen } = setup({ sel: 2 });
    expect(c2.querySelector('[data-cur="pitch"]')?.textContent).toBe('A4');
    fireEvent.click(c2.querySelector('[data-i="pitch-up"]') as Element);
    expect(onStepPitch).toHaveBeenCalledWith(1);
    fireEvent.click(c2.querySelector('[data-i="len-prev"]') as Element);
    expect(onStepLen).toHaveBeenCalledWith(-1);
  });

  test('코드 슬롯 클릭 → onSlotTap(curM, b)', () => {
    const { container, onSlotTap } = setup({ curM: asBar(1) });
    fireEvent.click(container.querySelector('[data-b="2"]') as Element);
    expect(onSlotTap).toHaveBeenCalledWith(1, 2);
  });

  test('반주: 전역 패턴 선택 + 켜짐 표시, 마디 오버라이드 순환', () => {
    const { container, onAccSelect, onCycleAcc } = setup();
    expect(container.querySelector('[data-ap="pad"]')?.className).toContain('on');
    fireEvent.click(container.querySelector('[data-ap="off"]') as Element);
    expect(onAccSelect).toHaveBeenCalledWith('off');
    fireEvent.click(container.querySelector('[data-btn="macc"]') as Element);
    expect(onCycleAcc).toHaveBeenCalledOnce();
  });
});
