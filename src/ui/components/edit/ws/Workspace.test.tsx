import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { asBar } from '../../../../core/types';
import { Workspace } from './Workspace';

afterEach(cleanup);

const handlers = () => ({
  onCellTap: vi.fn(),
  onDragNote: vi.fn(),
  onSlotTap: vi.fn(),
  onPickerApply: vi.fn(),
  onPickerClear: vi.fn(),
  onPickerDone: vi.fn(),
  onStepPitch: vi.fn(),
  onStepPos: vi.fn(),
  onStepLen: vi.fn(),
  onSetLen: vi.fn(),
  onDelete: vi.fn(),
  onAccSelect: vi.fn(),
  onCycleAcc: vi.fn(),
  onSetTitle: vi.fn(),
  onTempoApply: vi.fn(),
  onKeyTap: vi.fn(),
  onTogglePlay: vi.fn(),
  onToggleMetro: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onExit: vi.fn(),
  onShare: vi.fn(),
});

const setup = (over: Partial<Parameters<typeof Workspace>[0]> = {}) => {
  const h = handlers();
  const utils = render(
    <Workspace
      song={demoSong}
      sel={null}
      curM={asBar(0)}
      accOn
      metroOn={false}
      playing={false}
      playEl={null}
      cpBeat={null}
      recPhase="idle"
      countBeat={null}
      recEl={null}
      onRecord={() => {}}
      onRecStop={() => {}}
      onRecKeyDown={() => {}}
      onRecKeyUp={() => {}}
      inputLen={4}
      {...h}
      {...over}
    />,
  );
  return { ...utils, ...h };
};

describe('Workspace 조립', () => {
  test('셸 + 소속 컴포넌트 렌더', () => {
    const { container } = setup();
    expect(container.querySelector('.ws')).not.toBeNull();
    expect(container.querySelector('.ws-top')).not.toBeNull();
    expect(container.querySelector('.sl')).not.toBeNull();
    expect(container.querySelector('.roll')).not.toBeNull();
    expect(container.querySelector('.pk')).not.toBeNull();
    expect(container.querySelector('.pp')).not.toBeNull();
    expect(container.querySelector('.ws-hints')).not.toBeNull();
    expect(container.querySelector('[data-btn="playall"]')).not.toBeNull();
  });

  test('악보·롤이 하나의 .ws-scroll 공유', () => {
    const { container } = setup();
    const scroll = container.querySelector('.ws-scroll');
    expect(scroll).not.toBeNull();
    expect(scroll?.querySelector('.sl')).not.toBeNull();
    expect(scroll?.querySelector('.roll')).not.toBeNull();
  });

  test('줌 인/아웃 = 악보·롤 폭 동시 스케일 (공유 pxPerStep)', () => {
    const { container } = setup();
    const w = () => Number((container.querySelector('.sl-body') as SVGElement).getAttribute('width'));
    const gridW = () => (container.querySelector('.roll-grid') as HTMLElement).style.width;
    const before = w();
    const beforeGrid = gridW();
    fireEvent.click(container.querySelector('[data-btn="zoom-in"]') as Element);
    expect(w()).toBeGreaterThan(before);
    expect(gridW()).not.toBe(beforeGrid);
    // 악보와 롤 폭이 같은 px로 스케일 (마디 경계 일치 보장)
    expect(`${w()}px`).toBe(gridW());
  });

  test('재생 버튼 → onTogglePlay', () => {
    const { container, onTogglePlay } = setup();
    fireEvent.click(container.querySelector('[data-btn="playall"]') as Element);
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  test('cpBeat 지정 시 ChordPicker 렌더', () => {
    const { container } = setup({ cpBeat: 1 });
    expect(container.querySelector('.chord-pick')).not.toBeNull();
  });

  test('건반 클릭 → onKeyTap', () => {
    const { container, onKeyTap } = setup();
    fireEvent.click(container.querySelector('.pk [data-key="60"]') as Element);
    expect(onKeyTap).toHaveBeenCalledWith(60);
  });
});
