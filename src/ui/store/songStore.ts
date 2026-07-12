/**
 * 곡 상태 스토어 — core의 순수 함수(editing/undo)를 감싸기만 한다 (설계 문서 §3).
 * 세션 상태(sel, curM)와 undo 스택을 함께 관리하고, restore 후 정합성을 보정한다.
 */
import { createStore } from 'zustand/vanilla';
import { demoSong } from '../../core/demo-song';
import {
  addMeasure,
  addPickup,
  cycleMeasureAcc,
  deleteSel,
  gotoMeasure,
  padTap,
  selectDir,
  setChord,
  setTempo,
  stepLen,
  stepPitch,
  stepPos,
  type EditCtx,
  type EditOut,
} from '../../core/editing';
import { measCountAll } from '../../core/geometry';
import { emptyUndo, pushUndo, redoStep, undoStep, type UndoStack } from '../../core/undo';
import {
  asBar,
  type AccPattern,
  type BarIndex,
  type Midi,
  type Note,
  type Song,
} from '../../core/types';

export interface SongStore {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
  readonly undo: UndoStack;
  readonly toast: string | null;
  readonly preview: Note | null;
  /** 반주 켜짐 (세션, SPEC §3.1) */
  readonly accOn: boolean;
  /** 메트로놈 켜짐 (세션) */
  readonly metroOn: boolean;

  padTap(pv: Midi | 'rest', st: number): void;
  stepPitch(dir: 1 | -1): void;
  stepPos(dir: 1 | -1): void;
  stepLen(dir: 1 | -1): void;
  selectDir(dir: 1 | -1): void;
  deleteSel(): void;
  addPickup(): void;
  addMeasure(): void;
  setChord(beatKey: number, chord: string | null): void;
  cycleMeasureAcc(): void;
  setTempo(v: number): void;
  /** 헤더 반주 팝오버: 패턴 = 켬 + 전역 패턴 설정, 'off' = 끔 (패턴 유지) */
  setAccGlobal(v: AccPattern | 'off'): void;
  toggleMetro(): void;
  /** 마디 탭/이동: 첫 노트 자동 선택 + 프리뷰 (SPEC §3.2) */
  gotoMeasure(m: number): void;
  /** 재생 추적: 선택·프리뷰 없이 curM만 */
  setCurM(m: number): void;
  /** 해시 로드: 곡 교체 + undo/세션 초기화 */
  loadSong(song: Song): void;
  clearToast(): void;
  undoAction(): void;
  redoAction(): void;
}

/** restore 후 정합성 보정: curM 범위 클램프, 사라진 선택 해제 (SPEC §8) */
const reconcile = (song: Song, sel: number | null, curM: BarIndex): Pick<SongStore, 'sel' | 'curM'> => ({
  sel: sel !== null && song.notes.some((n) => n.id === sel) ? sel : null,
  curM: asBar(Math.min(curM, measCountAll(song) - 1)),
});

export const createSongStore = (initial: Song = demoSong) =>
  createStore<SongStore>()((set) => {
    const apply = (op: (ctx: EditCtx) => EditOut): void =>
      set((s) => {
        const out = op({ song: s.song, sel: s.sel, curM: s.curM });
        return {
          song: out.song,
          sel: out.sel,
          curM: out.curM,
          undo: out.changed ? pushUndo(s.undo, s.song) : s.undo,
          toast: out.toast ?? null,
          preview: out.preview ?? null,
        };
      });

    return {
      song: initial,
      sel: null,
      curM: asBar(0),
      undo: emptyUndo,
      toast: null,
      preview: null,
      accOn: true,
      metroOn: false,

      padTap: (pv, st) => apply((c) => padTap(c, pv, st)),
      stepPitch: (dir) => apply((c) => stepPitch(c, dir)),
      stepPos: (dir) => apply((c) => stepPos(c, dir)),
      stepLen: (dir) => apply((c) => stepLen(c, dir)),
      selectDir: (dir) => apply((c) => selectDir(c, dir)),
      deleteSel: () => apply(deleteSel),
      addPickup: () => apply(addPickup),
      addMeasure: () => apply(addMeasure),
      setChord: (beatKey, chord) => apply((c) => setChord(c, beatKey, chord)),
      cycleMeasureAcc: () => apply(cycleMeasureAcc),
      setTempo: (v) => apply((c) => setTempo(c, v)),

      setAccGlobal: (v) =>
        set((s) => {
          if (v === 'off') return { accOn: false };
          if (s.song.accPat === v) return { accOn: true };
          return {
            accOn: true,
            song: { ...s.song, accPat: v },
            undo: pushUndo(s.undo, s.song),
          };
        }),
      toggleMetro: () => set((s) => ({ metroOn: !s.metroOn })),
      gotoMeasure: (m) => apply((c) => gotoMeasure(c, asBar(m))),
      setCurM: (m) => set({ curM: asBar(m), preview: null }),
      loadSong: (song) =>
        set({
          song,
          sel: null,
          curM: asBar(0),
          undo: emptyUndo,
          toast: null,
          preview: null,
        }),
      clearToast: () => set({ toast: null }),

      undoAction: () =>
        set((s) => {
          const r = undoStep(s.undo, s.song);
          if (!r) return s;
          return { song: r.song, undo: r.stack, ...reconcile(r.song, s.sel, s.curM) };
        }),
      redoAction: () =>
        set((s) => {
          const r = redoStep(s.undo, s.song);
          if (!r) return s;
          return { song: r.song, undo: r.stack, ...reconcile(r.song, s.sel, s.curM) };
        }),
    };
  });

/** 앱 전역 스토어 인스턴스 */
export const songStore = createSongStore();
