/**
 * RecordingPiano 테스트 (piano-recording-design §3.2).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { asMidi, asStep, type Song } from '../../../core/types';
import { initialBaseC, RecordingPiano } from './RecordingPiano';

const mkSong = (notes: Song['notes']): Song => ({
  title: '',
  tempo: 100,
  meas: 1,
  pickup: 0,
  accPat: 'off',
  metro: 'off',
  mAcc: {},
  notes,
  chords: {},
});

const noop = (): void => {};

describe('RecordingPiano', () => {
  it('흰건반 15개(2옥타브) + 검은건반 10개 렌더', () => {
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={noop} onKeyUp={noop} />);
    expect(document.querySelectorAll('.rp-white')).toHaveLength(15);
    expect(document.querySelectorAll('.rp-black')).toHaveLength(10);
  });

  it('pointerdown/up이 해당 피치로 콜백', () => {
    const down = vi.fn();
    const up = vi.fn();
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={down} onKeyUp={up} />);
    const key = document.querySelector('[data-key="52"]') as HTMLElement; // E3
    fireEvent.pointerDown(key);
    expect(down).toHaveBeenCalledWith(52);
    fireEvent.pointerUp(key);
    expect(up).toHaveBeenCalledWith(52);
  });

  it('pointercancel도 keyUp으로 처리', () => {
    const up = vi.fn();
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={noop} onKeyUp={up} />);
    const key = document.querySelector('[data-key="48"]') as HTMLElement;
    fireEvent.pointerDown(key);
    fireEvent.pointerCancel(key);
    expect(up).toHaveBeenCalledWith(48);
  });

  it('옥타브 버튼: 끝(36/60)에서 비활성', () => {
    const shift = vi.fn();
    const { rerender } = render(
      <RecordingPiano baseC={36} onShift={shift} onKeyDown={noop} onKeyUp={noop} />,
    );
    expect((screen.getByLabelText('Octave down') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Octave up'));
    expect(shift).toHaveBeenCalledWith(1);
    rerender(<RecordingPiano baseC={60} onShift={shift} onKeyDown={noop} onKeyUp={noop} />);
    expect((screen.getByLabelText('Octave up') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('initialBaseC', () => {
  it('노트 없으면 C3(48)', () => {
    expect(initialBaseC(mkSong([]))).toBe(48);
  });
  it('중앙값 옥타브가 창 가운데: 중앙값 60(C4) → base 48', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(60) }]))).toBe(48);
  });
  it('낮은 곡은 36 클램프: 중앙값 38 → base 36', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(38) }]))).toBe(36);
  });
  it('높은 곡은 60 클램프: 중앙값 84 → base 60', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(84) }]))).toBe(60);
  });
});
