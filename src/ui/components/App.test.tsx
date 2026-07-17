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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 데스크톱(≥1024px) matchMedia 스텁 */
const stubDesktop = (): void => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
};

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
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('Bar 5 / 5');
    expect(container.querySelector('[data-rest="16"]')).not.toBeNull();

    click(container, '[data-p="60"][data-st="0"]'); // 입력
    expect(container.querySelector('[data-rest="16"]')).toBeNull();

    click(container, '[data-btn="undo"]');
    expect(container.querySelector('[data-rest="16"]')).not.toBeNull();
  });

  test('편집: 두 pane 구조 + 소속 컴포넌트', () => {
    const { container } = setup();
    const paneScore = container.querySelector('.pane-score');
    const paneEdit = container.querySelector('.pane-edit');
    expect(paneScore).not.toBeNull();
    expect(paneEdit).not.toBeNull();
    expect(paneScore?.querySelector('.header')).not.toBeNull();
    expect(paneEdit?.querySelector('.button-bar')).not.toBeNull();
    expect(paneEdit?.querySelector('.pad')).not.toBeNull();
  });

  test('키보드: l = 다음 음 선택', () => {
    const { container } = setup();
    click(container, '[data-m="0"]'); // 마디1 첫 노트 선택
    const selKey = (): string | undefined => {
      const el = container.querySelector('.pcell.sel');
      return el ? `${el.getAttribute('data-p')}:${el.getAttribute('data-st')}` : undefined;
    };
    const before = selKey();
    fireEvent.keyDown(window, { key: 'l' });
    expect(selKey()).not.toBe(before);
  });

  test('키보드: Space = 재생 토글', () => {
    const { player } = setup();
    expect(player.isPlaying()).toBe(false);
    fireEvent.keyDown(window, { key: ' ' });
    expect(player.isPlaying()).toBe(true);
  });

  test('마디 탭 → 이동 + 첫 노트 선택 + 프리뷰', () => {
    const { container, sink } = setup();
    click(container, '[data-m="2"]');
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('Bar 3 / 4');
    expect(container.querySelector('[data-p="65"][data-st="0"]')?.className).toContain('sel');
    expect(sink.events.some((e) => e.kind === 'melody' && e.vol === 0.22)).toBe(true);
  });

  test('전체 재생: curM 추적 + 5마디 곡 줄 전환 + 플레이헤드', () => {
    const fiveMeas = { ...demoSong, meas: 5 };
    const { container, time, clock } = setup(encodeSong(fiveMeas));
    click(container, '[data-btn="playall"]');
    time.t = EPOCH + 70 * SPS; // 마디 4 (step 64~80)
    act(() => clock.frame());
    expect(container.querySelector('[data-mlabel]')?.textContent).toBe('Bar 5 / 5');
    const hits = [...container.querySelectorAll('[data-m]')].map((el) => el.getAttribute('data-m'));
    expect(hits).toEqual(['4']); // 2번째 라인으로 전환
    expect(container.querySelector('[data-playhead]')).not.toBeNull();
  });

  test('재생 중 현재 음이 선택됨 + 정지 시 마지막 재생된 음 선택 유지', () => {
    const { container, time, clock, store } = setup();
    click(container, '[data-btn="playall"]');
    time.t = EPOCH + 21 * SPS; // step 21 → 데모곡 [20,4,67] id=6 재생 중
    act(() => clock.frame());
    expect(store.getState().sel).toBe(6);
    click(container, '[data-btn="playall"]'); // 정지
    expect(store.getState().sel).toBe(6); // 마지막 재생된 음 선택 유지
  });

  test('편집 후 500ms 뒤 해시 갱신, 재마운트 시 동일 곡 복원', () => {
    vi.useFakeTimers();
    const first = setup();
    fireEvent.click(first.container.querySelector('[data-p="60"][data-st="0"]') as Element);
    vi.advanceTimersByTime(500);
    const saved = first.hashStore.read();
    expect(saved.startsWith('v2')).toBe(true);
    expect(saved).not.toContain('.');
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

  test('마디 재생 버튼 play↔pause 토글, 재생 중 재클릭 시 정지', () => {
    const { container, sink, player } = setup();
    const btn = '[data-btn="play"]';
    expect(container.querySelector(`${btn} [data-icon="play"]`)).not.toBeNull();
    click(container, btn); // 마디 재생 시작
    expect(player.isPlaying()).toBe(true);
    expect(container.querySelector(`${btn} [data-icon="pause"]`)).not.toBeNull();
    click(container, btn); // 재클릭 → 정지
    expect(player.isPlaying()).toBe(false);
    expect(container.querySelector(`${btn} [data-icon="play"]`)).not.toBeNull();
    expect(sink.events).toHaveLength(0);
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
    expect(container.textContent).toContain('SHARED SCORE');
    expect(container.querySelector('.pad')).toBeNull();
  });

  test('view 재생: 곡 데이터대로 반주 포함(데모=pad, metro off), 음표 탭 → 그 위치부터', () => {
    const { container, sink } = setupView();
    click(container, '[data-btn="playv"]');
    // 데모곡: 반주 pad + 메트로놈 off → 멜로디+반주, 메트로놈은 없음
    expect(sink.events.some((e) => e.kind === 'melody')).toBe(true);
    expect(sink.events.some((e) => e.kind === 'acc')).toBe(true);
    expect(sink.events.some((e) => e.kind === 'metro')).toBe(false);

    click(container, '[data-note="3"]'); // s=6부터
    expect(sink.events.some((e) => e.kind === 'acc')).toBe(true);
    expect(sink.events[0]?.t).toBe(0);
  });

  test('view 재생: 메트로놈이 켜진 곡은 열람에서도 클릭이 난다', () => {
    const { container, sink } = setupView(encodeSong({ ...demoSong, metro: 'quarter' }));
    click(container, '[data-btn="playv"]');
    expect(sink.events.some((e) => e.kind === 'metro')).toBe(true);
  });

  test('복제해서 편집 → edit 전환 + 데이터 유지', () => {
    const { container } = setupView();
    click(container, '[data-btn="toedit"]');
    expect(container.querySelector('.pad')).not.toBeNull();
    expect(container.textContent).toContain('Spring Sketch');
  });

  test('레거시 열람 Copy link → 무점 ?mode=view#v1… URL 클립보드 복사 + 해시 갱신 + 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container, hashStore, findByText } = setupView();
    click(container, '[data-btn="copy"]');
    const url = writeText.mock.calls[0]?.[0] as string;
    expect(url).toContain('?mode=view#v2');
    expect(url).not.toContain('.eyJ'); // 링크 감지기가 '.'에서 절단하므로 해시는 무점이어야 함
    expect(hashStore.read().startsWith('v2')).toBe(true);
    expect(hashStore.read()).not.toContain('.');
    expect(await findByText('View link copied')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  test('잘린 해시(view): 에러 화면 표시 — 데모 곡을 조용히 보여주지 않음', () => {
    const { container } = setupView('v1'); // 링크 감지기가 절단한 해시
    expect(container.textContent).toContain('Broken link');
    expect(container.textContent).not.toContain('SHARED SCORE');
    expect(container.querySelector('[data-note]')).toBeNull();
  });

  test('잘못된 해시(edit): 토스트로 알림', async () => {
    const time = { t: 0 };
    const { findByText } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore('v1')}
      />,
    );
    expect(await findByText('Broken link — score not loaded')).toBeTruthy();
  });

  test('빈 해시(view): 에러 없이 기본 곡 열람 (기존 동작 유지)', () => {
    const { container } = setupView('');
    expect(container.textContent).toContain('SHARED SCORE');
    expect(container.textContent).not.toContain('Broken link');
  });

  test('편집 Share 버튼: 현재 곡 해시로 onShare 호출', () => {
    const onShare = vi.fn();
    const time = { t: 0 };
    const { container } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore('')}
        onShare={onShare}
      />,
    );
    click(container, '[data-btn="share"]');
    expect(onShare).toHaveBeenCalledTimes(1);
    expect((onShare.mock.calls[0]?.[0] as string).startsWith('v2')).toBe(true);
  });

  test('편집 Back 버튼 → onExit, View 버튼은 없다', () => {
    const onExit = vi.fn();
    const time = { t: 0 };
    const { container } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore('')}
        onExit={onExit}
      />,
    );
    expect(container.querySelector('[data-btn="view"]')).toBeNull();
    click(container, '[data-btn="back"]');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('App: 접근성 (IMPLEMENTATION_PLAN P9 DoD)', () => {
  const accessibleName = (btn: Element): string =>
    (btn.getAttribute('aria-label') ?? '') || (btn.textContent ?? '').trim();

  test('편집 화면: 모든 버튼에 접근 가능한 이름', () => {
    const { container } = setup();
    fireEvent.click(container.querySelector('[data-b="1"]') as Element); // 피커도 열어서 포함
    const missing = [...container.querySelectorAll('button')].filter(
      (b) => accessibleName(b) === '',
    );
    expect(missing.map((b) => b.outerHTML.slice(0, 80))).toEqual([]);
  });

  test('열람 화면: 모든 버튼에 접근 가능한 이름', () => {
    const time = { t: 0 };
    const { container } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore()}
        initialMode="view"
      />,
    );
    const missing = [...container.querySelectorAll('button')].filter(
      (b) => accessibleName(b) === '',
    );
    expect(missing.map((b) => b.outerHTML.slice(0, 80))).toEqual([]);
  });
});

describe('App: 리사이즈 재계산 (IMPLEMENTATION_PLAN P9)', () => {
  test('resize 이벤트 후에도 지오메트리 재계산 렌더 (jsdom 폴백 384)', () => {
    const { container } = setup();
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(container.querySelector('svg[width="100%"]')?.getAttribute('viewBox')).toBe(
      '0 0 384 126',
    );
  });
});

describe('데스크톱 워크스페이스 편집 (editor-workspace)', () => {
  test('≥1024px: 워크스페이스 렌더 + 모바일 패드 없음', () => {
    stubDesktop();
    const { container } = setup();
    expect(container.querySelector('.ws')).not.toBeNull();
    expect(container.querySelector('.roll-grid')).not.toBeNull();
    expect(container.querySelector('.pp')).not.toBeNull();
    expect(container.querySelector('.sl-body')).not.toBeNull();
    expect(container.querySelector('.pk')).not.toBeNull();
    expect(container.querySelector('.pad')).toBeNull();
  });

  test('빈 셀 클릭 → 다른 마디에 노트 입력 + curM 이동', () => {
    stubDesktop();
    const { container, store } = setup();
    const before = store.getState().song.notes.length;
    click(container, '[data-m="1"][data-p="84"][data-st="0"]');
    expect(store.getState().song.notes.length).toBe(before + 1);
    expect(store.getState().curM).toBe(1);
  });

  test('속성 패널 코드 슬롯 클릭 → 피커 열림 → Esc 닫힘', () => {
    stubDesktop();
    const { container } = setup();
    click(container, '.pp [data-b="0"]');
    expect(container.querySelector('.chord-pick')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.chord-pick')).toBeNull();
  });

  test('A~G 단축키 → 다음 빈 박에 음 입력', () => {
    stubDesktop();
    const { store } = setup();
    // 마디 추가 → 빈 마디 확보 (curM 이동)
    store.getState().addMeasure();
    const before = store.getState().song.notes.length;
    fireEvent.keyDown(window, { key: 'c' });
    expect(store.getState().song.notes.length).toBe(before + 1);
  });

  test('건반 pointerdown → 프리뷰 사운드만, 노트 입력 없음', () => {
    stubDesktop();
    const { container, store, sink } = setup();
    const before = store.getState().song.notes.length;
    const key = container.querySelector('.pk [data-key="72"]');
    if (!key) throw new Error('건반 없음');
    fireEvent.pointerDown(key);
    expect(store.getState().song.notes.length).toBe(before); // 삽입 없음
    expect(sink.playNowCount).toBe(1); // 프리뷰 사운드
  });

  test('키보드 Space 재생 유지', () => {
    stubDesktop();
    const { player } = setup();
    fireEvent.keyDown(window, { key: ' ' });
    expect(player.isPlaying()).toBe(true);
  });
});

describe('모바일 레코딩 모드 (piano-recording-design §3.2)', () => {
  test('Rec 탭 → 카운트인 오버레이 + RecordingPiano 표시, Pad 숨김', () => {
    const { container } = setup();
    click(container, '[data-btn="rec"]');
    expect(container.querySelector('.rec-countin')).not.toBeNull();
    expect(container.querySelector('.rpiano')).not.toBeNull();
    expect(container.querySelector('.pcell')).toBeNull();
    expect(container.querySelector('.rec-state')).not.toBeNull();
  });

  test('Stop 탭 → 편집 UI 복원 + recTake 해제', () => {
    const { container, store } = setup();
    click(container, '[data-btn="rec"]');
    click(container, '[data-btn="stop-rec"]');
    expect(container.querySelector('.rpiano')).toBeNull();
    expect(container.querySelector('.pcell')).not.toBeNull();
    expect(store.getState().recTake).toBe('off');
  });

  test('레코딩 건반 pointerdown/up → 노트 커밋', () => {
    const { container, time, clock, store } = setup();
    click(container, '[data-btn="rec"]');
    act(() => {
      time.t = EPOCH + 16 * SPS; // 본편 t=0
      clock.frame();
    });
    const key = container.querySelector('.rp-keys [data-key="60"]');
    if (!key) throw new Error('건반 없음');
    fireEvent.pointerDown(key);
    act(() => {
      time.t = EPOCH + 16 * SPS + 4 * SPS; // 4스텝 홀드
      clock.frame();
    });
    fireEvent.pointerUp(key);
    expect(store.getState().song.notes.some((n) => n.p === 60 && n.s === 0 && n.d === 4)).toBe(true);
  });
});
