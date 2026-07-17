/**
 * 레코딩 세션 훅 — core/recording 상태 머신과 player.record·songStore를 잇는다.
 * 양자화·타이밍 판정은 전부 core에 있고 여기는 배선만 담당한다 (piano-recording-design §2).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { Player } from '../../adapters/player';
import { measOf } from '../../core/geometry';
import {
  initRecording,
  recKeyAbort,
  recKeyDown,
  recKeyUp,
  recTick,
  type NoteSpec,
  type RecState,
} from '../../core/recording';
import { asSec, asStep, type Midi, type Sec } from '../../core/types';
import { COUNT_IN_BEATS, secPerStep } from '../../engine/schedule';
import type { SongStore } from '../store/songStore';

export type RecPhase = 'idle' | 'countIn' | 'recording';

export interface RecordingApi {
  readonly phase: RecPhase;
  /** 예비박 남은 카운트 (4→1). countIn 외에는 null */
  readonly countBeat: number | null;
  /** 플레이헤드 스텝. recording 외에는 null */
  readonly recEl: number | null;
  start(): void;
  stop(): void;
  keyDown(midi: Midi): void;
  keyUp(midi: Midi): void;
  /** pointercancel — 스크롤 제스처 등으로 취소된 누름을 커밋 없이 버림 */
  keyAbort(midi: Midi): void;
}

interface Live {
  st: RecState;
  readonly sps: number;
  /** 마지막 프레임의 본편 기준 시각 */
  t: Sec;
}

export const useRecording = (store: StoreApi<SongStore>, player: Player): RecordingApi => {
  const [phase, setPhase] = useState<RecPhase>('idle');
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [recEl, setRecEl] = useState<number | null>(null);
  const live = useRef<Live | null>(null);

  const commit = useCallback(
    (spec: NoteSpec | null): void => {
      if (spec) store.getState().recordCommit(spec);
    },
    [store],
  );

  /* player.onEnded — stop()·자동 종료·외부 정지(편집 종료 등) 공통 정리 */
  useEffect(
    () =>
      player.onEnded(() => {
        if (!live.current) return;
        live.current = null;
        store.getState().endRecord();
        setPhase('idle');
        setCountBeat(null);
        setRecEl(null);
      }),
    [player, store],
  );

  const start = useCallback((): void => {
    if (live.current) return;
    const { song, curM } = store.getState();
    const sps = secPerStep(song.tempo);
    const st = initRecording(song, curM);
    live.current = { st, sps, t: asSec(-COUNT_IN_BEATS * 4 * sps) };
    store.getState().beginRecord();
    setPhase('countIn');
    setCountBeat(COUNT_IN_BEATS);

    player.record(song, song.accPat !== 'off', st.startStep, (t) => {
      const r = live.current;
      if (!r) return;
      r.t = t;
      if (t < 0) {
        setCountBeat(Math.min(COUNT_IN_BEATS, Math.ceil(-t / (r.sps * 4))));
        return;
      }
      setPhase('recording');
      setCountBeat(null);
      const el = Math.min(r.st.startStep + t / r.sps, r.st.endStep);
      setRecEl(el);
      const st2 = store.getState();
      const m = measOf(st2.song, asStep(Math.min(Math.floor(el), r.st.endStep - 1)));
      if (m !== st2.curM) st2.setCurM(m);
      const { st: next, commit: spec, done } = recTick(r.st, r.sps, t);
      r.st = next;
      commit(spec);
      if (done) player.stop(); // onEnded가 정리
    });
  }, [store, player, commit]);

  const stop = useCallback((): void => {
    const r = live.current;
    if (!r) return;
    if (r.st.held) {
      const { st, commit: spec } = recKeyUp(r.st, r.sps, r.st.held.p, r.t);
      r.st = st;
      commit(spec);
    }
    player.stop(); // onEnded가 정리
  }, [player, commit]);

  const keyDown = useCallback(
    (midi: Midi): void => {
      const r = live.current;
      if (!r) return;
      player.previewDown(midi);
      const { st, commit: spec } = recKeyDown(r.st, r.sps, midi, r.t);
      r.st = st;
      commit(spec);
    },
    [player, commit],
  );

  const keyUp = useCallback(
    (midi: Midi): void => {
      const r = live.current;
      if (!r) return;
      player.previewUp(midi);
      const { st, commit: spec } = recKeyUp(r.st, r.sps, midi, r.t);
      r.st = st;
      commit(spec);
    },
    [player, commit],
  );

  const keyAbort = useCallback(
    (midi: Midi): void => {
      const r = live.current;
      if (!r) return;
      player.previewUp(midi);
      r.st = recKeyAbort(r.st, midi);
    },
    [player],
  );

  return { phase, countBeat, recEl, start, stop, keyDown, keyUp, keyAbort };
};
