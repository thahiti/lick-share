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
  insertAtFreeBeat,
  insertRecorded,
  letterPitch,
  padTap,
  renoteSel,
  selectDir,
  setChord,
  setNoteLen,
  setTempo,
  stepLen,
  stepPitch,
  stepPos,
  updateNote,
  type EditCtx,
  type EditOut,
} from '../../core/editing';
import { INPUT_LEN } from '../../core/constants';
import { measCountAll } from '../../core/geometry';
import { emptyUndo, pushUndo, redoStep, undoStep, type UndoStack } from '../../core/undo';
import {
  asBar,
  asMidi,
  type BarIndex,
  type MeasureAcc,
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
  /** 새 음 입력 시 기본 길이 (세션, 워크스페이스 음길이 세그먼트) */
  readonly inputLen: number;
  /** 레코딩 테이크: off=아님, clean=시작(커밋 전), dirty=커밋 있음 (undo push는 첫 커밋 1회) */
  readonly recTake: 'off' | 'clean' | 'dirty';

  padTap(pv: Midi | 'rest', st: number): void;
  /** 지정 마디 기준 padTap — 전곡 피아노롤용 (단일 undo 엔트리) */
  padTapAt(m: number, pv: Midi | 'rest', st: number): void;
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
  /** 헤더 반주 팝오버: 전역 반주 패턴 설정 ('off'=반주 없음). 값이 곧 곡 데이터 */
  setAccGlobal(v: MeasureAcc): void;
  /** 메트로놈 패턴 토글: 곡의 metro를 'off'↔'quarter'로 전환 (곡 데이터, undo 대상) */
  toggleMetro(): void;
  /** 마디 탭/이동: 첫 노트 자동 선택 + 프리뷰 (SPEC §3.2) */
  gotoMeasure(m: number): void;
  /** 재생 추적: 선택·프리뷰 없이 curM만 */
  setCurM(m: number): void;
  /** 재생 추적: 현재 재생 음을 선택 — 프리뷰 없이 sel만 (소리 중복 방지) */
  setSel(id: number): void;
  /** 해시 로드: 곡 교체 + undo/세션 초기화 */
  loadSong(song: Song): void;
  showToast(msg: string): void;
  clearToast(): void;
  undoAction(): void;
  redoAction(): void;

  // ── 레코딩 (piano-recording-design §2.4) ──
  /** 레코딩 시작: 선택·프리뷰 해제. undo push는 첫 recordCommit이 담당 */
  beginRecord(): void;
  /** 양자화된 노트 삽입 + 겹침 해소. undo push는 테이크 첫 커밋만 1회 */
  recordCommit(spec: Pick<Note, 's' | 'd' | 'p'>): void;
  endRecord(): void;

  // ── 데스크톱 워크스페이스 ──
  /** 드래그 편집 커밋 (이동·피치·리사이즈, pointerup 단일 undo) */
  dragNote(id: number, patch: { s?: number; p?: Midi; d?: number }): void;
  /** 음길이 세그먼트: inputLen 세션 갱신 + 선택 노트가 있으면 길이 설정 */
  setLen(len: number): void;
  /** A~G 입력: 선택 있으면 재배치, 없으면 다음 빈 박에 입력 */
  noteLetter(letter: string): void;
  /** 건반 클릭: 지정 피치를 다음 빈 박에 입력 */
  keyTap(p: Midi): void;
  /** 제목 설정 (메타데이터 — undo 스택에 쌓지 않음) */
  setTitle(title: string): void;
}

/** restore 후 정합성 보정: curM 범위 클램프, 사라진 선택 해제 (SPEC §8) */
const reconcile = (song: Song, sel: number | null, curM: BarIndex): Pick<SongStore, 'sel' | 'curM'> => ({
  sel: sel !== null && song.notes.some((n) => n.id === sel) ? sel : null,
  curM: asBar(Math.min(curM, measCountAll(song) - 1)),
});

export const createSongStore = (initial: Song = demoSong) =>
  createStore<SongStore>()((set) => {
    // EditOut → 스토어 부분 상태 (changed일 때만 undo push). apply와 조건부 액션이 공유
    const applyOut = (s: SongStore, out: EditOut): Partial<SongStore> => ({
      song: out.song,
      sel: out.sel,
      curM: out.curM,
      undo: out.changed ? pushUndo(s.undo, s.song) : s.undo,
      toast: out.toast ?? null,
      preview: out.preview ?? null,
    });
    const apply = (op: (ctx: EditCtx) => EditOut): void =>
      set((s) => applyOut(s, op({ song: s.song, sel: s.sel, curM: s.curM })));

    return {
      song: initial,
      sel: null,
      curM: asBar(0),
      undo: emptyUndo,
      toast: null,
      preview: null,
      inputLen: INPUT_LEN,
      recTake: 'off',

      padTap: (pv, st) => apply((c) => padTap(c, pv, st)),
      padTapAt: (m, pv, st) => apply((c) => padTap({ ...c, curM: asBar(m) }, pv, st)),
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
        set((s) =>
          s.song.accPat === v
            ? s
            : { song: { ...s.song, accPat: v }, undo: pushUndo(s.undo, s.song) },
        ),
      dragNote: (id, patch) => apply((c) => updateNote(c, id, patch)),
      setLen: (len) => {
        set({ inputLen: len });
        apply((c) => setNoteLen(c, len));
      },
      noteLetter: (letter) =>
        set((s) => {
          const ctx: EditCtx = { song: s.song, sel: s.sel, curM: s.curM };
          // 선택이 있으면 재배치, 없으면 직전 노트(없으면 C5=72) 옥타브 기준 빈 박 입력
          if (s.sel !== null) return applyOut(s, renoteSel(ctx, letter));
          const ref = [...s.song.notes].sort((a, b) => b.s - a.s)[0]?.p ?? asMidi(72);
          const p = letterPitch(ref, letter);
          return applyOut(s, insertAtFreeBeat(ctx, p, s.inputLen));
        }),
      keyTap: (p) =>
        set((s) =>
          applyOut(s, insertAtFreeBeat({ song: s.song, sel: s.sel, curM: s.curM }, p, s.inputLen)),
        ),
      setTitle: (title) => set((s) => ({ song: { ...s.song, title } })),
      toggleMetro: () =>
        set((s) => ({
          song: { ...s.song, metro: s.song.metro === 'off' ? 'quarter' : 'off' },
          undo: pushUndo(s.undo, s.song),
        })),
      gotoMeasure: (m) => apply((c) => gotoMeasure(c, asBar(m))),
      setCurM: (m) => set({ curM: asBar(m), preview: null }),
      setSel: (id) => set({ sel: id, preview: null }),
      loadSong: (song) =>
        set({
          song,
          sel: null,
          curM: asBar(0),
          undo: emptyUndo,
          toast: null,
          preview: null,
        }),
      showToast: (msg) => set({ toast: msg }),
      clearToast: () => set({ toast: null }),

      beginRecord: () => set({ recTake: 'clean', sel: null, preview: null, toast: null }),
      recordCommit: (spec) =>
        set((s) =>
          s.recTake === 'off'
            ? s
            : {
                song: insertRecorded(s.song, spec),
                undo: s.recTake === 'clean' ? pushUndo(s.undo, s.song) : s.undo,
                recTake: 'dirty',
              },
        ),
      endRecord: () => set({ recTake: 'off' }),

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
