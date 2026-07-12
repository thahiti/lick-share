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
import { Toast } from './common/Toast';
import { ButtonBar } from './edit/ButtonBar';
import { ChordPicker } from './edit/ChordPicker';
import { ChordRow } from './edit/ChordRow';
import { Header } from './edit/Header';
import { MeasureBar } from './edit/MeasureBar';
import { Pad } from './edit/Pad';
import { Score } from './edit/Score';
import { Steppers } from './edit/Steppers';

export interface AppProps {
  readonly store?: StoreApi<SongStore>;
  readonly player: Player;
  readonly hashStore: HashStore;
}

export const App = ({ store = songStore, player, hashStore }: AppProps): JSX.Element => {
  const s = useStore(store);
  const [playing, setPlaying] = useState(false);
  const [playEl, setPlayEl] = useState<number | null>(null);
  /** 코드 피커가 열린 박 (닫힘=null) */
  const [cpBeat, setCpBeat] = useState<number | null>(null);
  const loaded = useRef(false);

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

  return (
    <div className="app">
      <Header
        song={s.song}
        accOn={s.accOn}
        metroOn={s.metroOn}
        playing={playing}
        onAccSelect={accSelect}
        onToggleMetro={metroToggle}
        onTogglePlay={togglePlay}
        onTempoApply={(v) => store.getState().setTempo(v)}
        onShare={() => hashStore.write(encodeSong(s.song))}
        onView={() => undefined}
      />
      <Score
        song={s.song}
        mode="edit"
        curM={s.curM}
        sel={s.sel}
        {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
        onMeasureTap={(m) => {
          setCpBeat(null);
          store.getState().gotoMeasure(m);
        }}
      />
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
      <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
    </div>
  );
};
