/**
 * 전곡 피아노롤 (데스크톱 DAW). 배경 셀 그리드 + 길이 스팬 노트 블록 + 플레이헤드.
 * 클릭 의미론은 모바일 패드와 동일 — 셀/블록 클릭을 padTapAt(m, pv, st)으로 위임.
 * 쉼표 행 없음: 삭제는 선택 후 재클릭 또는 Delete (쉼표는 파생, SPEC §5).
 */
import { useLayoutEffect, useRef, type JSX } from 'react';
import { BLACK_PC, NOTE_EN, PMAX, PMIN } from '../../../../core/constants';
import { measCountAll, measLen, measOf, measStart, total } from '../../../../core/geometry';
import { asBar, asMidi, type Midi, type Song } from '../../../../core/types';

const ROW_H = 18;
const VIEW_H = 320;
const INIT_PITCH = 72; // 초기 스크롤: 도5 부근

export interface PianoRollProps {
  readonly song: Song;
  readonly sel: number | null;
  /** 재생 중 플레이헤드 스텝 (미지정 시 미표시) */
  readonly playheadStep?: number;
  readonly onCellTap: (m: number, pv: Midi | 'rest', st: number) => void;
}

/** 행: 흰건반 전체 + 곡 전체에 존재하는 ♯음 (모바일 padRows의 전곡 버전) */
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

export const PianoRoll = ({ song, sel, playheadStep, onCellTap }: PianoRollProps): JSX.Element => {
  const rows = rollRows(song);
  const T = total(song);
  const mCount = measCountAll(song);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  /* 선택 노트 따라 세로 스크롤 (모바일 Pad와 동일 패턴) */
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

  /* 배경 셀: 마디×스텝 전부 명시 배치 (블록과 겹쳐도 자리 밀림 없음) */
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

  /* 노트 블록: 길이만큼 컬럼 스팬, 클릭 = 시작 칸 padTap (선택/재클릭 삭제) */
  const blocks = song.notes.map((n) => {
    const ri = rows.indexOf(n.p);
    if (ri < 0) return null;
    const m = Math.min(mCount - 1, measOf(song, n.s));
    const st = n.s - measStart(song, asBar(m));
    return (
      <button
        type="button"
        key={n.id}
        className={`roll-note${n.id === sel ? ' sel' : ''}`}
        style={{ gridRow: ri + 1, gridColumn: `${n.s + 1} / span ${n.d}` }}
        data-note={n.id}
        aria-label={`Note ${rowLabel(n.p)}`}
        onClick={() => onCellTap(m, n.p, st)}
      />
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
              gridTemplateColumns: `repeat(${T}, minmax(12px, 1fr))`,
              gridTemplateRows: `repeat(${rows.length}, ${ROW_H}px)`,
            }}
          >
            {cells}
            {blocks}
            {playheadStep !== undefined && (
              <div className="roll-playhead" style={{ left: `${(playheadStep / T) * 100}%` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
