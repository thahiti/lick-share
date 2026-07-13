import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { DawTopBar } from './DawTopBar';

afterEach(cleanup);

const cbs = {
  onTogglePlay: vi.fn(),
  onToggleMetro: vi.fn(),
  onTempoApply: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
  onPublish: vi.fn(),
  onCopyLink: vi.fn(),
  onView: vi.fn(),
};

const $ = (c: HTMLElement, sel: string): Element => {
  const el = c.querySelector(sel);
  if (!el) throw new Error(`${sel} 없음`);
  return el;
};

describe('DawTopBar 공유 팝오버', () => {
  test('Share → Publish / Copy link 각각 콜백 + 선택 시 닫힘', () => {
    const { container } = render(
      <DawTopBar song={demoSong} playing={false} metroOn={false} {...cbs} />,
    );
    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="publish"]'));
    expect(cbs.onPublish).toHaveBeenCalled();
    expect(container.querySelector('[data-share]')).toBeNull();

    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="copy"]'));
    expect(cbs.onCopyLink).toHaveBeenCalled();
  });
});
