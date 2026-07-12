import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock } from '../../adapters/fakes/fake-clock';
import { createMemoryHashStore } from '../../adapters/fakes/memory-hash-store';
import { createPlayer } from '../../adapters/player';
import { decodeSong, encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import { secPerStep } from '../../engine/schedule';
import { createSongStore } from '../store/songStore';
import { App } from './App';

afterEach(cleanup);

const SPS = secPerStep(demoSong.tempo);
const EPOCH = 0.06;

const setup = (initialHash = '') => {
  const time = { t: 0 };
  const sink = createFakeAudioSink(() => time.t);
  const clock = createFakeClock();
  const player = createPlayer({ sink, clock });
  const hashStore = createMemoryHashStore(initialHash);
  const store = createSongStore();
  const utils = render(<App store={store} player={player} hashStore={hashStore} />);
  return { ...utils, time, sink, clock, player, hashStore, store };
};

const click = (container: HTMLElement, sel: string): void => {
  const el = container.querySelector(sel);
  if (!el) throw new Error(`${sel} 없음`);
  fireEvent.click(el);
};

describe('App 통합 (IMPLEMENTATION_PLAN P7 DoD)', () => {
  test('패드 입력 → 악보 반영 → undo → 복원', () => {
    const { container } = setup();
    // 마지막 마디로 이동 후 마디 추가 → 빈 마디 5
    for (let i = 0; i < 4; i++) click(container, '[data-btn="mnext"]');
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('마디 5 / 5');
    expect(container.querySelector('[data-rest="16"]')).not.toBeNull();

    click(container, '[data-p="60"][data-st="0"]'); // 입력
    expect(container.querySelector('[data-rest="16"]')).toBeNull();

    click(container, '[data-btn="undo"]');
    expect(container.querySelector('[data-rest="16"]')).not.toBeNull();
  });

  test('마디 탭 → 이동 + 첫 노트 선택 + 프리뷰', () => {
    const { container, sink } = setup();
    click(container, '[data-m="2"]');
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('마디 3 / 4');
    expect(container.querySelector('[data-p="65"][data-st="0"]')?.className).toContain('sel');
    expect(sink.events.some((e) => e.kind === 'melody' && e.vol === 0.22)).toBe(true);
  });

  test('전체 재생: curM 추적 + 5마디 곡 줄 전환 + 플레이헤드', () => {
    const fiveMeas = { ...demoSong, meas: 5 };
    const { container, time, clock } = setup(encodeSong(fiveMeas));
    click(container, '[data-btn="playall"]');
    time.t = EPOCH + 70 * SPS; // 마디 4 (step 64~80)
    act(() => clock.frame());
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('마디 5 / 5');
    const hits = [...container.querySelectorAll('[data-m]')].map((el) => el.getAttribute('data-m'));
    expect(hits).toEqual(['4']); // 2번째 라인으로 전환
    expect(container.querySelector('[data-playhead]')).not.toBeNull();
  });

  test('편집 후 500ms 뒤 해시 갱신, 재마운트 시 동일 곡 복원', () => {
    vi.useFakeTimers();
    const first = setup();
    fireEvent.click(first.container.querySelector('[data-p="60"][data-st="0"]') as Element);
    vi.advanceTimersByTime(500);
    const saved = first.hashStore.read();
    expect(saved.startsWith('v1.')).toBe(true);
    expect(decodeSong(saved)?.notes.some((n) => n.p === 60)).toBe(true);
    cleanup();

    const second = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(), clock: createFakeClock() })}
        hashStore={first.hashStore}
      />,
    );
    expect(second.container.querySelector('[data-p="60"][data-st="0"]')?.className).toContain('on');
    vi.useRealTimers();
  });

  test('재생 버튼 play↔pause 토글, 정지 시 즉시 무음', () => {
    const { container, sink } = setup();
    const btn = '[data-btn="playall"]';
    expect(container.querySelector(`${btn} [data-icon="play"]`)).not.toBeNull();
    click(container, btn);
    expect(container.querySelector(`${btn} [data-icon="pause"]`)).not.toBeNull();
    expect(sink.events.length).toBeGreaterThan(0);
    click(container, btn);
    expect(container.querySelector(`${btn} [data-icon="play"]`)).not.toBeNull();
    expect(sink.events).toHaveLength(0);
  });

  test('코드 슬롯 → 피커 열기 → 즉시 적용', () => {
    const { container } = setup();
    click(container, '[data-b="1"]');
    expect(container.querySelector('.chord-pick')).not.toBeNull();
    click(container, '[data-root="D"]');
    expect(container.querySelector('[data-b="1"]')?.textContent).toBe('D');
    click(container, '.cp-ft button:last-child'); // 완료
    expect(container.querySelector('.chord-pick')).toBeNull();
  });

  test('마디 재생: 현재 마디 범위만 스케줄', () => {
    const { container, sink } = setup();
    click(container, '[data-m="1"]'); // 마디 1로
    click(container, '[data-btn="play"]'); // 6버튼줄 ▶마디
    const melodies = sink.events.filter((e) => e.kind === 'melody' && e.vol === 0.24);
    expect(melodies).toHaveLength(3); // 마디 1과 겹치는 노트 3개
  });
});

describe('App: 열람 모드 + 공유 (IMPLEMENTATION_PLAN P8 DoD)', () => {
  const setupView = (initialHash = '') => {
    const time = { t: 0 };
    const sink = createFakeAudioSink(() => time.t);
    const clock = createFakeClock();
    const player = createPlayer({ sink, clock });
    const hashStore = createMemoryHashStore(initialHash);
    const store = createSongStore();
    const utils = render(
      <App store={store} player={player} hashStore={hashStore} initialMode="view" />,
    );
    return { ...utils, time, sink, clock, player, hashStore, store };
  };

  test('mode=view 라우팅: Viewer만 렌더', () => {
    const { container } = setupView();
    expect(container.textContent).toContain('공유된 악보');
    expect(container.querySelector('.pad')).toBeNull();
  });

  test('view 재생: 반주·메트로놈 0건, 음표 탭 → 그 위치부터', () => {
    const { container, sink } = setupView();
    click(container, '[data-btn="playv"]');
    expect(sink.events.length).toBeGreaterThan(0);
    expect(sink.events.every((e) => e.kind === 'melody')).toBe(true);

    click(container, '[data-note="3"]'); // s=6부터
    expect(sink.events.every((e) => e.kind === 'melody')).toBe(true);
    expect(sink.events).toHaveLength(11); // [6,64)와 겹치는 노트
    expect(sink.events[0]?.t).toBe(0);
  });

  test('복제해서 편집 → edit 전환 + 데이터 유지', () => {
    const { container } = setupView();
    click(container, '[data-btn="toedit"]');
    expect(container.querySelector('.pad')).not.toBeNull();
    expect(container.textContent).toContain('봄날의 스케치');
  });

  test('공유: ?mode=view#v1. URL 클립보드 복사 + 현재 해시 갱신 + 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container, hashStore, findByText } = setup();
    click(container, '[data-btn="share"]');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?mode=view#v1.'));
    expect(hashStore.read().startsWith('v1.')).toBe(true);
    expect(await findByText('열람 링크 복사됨')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
