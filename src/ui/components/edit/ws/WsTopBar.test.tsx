import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { WsTopBar } from './WsTopBar';

afterEach(cleanup);

const setup = () => {
  const h = { onExit: vi.fn(), onShare: vi.fn() };
  const utils = render(<WsTopBar song={demoSong} {...h} />);
  return { ...utils, ...h };
};

describe('WsTopBar', () => {
  test('제목 + Auto-saved 표기', () => {
    const { container } = setup();
    expect(container.textContent).toContain('Spring Sketch');
    expect(container.textContent).toContain('Auto-saved');
  });

  test('← 뒤로 → onExit (커뮤니티 복귀)', () => {
    const { container, onExit } = setup();
    fireEvent.click(container.querySelector('[data-btn="back"]') as Element);
    expect(onExit).toHaveBeenCalledOnce();
  });

  test('Share primary 단일 버튼 → onShare, Publish 버튼은 없다', () => {
    const { container, onShare } = setup();
    const share = container.querySelector('[data-btn="share"]') as HTMLElement;
    fireEvent.click(share);
    expect(onShare).toHaveBeenCalledOnce();
    expect(share.className).toContain('ws-btn-primary');
    expect(container.querySelector('[data-btn="publish"]')).toBeNull();
  });
});
