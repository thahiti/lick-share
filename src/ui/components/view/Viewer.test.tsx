import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import hashes from '../../../../fixtures/prototype-hashes.json';
import { decodeSong } from '../../../core/codec';
import { demoSong } from '../../../core/demo-song';
import { Viewer } from './Viewer';

afterEach(cleanup);

const cbs = {
  onPlayAll: vi.fn(),
  onNoteTap: vi.fn(),
  onCopyLink: vi.fn(),
  onToEdit: vi.fn(),
};

describe('Viewer (SPEC §4)', () => {
  test('히어로: "공유된 악보" + 제목, 배지 4종 값', () => {
    const { container } = render(<Viewer song={demoSong} playing={false} {...cbs} />);
    expect(container.textContent).toContain('SHARED SCORE');
    expect(container.textContent).toContain('Spring Sketch');
    const badges = [...container.querySelectorAll('[data-badge]')].map((el) => el.textContent);
    expect(badges).toEqual(['C Major', '4/4', '♩=100', '4 bars']);
  });

  test('악보: 전체 멀티라인 + 음표 탭 → onNoteTap(id)', () => {
    const { container } = render(<Viewer song={demoSong} playing={false} {...cbs} />);
    const note = container.querySelector('[data-note="3"]');
    if (!note) throw new Error('음표 없음');
    fireEvent.click(note);
    expect(cbs.onNoteTap).toHaveBeenCalledWith(3);
  });

  test('큰 재생 버튼 / 링크 복사 / 복제해서 편집', () => {
    const { container } = render(<Viewer song={demoSong} playing={false} {...cbs} />);
    const click = (sel: string): void => {
      const el = container.querySelector(sel);
      if (!el) throw new Error(`${sel} 없음`);
      fireEvent.click(el);
    };
    click('[data-btn="playv"]');
    expect(cbs.onPlayAll).toHaveBeenCalled();
    click('[data-btn="copy"]');
    expect(cbs.onCopyLink).toHaveBeenCalled();
    click('[data-btn="toedit"]');
    expect(cbs.onToEdit).toHaveBeenCalled();
  });

  test('프로토타입 해시 3종(일반/pickup/구버전) 디코딩 렌더 성공', () => {
    for (const [name, hash] of Object.entries(hashes)) {
      const song = decodeSong(hash);
      expect(song, name).not.toBeNull();
      if (!song) continue;
      const { container, unmount } = render(<Viewer song={song} playing={false} {...cbs} />);
      expect(container.querySelector('svg'), name).not.toBeNull();
      expect(container.querySelectorAll('[data-note]').length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  test('구버전 해시: "r" 쉼표 필터 후 노트 2개만 렌더', () => {
    const song = decodeSong(hashes.legacy);
    if (!song) throw new Error('legacy 디코딩 실패');
    const { container } = render(<Viewer song={song} playing={false} {...cbs} />);
    const ids = new Set(
      [...container.querySelectorAll('[data-note]')].map((el) => el.getAttribute('data-note')),
    );
    expect(ids.size).toBe(2);
  });
});
