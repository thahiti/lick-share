/**
 * 앱 루트 — 편집 화면 조립 (설계 문서 §2·§3, SPEC §3).
 * 해시 로드/자동 저장(500ms 디바운스), 재생 연동(curM 추적·줄 전환·플레이헤드),
 * 프리뷰 사운드, 코드 피커 개폐. view 모드는 ?mode=view 레거시 열람 전용.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { Player } from '../../adapters/player';
import { decodeSong, encodeSong } from '../../core/codec';
import { noteAt } from '../../core/editing';
import { measCountAll, measLen, measOf, measStart, total } from '../../core/geometry';
import { asStep, type AccPattern } from '../../core/types';
import type { HashStore } from '../../ports/hash-store';
import { songStore, type SongStore } from '../store/songStore';
import { useKeyboardShortcuts, type ShortcutAction } from '../hooks/useKeyboardShortcuts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Workspace } from './edit/ws/Workspace';
import { Toast } from './common/Toast';
import { ButtonBar } from './edit/ButtonBar';
import { ChordPicker } from './edit/ChordPicker';
import { ChordRow } from './edit/ChordRow';
import { Header } from './edit/Header';
import { MeasureBar } from './edit/MeasureBar';
import { Pad } from './edit/Pad';
import { Score } from './edit/Score';
import { Steppers } from './edit/Steppers';
import { Viewer } from './view/Viewer';

export type AppMode = 'edit' | 'view';

export interface AppProps {
  readonly store?: StoreApi<SongStore>;
  readonly player: Player;
  readonly hashStore: HashStore;
  /** 미지정 시 ?mode=view 쿼리로 결정 */
  readonly initialMode?: AppMode;
  /** Share 화면 진입 — community Root가 주입 (ui→community 의존 회피) */
  readonly onShare?: (hash: string) => void;
  /** 편집 종료(커뮤니티 복귀) — community Root가 주입 */
  readonly onExit?: () => void;
}

const modeFromLocation = (): AppMode =>
  new URLSearchParams(window.location.search).get('mode') === 'view' ? 'view' : 'edit';

export const App = ({
  store = songStore,
  player,
  hashStore,
  initialMode,
  onShare,
  onExit,
}: AppProps): JSX.Element => {
  const s = useStore(store);
  const [mode, setMode] = useState<AppMode>(initialMode ?? modeFromLocation());
  const [playing, setPlaying] = useState(false);
  const [playEl, setPlayEl] = useState<number | null>(null);
  /** 코드 피커가 열린 박 (닫힘=null) */
  const [cpBeat, setCpBeat] = useState<number | null>(null);
  const loaded = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [scoreW, setScoreW] = useState(384);
  /* 데스크톱(≥1024px) 편집은 라이트 워크스페이스 */
  const desktop = useMediaQuery('(min-width: 1024px)');

  /* 악보 pane 폭 측정 → 조판 재계산 (SPEC §8). 모드·레이아웃 전환 시 대상 재부착 */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = (): void => setScoreW(el.clientWidth || 384);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, desktop]);

  /* 초기 해시 로드 (SPEC §7) */
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const decoded = decodeSong(hashStore.read());
    if (decoded) store.getState().loadSong(decoded);
  }, [store, hashStore]);

  /* 자동 저장: 편집 후 500ms 디바운스 (SPEC §3.1) */
  useEffect(() => {
    const id = setTimeout(() => hashStore.write(encodeSong(s.song)), 500);
    return () => clearTimeout(id);
  }, [s.song, hashStore]);

  /* 프리뷰 사운드 — 입력·선택·음높이 변경에만 (스토어가 결정) */
  useEffect(() => {
    if (s.preview) player.preview(s.preview.p);
  }, [s.preview, player]);

  /* 재생 진행 구독: curM 추적 + 줄 전환, 종료 시 상태 정리 */
  useEffect(() => {
    const unsubTick = player.onTick((el) => {
      setPlayEl(el);
      const st = store.getState();
      const m = Math.min(measOf(st.song, asStep(el)), measCountAll(st.song) - 1);
      if (m !== st.curM) st.setCurM(m);
      // 재생 중인 음을 선택 상태로 — 정지 시 마지막 재생 음이 선택된 채로 남는다.
      // 쉼표 구간(noteAt=null)에서는 직전 선택을 유지한다.
      const n = noteAt(st.song, el);
      if (n && n.id !== st.sel) st.setSel(n.id);
    });
    const unsubEnd = player.onEnded(() => {
      setPlaying(false);
      setPlayEl(null);
    });
    return () => {
      unsubTick();
      unsubEnd();
    };
  }, [player, store]);

  // 반주·메트로놈 켬/끔은 곡 데이터가 결정 — 스케줄러는 항상 각 종류를 낸다
  const accOn = s.song.accPat !== 'off';
  const metroOn = s.song.metro !== 'off';
  const playOpts = { melody: true, accomp: true, metro: true };

  const togglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    player.play(s.song, playOpts, asStep(0), asStep(total(s.song)));
    setPlaying(true);
  };

  const playMeasure = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    const from = measStart(s.song, s.curM);
    player.play(s.song, playOpts, from, asStep(from + measLen(s.song, s.curM)));
    setPlaying(true);
  };

  const measurePrev = (): void => {
    setCpBeat(null);
    if (s.curM > 0) store.getState().gotoMeasure(s.curM - 1);
    else if (!s.song.pickup) store.getState().addPickup();
  };

  const measureNext = (): void => {
    setCpBeat(null);
    if (s.curM < measCountAll(s.song) - 1) store.getState().gotoMeasure(s.curM + 1);
    else store.getState().addMeasure();
  };

  const accSelect = (v: AccPattern | 'off'): void => {
    store.getState().setAccGlobal(v);
    if (player.isPlaying()) player.toggleAcc(v !== 'off', store.getState().song);
  };

  const metroToggle = (): void => {
    store.getState().toggleMetro();
    const song = store.getState().song;
    if (player.isPlaying()) player.toggleMetro(song.metro !== 'off', song);
  };

  const chordKey = (b: number): number => measStart(s.song, s.curM) / 4 + b;

  /** 레거시 열람(?mode=view) 전용: 열람 링크 클립보드 복사 + 현재 해시 갱신 (SPEC §7, 하위 호환) */
  const copyShare = (): void => {
    const hash = encodeSong(store.getState().song);
    hashStore.write(hash);
    const url = `${window.location.origin}${window.location.pathname}?mode=view#${hash}`;
    const done = (): void => store.getState().showToast('View link copied');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url));
    } else {
      window.prompt('Copy this link', url);
    }
  };

  /** 공유: 현재 곡 해시로 Share 화면 진입 (Root가 콜백 주입) */
  const share = (): void => {
    onShare?.(encodeSong(store.getState().song));
  };

  /** 편집 종료: 재생 정지 후 커뮤니티 복귀 */
  const exit = (): void => {
    player.stop();
    onExit?.();
  };

  /* 열람 재생: 멜로디 + 반주 + 메트로놈 종류를 모두 내보내고, 실제 소리는 곡 데이터가 결정 */
  const viewOpts = { melody: true, accomp: true, metro: true };

  const viewTogglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    player.play(s.song, viewOpts, asStep(0), asStep(total(s.song)));
    setPlaying(true);
  };

  const viewNoteTap = (id: number): void => {
    const n = s.song.notes.find((x) => x.id === id);
    if (!n) return;
    player.play(s.song, viewOpts, n.s, asStep(total(s.song)));
    setPlaying(true);
  };

  const shortcuts: Record<ShortcutAction, () => void> = {
    selectPrev: () => store.getState().selectDir(-1),
    selectNext: () => store.getState().selectDir(1),
    pitchUp: () => store.getState().stepPitch(1),
    pitchDown: () => store.getState().stepPitch(-1),
    posBack: () => store.getState().stepPos(-1),
    posFwd: () => store.getState().stepPos(1),
    lenInc: () => store.getState().stepLen(1),
    lenDec: () => store.getState().stepLen(-1),
    playToggle: togglePlay,
    playMeasure,
    del: () => store.getState().deleteSel(),
    measPrev: measurePrev,
    measNext: measureNext,
    undo: () => store.getState().undoAction(),
    redo: () => store.getState().redoAction(),
    escape: () => setCpBeat(null),
    noteA: () => store.getState().noteLetter('A'),
    noteB: () => store.getState().noteLetter('B'),
    noteC: () => store.getState().noteLetter('C'),
    noteD: () => store.getState().noteLetter('D'),
    noteE: () => store.getState().noteLetter('E'),
    noteF: () => store.getState().noteLetter('F'),
    noteG: () => store.getState().noteLetter('G'),
  };
  useKeyboardShortcuts(shortcuts, mode === 'edit');

  if (mode === 'view') {
    return (
      <div className="app app--view" ref={shellRef}>
        <Viewer
          song={s.song}
          playing={playing}
          width={scoreW}
          {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
          onPlayAll={viewTogglePlay}
          onNoteTap={viewNoteTap}
          onCopyLink={copyShare}
          onToEdit={() => {
            player.stop();
            setMode('edit');
          }}
        />
        <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
      </div>
    );
  }

  if (desktop) {
    return (
      <>
        <Workspace
          song={s.song}
          sel={s.sel}
          curM={s.curM}
          accOn={accOn}
          metroOn={metroOn}
          playing={playing}
          playEl={playEl}
          cpBeat={cpBeat}
          inputLen={s.inputLen}
          onCellTap={(m, pv, st) => store.getState().padTapAt(m, pv, st)}
          onDragNote={(id, patch) => store.getState().dragNote(id, patch)}
          onSlotTap={(m, b) => {
            if (m === s.curM && cpBeat === b) {
              setCpBeat(null);
              return;
            }
            store.getState().setCurM(m);
            setCpBeat(b);
          }}
          onPickerApply={(ch) => {
            if (cpBeat !== null) store.getState().setChord(chordKey(cpBeat), ch);
          }}
          onPickerClear={() => {
            if (cpBeat !== null) store.getState().setChord(chordKey(cpBeat), null);
            setCpBeat(null);
          }}
          onPickerDone={() => setCpBeat(null)}
          onStepPitch={(d) => store.getState().stepPitch(d)}
          onStepPos={(d) => store.getState().stepPos(d)}
          onStepLen={(d) => store.getState().stepLen(d)}
          onSetLen={(len) => store.getState().setLen(len)}
          onDelete={() => store.getState().deleteSel()}
          onAccSelect={accSelect}
          onCycleAcc={() => store.getState().cycleMeasureAcc()}
          onSetTitle={(title) => store.getState().setTitle(title)}
          onTempoApply={(v) => store.getState().setTempo(v)}
          onKeyTap={(p) => store.getState().keyTap(p)}
          onTogglePlay={togglePlay}
          onToggleMetro={metroToggle}
          onUndo={() => store.getState().undoAction()}
          onRedo={() => store.getState().redoAction()}
          onShare={share}
          onExit={exit}
        />
        <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
      </>
    );
  }

  return (
    <div className="app">
      <div className="pane-score" ref={shellRef}>
        <Header
          song={s.song}
          accOn={accOn}
          metroOn={metroOn}
          playing={playing}
          onAccSelect={accSelect}
          onToggleMetro={metroToggle}
          onTogglePlay={togglePlay}
          onTempoApply={(v) => store.getState().setTempo(v)}
          onShare={share}
          onExit={exit}
        />
        <Score
          song={s.song}
          mode="edit"
          curM={s.curM}
          sel={s.sel}
          width={scoreW}
          {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
          onMeasureTap={(m) => {
            setCpBeat(null);
            store.getState().gotoMeasure(m);
          }}
        />
      </div>
      <div className="pane-edit">
        <ChordRow
          song={s.song}
          curM={s.curM}
          openBeat={cpBeat}
          onSlotTap={(b) => setCpBeat((cur) => (cur === b ? null : b))}
          onCycleAcc={() => store.getState().cycleMeasureAcc()}
        />
        {cpBeat !== null && (
          <ChordPicker
            song={s.song}
            curM={s.curM}
            beat={cpBeat}
            onApply={(ch) => store.getState().setChord(chordKey(cpBeat), ch)}
            onClear={() => {
              store.getState().setChord(chordKey(cpBeat), null);
              setCpBeat(null);
            }}
            onDone={() => setCpBeat(null)}
          />
        )}
        <Pad song={s.song} curM={s.curM} sel={s.sel} onCellTap={(pv, st) => store.getState().padTap(pv, st)} />
        <MeasureBar song={s.song} curM={s.curM} onPrev={measurePrev} onNext={measureNext} />
        <Steppers
          song={s.song}
          sel={s.sel}
          onStepPitch={(d) => store.getState().stepPitch(d)}
          onStepPos={(d) => store.getState().stepPos(d)}
          onStepLen={(d) => store.getState().stepLen(d)}
        />
        <ButtonBar
          song={s.song}
          sel={s.sel}
          playing={playing}
          onSelectDir={(d) => store.getState().selectDir(d)}
          onPlayMeasure={playMeasure}
          onUndo={() => store.getState().undoAction()}
          onRedo={() => store.getState().redoAction()}
          onDelete={() => store.getState().deleteSel()}
        />
      </div>
      <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
    </div>
  );
};
