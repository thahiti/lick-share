import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { WsTopBar } from './WsTopBar';

afterEach(cleanup);

const setup = () => {
  const h = { onBack: vi.fn(), onCopyLink: vi.fn(), onPublish: vi.fn() };
  const utils = render(<WsTopBar song={demoSong} {...h} />);
  return { ...utils, ...h };
};

describe('WsTopBar', () => {
  test('제목 + Auto-saved 표기', () => {
    const { container } = setup();
    expect(container.textContent).toContain('Spring Sketch');
    expect(container.textContent).toContain('Auto-saved');
  });

  test('← 뒤로 → onBack', () => {
    const { container, onBack } = setup();
    fireEvent.click(container.querySelector('[data-btn="back"]') as Element);
    expect(onBack).toHaveBeenCalledOnce();
  });

  test('Share → onCopyLink', () => {
    const { container, onCopyLink } = setup();
    fireEvent.click(container.querySelector('[data-btn="share"]') as Element);
    expect(onCopyLink).toHaveBeenCalledOnce();
  });

  test('Publish → onPublish (화면 유일 primary)', () => {
    const { container, onPublish } = setup();
    const pub = container.querySelector('[data-btn="publish"]') as HTMLElement;
    fireEvent.click(pub);
    expect(onPublish).toHaveBeenCalledOnce();
    expect(pub.className).toContain('ws-btn-primary');
  });
});
