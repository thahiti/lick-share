/**
 * 앱 루트 — 편집 화면 조립 (설계 문서 §2·§3, SPEC §3).
 * 해시 로드/자동 저장(500ms 디바운스), 재생 연동(curM 추적·줄 전환·플레이헤드),
 * 프리뷰 사운드, 코드 피커 개폐. 열람(view) 라우팅은 P9.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { Player } from '../../adapters/player';
import { decodeSong, encodeSong } from '../../core/codec';
import { measCountAll, measLen, measOf, measStart, total } from '../../core/geometry';
import { asStep, type AccPattern } from '../../core/types';
import type { HashStore } from '../../ports/hash-store';
import { songStore, type SongStore } from '../store/songStore';
import { useKeyboardShortcuts, type ShortcutAction } from '../hooks/useKeyboardShortcuts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { DawEdit } from './edit/daw/DawEdit';
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
}

const modeFromLocation = (): AppMode =>
  new URLSearchParams(window.location.search).get('mode') === 'view' ? 'view' : 'edit';

export const App = ({
  store = songStore,
  player,
  hashStore,
  initialMode,
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
  /* 데스크톱(≥900px) 편집은 DAW 레이아웃 (P11 v2) */
  const desktop = useMediaQuery('(min-width: 900px)');

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

  const playOpts = { melody: true, accomp: s.accOn, metro: s.metroOn };

  const togglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    player.play(s.song, playOpts, asStep(0), asStep(total(s.song)));
    setPlaying(true);
  };

  const playMeasure = (): void => {
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
    if (player.isPlaying()) player.toggleMetro(store.getState().metroOn);
  };

  const chordKey = (b: number): number => measStart(s.song, s.curM) / 4 + b;

  /** 공유: 열람 링크 클립보드 복사 + 현재 해시 갱신 (SPEC §3.1, §7) */
  const copyShare = (): void => {
    const hash = encodeSong(store.getState().song);
    hashStore.write(hash);
    const url = `${window.location.origin}${window.location.pathname}?mode=view#${hash}`;
    const done = (): void => store.getState().showToast('열람 링크 복사됨');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => window.prompt('링크를 복사하세요', url));
    } else {
      window.prompt('링크를 복사하세요', url);
    }
  };

  /* 열람 재생: 멜로디만 (SPEC §4) */
  const viewOpts = { melody: true, accomp: false, metro: false };

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
      <div className="daw">
        <DawEdit
          song={s.song}
          sel={s.sel}
          curM={s.curM}
          accOn={s.accOn}
          metroOn={s.metroOn}
          playing={playing}
          playEl={playEl}
          cpBeat={cpBeat}
          scoreW={scoreW}
          scoreRef={shellRef}
          onCellTap={(m, pv, st) => store.getState().padTapAt(m, pv, st)}
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
          onMeasureTap={(m) => {
            setCpBeat(null);
            store.getState().gotoMeasure(m);
          }}
          onStepPitch={(d) => store.getState().stepPitch(d)}
          onStepPos={(d) => store.getState().stepPos(d)}
          onStepLen={(d) => store.getState().stepLen(d)}
          onAccSelect={accSelect}
          onCycleAcc={() => store.getState().cycleMeasureAcc()}
          onTogglePlay={togglePlay}
          onToggleMetro={metroToggle}
          onTempoApply={(v) => store.getState().setTempo(v)}
          onUndo={() => store.getState().undoAction()}
          onRedo={() => store.getState().redoAction()}
          onDelete={() => store.getState().deleteSel()}
          onShare={copyShare}
          onView={() => {
            player.stop();
            setMode('view');
          }}
        />
        <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="pane-score" ref={shellRef}>
        <Header
          song={s.song}
          accOn={s.accOn}
          metroOn={s.metroOn}
          playing={playing}
          onAccSelect={accSelect}
          onToggleMetro={metroToggle}
          onTogglePlay={togglePlay}
          onTempoApply={(v) => store.getState().setTempo(v)}
          onShare={copyShare}
          onView={() => {
            player.stop();
            setMode('view');
          }}
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
