/**
 * 드럼 패드 (SPEC §3.5). 박 헤더(고정) / 음 행 스크롤(156px) / 쉼표 행(고정).
 * ♯행은 현재 마디에 그 음이 존재할 때만 표시. 쉼표 행은 파생 점등.
 */
import { useLayoutEffect, useRef, type JSX } from 'react';
import { BLACK_PC, NOTE_KO, PMAX, PMIN } from '../../../core/constants';
import { measLen, measStart } from '../../../core/geometry';
import { noteAt } from '../../../core/editing';
import { asMidi, type BarIndex, type Midi, type Note, type Song } from '../../../core/types';

const ROW_H = 17;
const VIEW_H = 156;
const INIT_PITCH = 72; // 초기 스크롤: 도5 부근

export interface PadProps {
  readonly song: Song;
  readonly curM: BarIndex;
  readonly sel: number | null;
  readonly onCellTap: (pv: Midi | 'rest', st: number) => void;
}

/** 표시할 행: 온음계 전체 + 현재 마디에 존재하는 ♯음 */
const padRows = (song: Song, curM: BarIndex): number[] => {
  const ms = measStart(song, curM);
  const len = measLen(song, curM);
  const rows: number[] = [];
  for (let p = PMAX; p >= PMIN; p--) {
    if (!BLACK_PC.has(p % 12)) rows.push(p);
    else if (song.notes.some((n) => n.p === p && n.s < ms + len && n.s + n.d > ms)) rows.push(p);
  }
  return rows;
};

interface CellHit {
  readonly n: Note;
  /** 마디 경계를 넘는 음의 마지막 칸 (⤳ 표시) */
  readonly tail: boolean;
}

const cellHit = (song: Song, curM: BarIndex, p: Midi, st: number): CellHit | null => {
  const ms = measStart(song, curM);
  const len = measLen(song, curM);
  const abs = ms + st;
  const n = noteAt(song, abs, p);
  if (!n) return null;
  return { n, tail: n.s + n.d > ms + len && abs === ms + len - 1 };
};

export const Pad = ({ song, curM, sel, onCellTap }: PadProps): JSX.Element => {
  const rows = padRows(song, curM);
  const len = measLen(song, curM);
  const groups = len / 4;
  const beatLabels =
    song.pickup && curM === 0 ? [3, 4] : Array.from({ length: groups }, (_, g) => g + 1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const selNote = song.notes.find((n) => n.id === sel);
    const keep = el.scrollTop;
    if (selNote && rows.indexOf(selNote.p) >= 0) {
      const y = rows.indexOf(selNote.p) * ROW_H;
      if (y < keep || y > keep + VIEW_H - ROW_H) el.scrollTop = Math.max(0, y - 60);
    } else if (!mounted.current) {
      el.scrollTop = Math.max(0, rows.indexOf(INIT_PITCH) * ROW_H - 30);
    }
    mounted.current = true;
  });

  const cells = (p: Midi | 'rest'): JSX.Element[] =>
    Array.from({ length: groups }, (_, g) => (
      <div className="grp" key={g}>
        {Array.from({ length: 4 }, (_, i) => {
          const st = g * 4 + i;
          if (p === 'rest') {
            const empty = noteAt(song, measStart(song, curM) + st) === null;
            return (
              <button
                type="button"
                key={st}
                className={`pcell${i === 0 ? ' db' : ''}${empty ? ' on' : ''}`}
                data-p="rest"
                data-st={st}
                onClick={() => onCellTap('rest', st)}
              />
            );
          }
          const dk = BLACK_PC.has(p % 12);
          const hit = cellHit(song, curM, p, st);
          const state = hit ? (hit.n.id === sel ? ' sel' : ' on') : '';
          return (
            <button
              type="button"
              key={st}
              className={`pcell${dk ? ' dk' : ''}${i === 0 ? ' db' : ''}${state}`}
              data-p={p}
              data-st={st}
              onClick={() => onCellTap(p, st)}
            >
              {hit?.tail && <span className="tie">⤳</span>}
            </button>
          );
        })}
      </div>
    ));

  return (
    <div className="pad">
      <div className="beat-head">
        {beatLabels.map((b) => (
          <div className="bh" data-beat={b} key={b}>
            <b>{b}</b>
          </div>
        ))}
      </div>
      <div className="pad-scroll" data-testid="pad-scroll" ref={scrollRef}>
        {rows.map((p) => {
          const dk = BLACK_PC.has(p % 12);
          const label = p % 12 === 0 ? `도${p / 12 - 1}` : NOTE_KO[p % 12];
          return (
            <div className="prow" data-row={p} key={p}>
              <div className={`pl${dk ? ' dk' : ''}`}>{label}</div>
              {cells(asMidi(p))}
            </div>
          );
        })}
      </div>
      <div className="prow rest">
        <div className="pl dk">쉼</div>
        {cells('rest')}
      </div>
    </div>
  );
};
