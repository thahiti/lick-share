/**
 * 워크스페이스 피아노롤 (설계 §5, §6.1) — 고정 pxPerStep 좌표.
 * 그리드 폭 = total × pxPerStep. 셀/블록은 timeline.ts 변환만 사용해
 * 악보(StaffLane)와 마디 경계가 픽셀 단위로 일치한다.
 * 클릭 의미론은 기존 유지(padTapAt). 드래그 편집은 pointerup에 dragNote를
 * 1회만 호출해 단일 undo 엔트리로 커밋한다(설계 §6.1).
 */
import { useLayoutEffect, useRef, useState, type JSX, type PointerEvent } from 'react';
import { BLACK_PC, NOTE_EN, PMAX, PMIN } from '../../../../core/constants';
import { measCountAll, measLen, measOf, measStart, total } from '../../../../core/geometry';
import { spanW, stepToX } from '../../../../core/timeline';
import { asBar, asMidi, type Midi, type Song } from '../../../../core/types';

const ROW_H = 18;
const VIEW_H = 320;
const INIT_PITCH = 72; // 초기 스크롤: 도5 부근
const DRAG_THRESH = 3; // px — 이하 이동은 클릭으로 처리
const RESIZE_EDGE = 6; // px — 우측 리사이즈 핸들 폭

export interface PianoRollProps {
  readonly song: Song;
  /** 공유 줌 (px/step) */
  readonly pxPerStep: number;
  readonly sel: number | null;
  /** 재생 중 플레이헤드 스텝 (미지정 시 미표시) */
  readonly playheadStep?: number;
  readonly onCellTap: (m: number, pv: Midi | 'rest', st: number) => void;
  /** 드래그 커밋 (pointerup 단일 undo) */
  readonly onDragNote: (id: number, patch: { s?: number; p?: Midi; d?: number }) => void;
}

/** 행: 흰건반 전체 + 곡 전체에 존재하는 ♯음 */
const rollRows = (song: Song): number[] => {
  const rows: number[] = [];
  for (let p = PMAX; p >= PMIN; p--) {
    if (!BLACK_PC.has(p % 12)) rows.push(p);
    else if (song.notes.some((n) => n.p === p)) rows.push(p);
  }
  return rows;
};

const rowLabel = (p: number): string =>
  p % 12 === 0 ? `C${p / 12 - 1}` : (NOTE_EN[p % 12] ?? '');

interface DragRef {
  id: number;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  startS: number;
  startD: number;
  startP: number;
  riStart: number;
  moved: boolean;
}

interface Preview {
  readonly id: number;
  readonly s: number;
  readonly p: number;
  readonly d: number;
}

export const PianoRoll = ({
  song,
  pxPerStep,
  sel,
  playheadStep,
  onCellTap,
  onDragNote,
}: PianoRollProps): JSX.Element => {
  const px = pxPerStep;
  const rows = rollRows(song);
  const bodyW = stepToX(total(song), px);
  const mCount = measCountAll(song);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const dragRef = useRef<DragRef | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  /* 선택 노트 따라 세로 스크롤 (기존 패턴 재사용) */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const selNote = song.notes.find((n) => n.id === sel);
    const keep = el.scrollTop;
    if (selNote && rows.indexOf(selNote.p) >= 0) {
      const y = rows.indexOf(selNote.p) * ROW_H;
      if (y < keep || y > keep + VIEW_H - ROW_H) el.scrollTop = Math.max(0, y - 90);
    } else if (!mounted.current) {
      el.scrollTop = Math.max(0, rows.indexOf(INIT_PITCH) * ROW_H - 60);
    }
    mounted.current = true;
  });

  const onDown = (e: PointerEvent<HTMLButtonElement>, id: number, s: number, d: number, p: number): void => {
    const mode = (e.target as HTMLElement).dataset.resize !== undefined ? 'resize' : 'move';
    dragRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startS: s,
      startD: d,
      startP: p,
      riStart: rows.indexOf(p),
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom·미지원 환경 무시 */
    }
    e.preventDefault();
  };

  const onMove = (e: PointerEvent<HTMLButtonElement>): void => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) >= DRAG_THRESH || Math.abs(dy) >= DRAG_THRESH) d.moved = true;
    const dSteps = Math.round(dx / px);
    if (d.mode === 'resize') {
      setPreview({ id: d.id, s: d.startS, p: d.startP, d: Math.max(1, d.startD + dSteps) });
    } else {
      const dRows = Math.round(dy / ROW_H);
      const ri = Math.max(0, Math.min(rows.length - 1, d.riStart + dRows));
      setPreview({ id: d.id, s: Math.max(0, d.startS + dSteps), p: rows[ri] as number, d: d.startD });
    }
  };

  const onUp = (e: PointerEvent<HTMLButtonElement>): void => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    const note = song.notes.find((n) => n.id === d.id);
    if (d.moved && note) {
      if (d.mode === 'resize') onDragNote(d.id, { d: preview?.d ?? d.startD });
      else onDragNote(d.id, { s: preview?.s ?? d.startS, p: asMidi(preview?.p ?? d.startP) });
    } else if (note) {
      // 임계값 미만 = 클릭: 시작 셀 padTap (선택/재클릭 삭제)
      const m = Math.min(mCount - 1, measOf(song, note.s));
      const st = note.s - measStart(song, asBar(m));
      onCellTap(m, note.p, st);
    }
    setPreview(null);
  };

  /* 배경 셀: 마디×스텝 명시 배치 (마디 경계 굵은 선 / 박 얇은 선) */
  const cells: JSX.Element[] = [];
  rows.forEach((p, ri) => {
    const dk = BLACK_PC.has(p % 12);
    for (let m = 0; m < mCount; m++) {
      const ms = measStart(song, asBar(m));
      const len = measLen(song, asBar(m));
      for (let st = 0; st < len; st++) {
        const abs = ms + st;
        cells.push(
          <button
            type="button"
            key={`${p}:${abs}`}
            className={`rcell${dk ? ' dk' : ''}${st % 4 === 0 ? ' db' : ''}${st === 0 ? ' mb' : ''}`}
            style={{ gridRow: ri + 1, gridColumn: abs + 1 }}
            data-m={m}
            data-p={p}
            data-st={st}
            aria-label={`${rowLabel(p)} bar ${m + 1} cell ${st + 1}`}
            onClick={() => onCellTap(m, asMidi(p), st)}
          />,
        );
      }
    }
  });

  /* 노트 블록: 절대 배치 (드래그 중엔 프리뷰 좌표) */
  const blocks = song.notes.map((n) => {
    const view = preview && preview.id === n.id ? preview : { s: n.s, p: n.p, d: n.d };
    const ri = rows.indexOf(view.p);
    if (ri < 0) return null;
    return (
      <button
        type="button"
        key={n.id}
        className={`roll-note${n.id === sel ? ' sel' : ''}`}
        style={{
          position: 'absolute',
          left: stepToX(view.s, px),
          top: ri * ROW_H,
          width: spanW(view.d, px),
          height: ROW_H,
        }}
        data-note={n.id}
        aria-label={`Note ${rowLabel(n.p)}`}
        onPointerDown={(e) => onDown(e, n.id, n.s, n.d, n.p)}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <span data-resize className="roll-resize" style={{ width: RESIZE_EDGE }} />
      </button>
    );
  });

  return (
    <div className="roll">
      <div className="roll-scroll" data-testid="roll-scroll" ref={scrollRef}>
        <div className="roll-body">
          <div className="roll-labels">
            {rows.map((p) => (
              <div className={`rlab${BLACK_PC.has(p % 12) ? ' dk' : ''}`} data-row={p} key={p}>
                {rowLabel(p)}
              </div>
            ))}
          </div>
          <div
            className="roll-grid"
            style={{
              position: 'relative',
              width: bodyW,
              gridTemplateColumns: `repeat(${total(song)}, ${px}px)`,
              gridTemplateRows: `repeat(${rows.length}, ${ROW_H}px)`,
            }}
          >
            {cells}
            {blocks}
            {playheadStep !== undefined && (
              <div className="roll-playhead" style={{ left: stepToX(playheadStep, px) }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
