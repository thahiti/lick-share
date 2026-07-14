import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../core/demo-song';
import type { Song } from '../../../core/types';
import { Header } from './Header';

afterEach(cleanup);

const cbs = {
  onAccSelect: vi.fn(),
  onToggleMetro: vi.fn(),
  onTogglePlay: vi.fn(),
  onTempoApply: vi.fn(),
  onShare: vi.fn(),
  onExit: vi.fn(),
};

const renderHeader = (over: Partial<Parameters<typeof Header>[0]> = {}) =>
  render(
    <Header song={demoSong} accOn={true} metroOn={false} playing={false} {...cbs} {...over} />,
  );

const $ = (c: HTMLElement, sel: string): Element => {
  const el = c.querySelector(sel);
  if (!el) throw new Error(`${sel} 없음`);
  return el;
};

describe('Header (SPEC §3.1)', () => {
  test('제목·메타라인: "C장조 · 4/4 · 4마디", pickup 시 "+ 못갖춘"', () => {
    const base = renderHeader();
    expect(base.container.textContent).toContain('Spring Sketch');
    expect(base.container.textContent).toContain('C Major · 4/4 · 4 bars');

    const pk: Song = { ...demoSong, pickup: 8 };
    const withPk = renderHeader({ song: pk });
    expect(withPk.container.textContent).toContain('4 bars + pickup');
  });

  test('반주 팝오버: 열고 패턴 선택 → onAccSelect, 켜짐 반전 표시', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="acc"]'));
    fireEvent.click($(container, '[data-ap="comp"]'));
    expect(cbs.onAccSelect).toHaveBeenCalledWith('comp');
    expect(container.querySelector('[data-ap]')).toBeNull(); // 선택 즉시 닫힘
    fireEvent.click($(container, '[data-btn="acc"]')); // 다시 열기
    fireEvent.click($(container, '[data-ap="off"]'));
    expect(cbs.onAccSelect).toHaveBeenCalledWith('off');
    expect($(container, '[data-btn="acc"]').className).toContain('on'); // accOn=true
  });

  test('메트로놈: 토글 콜백 + 켜짐 반전', () => {
    const { container } = renderHeader({ metroOn: true });
    expect($(container, '[data-btn="metro"]').className).toContain('on');
    fireEvent.click($(container, '[data-btn="metro"]'));
    expect(cbs.onToggleMetro).toHaveBeenCalled();
  });

  test('재생 버튼: 아이콘 play↔pause 전환 + 콜백', () => {
    const stopped = renderHeader();
    expect($(stopped.container, '[data-btn="playall"]').querySelector('[data-icon="play"]')).not.toBeNull();
    const playing = renderHeader({ playing: true });
    expect($(playing.container, '[data-btn="playall"]').querySelector('[data-icon="pause"]')).not.toBeNull();
    fireEvent.click($(playing.container, '[data-btn="playall"]'));
    expect(cbs.onTogglePlay).toHaveBeenCalled();
  });

  test('템포: 칩 동기화 + ±4 버튼 + 직접입력 change', () => {
    const { container } = renderHeader({ song: { ...demoSong, tempo: 132 } });
    expect($(container, '[data-btn="tempo"]').textContent).toBe('♩=132');
    fireEvent.click($(container, '[data-btn="tempo"]')); // 팝오버 열기
    fireEvent.click($(container, '[data-tempo="up"]'));
    expect(cbs.onTempoApply).toHaveBeenCalledWith(136);
    fireEvent.click($(container, '[data-tempo="down"]'));
    expect(cbs.onTempoApply).toHaveBeenCalledWith(128);
    fireEvent.change($(container, 'input[type="number"]'), { target: { value: '300' } });
    expect(cbs.onTempoApply).toHaveBeenCalledWith(300); // 클램프는 core
  });

  test('Share 버튼 → onShare 즉시 호출 (팝오버 없음)', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="share"]'));
    expect(cbs.onShare).toHaveBeenCalled();
    expect(container.querySelector('[data-share]')).toBeNull();
  });

  test('Back 버튼 → onExit, View 버튼은 없다', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="back"]'));
    expect(cbs.onExit).toHaveBeenCalled();
    expect(container.querySelector('[data-btn="view"]')).toBeNull();
  });
});
