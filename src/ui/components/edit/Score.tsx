/**
 * 악보 (SPEC §3.2, §4). 음자리표·쉼표·음표 전부 SVG 패스 직접 드로잉 (SMP 문자 금지).
 * edit: 현재 마디가 속한 한 줄만 + 음영 + 마디 탭 내비게이션 (음표 개별 탭 불가).
 * view: 전체 멀티라인 + 음표 탭.
 */
import type { JSX } from 'react';
import { LAYOUT } from '../../../core/constants';
import {
  computeMw,
  lineOf,
  measCountAll,
  measLen,
  measOf,
  measStart,
  measW,
  measX,
  pitchDia,
  posX,
  total,
} from '../../../core/geometry';
import { deriveRests } from '../../../core/rests';
import { asBar, asStep, type BarIndex, type Note, type Song } from '../../../core/types';

const { LH, LINEGAP, PAD_X } = LAYOUT;

export interface ScoreProps {
  readonly song: Song;
  readonly mode: 'edit' | 'view';
  /** edit 모드 현재 마디 (라인 선택 + 음영) */
  readonly curM?: BarIndex;
  /** edit 모드 선택 노트 (레드 강조) */
  readonly sel?: number | null;
  /** 재생 진행 스텝 (정지 시 undefined) */
  readonly playheadStep?: number;
  readonly width?: number;
  readonly onMeasureTap?: (m: number) => void;
  readonly onNoteTap?: (id: number) => void;
}

const ClefPath = ({ x, top }: { x: number; top: number }): JSX.Element => (
  <g stroke="var(--ink)" strokeWidth={1.5} fill="none">
    <path
      d={`M ${x + 8} ${top - 5} C ${x + 12} ${top} ${x + 12} ${top + 6} ${x + 8} ${top + 11}
          C ${x + 3} ${top + 17} ${x + 2} ${top + 24} ${x + 6} ${top + 29}
          C ${x + 10} ${top + 34} ${x + 16} ${top + 31} ${x + 15.5} ${top + 26}
          C ${x + 15} ${top + 21} ${x + 9} ${top + 21} ${x + 8} ${top + 25}`}
    />
    <line x1={x + 8} y1={top - 5} x2={x + 9.5} y2={top + 36} />
    <circle cx={x + 8.5} cy={top + 37} r={1.9} fill="var(--ink)" stroke="none" />
  </g>
);

/** 쉼표 글리프: 16=온, 8=2분, 4=4분, 2=8분, 1=16분 */
const RestGlyph = ({ x, top, take }: { x: number; top: number; take: number }): JSX.Element => {
  const c = 'var(--rest-glyph)';
  if (take === 16)
    return <rect data-rest={16} x={x - 4} y={top + 10.5} width={9} height={3.4} fill={c} />;
  if (take === 8)
    return <rect data-rest={8} x={x - 4} y={top + 16.2} width={9} height={3.4} fill={c} />;
  if (take === 4)
    return (
      <path
        data-rest={4}
        d={`M ${x - 2} ${top + 12} l 4.2 5 c -2.8 2.4 -2.8 4.8 0 7.2 c -4.2 -1.4 -5.6 1.6 -2.4 4.8 c -4.6 -1.8 -5 -6.2 -0.9 -7.2 c -3.2 -2.4 -3.2 -6.6 -0.9 -9.8`}
        fill="none"
        stroke={c}
        strokeWidth={1.6}
      />
    );
  /* 8분(1고리)/16분(2고리): 기둥 + 고리 */
  const hooks = take === 2 ? 1 : 2;
  const y1 = top + 13;
  const y2 = y1 + 11 + (hooks - 1) * 3;
  return (
    <g data-rest={take}>
      <line x1={x + 4} y1={y1} x2={x + 0.5} y2={y2} stroke={c} strokeWidth={1.4} />
      {Array.from({ length: hooks }, (_, i) => {
        const f = i * 0.32;
        const hx = x + 4 + (0.5 - 4) * f;
        const hy = y1 + (y2 - y1) * f + 0.5;
        return (
          <g key={i}>
            <circle cx={hx - 4.6} cy={hy + 1.6} r={1.8} fill={c} />
            <path
              d={`M ${hx - 4.2} ${hy + 2.4} q 2.6 1.6 4.6 -0.6`}
              fill="none"
              stroke={c}
              strokeWidth={1.3}
            />
          </g>
        );
      })}
    </g>
  );
};

/** 음표 세그먼트: 머리·기둥·꼬리·점 (덧줄·임시표는 호출부에서) */
const NoteSeg = ({
  x,
  y,
  d16,
  color,
  selected,
  stemDown,
}: {
  x: number;
  y: number;
  d16: number;
  color: string;
  selected: boolean;
  stemDown: boolean;
}): JSX.Element => {
  const open = d16 >= 8;
  const dot = d16 === 3 || d16 === 6 || d16 === 12;
  const flags = d16 === 1 ? 2 : d16 === 2 || d16 === 3 ? 1 : 0;
  const sx = stemDown ? x - 5.3 : x + 5.3;
  const y2 = stemDown ? y + 26 : y - 26;
  return (
    <g>
      {selected && <circle cx={x} cy={y} r={11} fill="var(--red)" opacity={0.12} />}
      {open ? (
        <ellipse cx={x} cy={y} rx={5.4} ry={4} fill="none" stroke={color} strokeWidth={1.4} />
      ) : (
        <ellipse cx={x} cy={y} rx={5.2} ry={3.9} fill={color} />
      )}
      {d16 < 16 && (
        <line
          x1={sx}
          y1={y + (stemDown ? 1 : -1)}
          x2={sx}
          y2={y2}
          stroke={color}
          strokeWidth={1.4}
        />
      )}
      {d16 < 16 &&
        Array.from({ length: flags }, (_, i) => (
          <path
            key={i}
            d={
              stemDown
                ? `M ${sx} ${y2 - i * 5} c 6 -2 7 -6 4 -11`
                : `M ${sx} ${y2 + i * 5} c 6 2 7 6 4 11`
            }
            fill="none"
            stroke={color}
            strokeWidth={1.4}
          />
        ))}
      {dot && <circle cx={x + 10} cy={y - 3} r={1.7} fill={color} />}
    </g>
  );
};

interface SegEnd {
  readonly x: number;
  readonly y: number;
  readonly line: number;
}

export const Score = ({
  song,
  mode,
  curM,
  sel = null,
  playheadStep,
  width = 384,
  onMeasureTap,
  onNoteTap,
}: ScoreProps): JSX.Element => {
  const mw = computeMw(song, width);
  const single = mode === 'edit';
  const allCnt = measCountAll(song);
  const editLine = single && curM !== undefined ? lineOf(song, curM) : 0;
  const lineCount = single ? 1 : lineOf(song, asBar(allCnt - 1)) + 1;
  const height = lineCount * LH + 8;
  const topFor = (m: BarIndex): number => (single ? 0 : lineOf(song, m)) * LH + 42;
  const inLine = (m: BarIndex): boolean => !single || lineOf(song, m) === editLine;

  const linesToDraw = single ? [editLine] : Array.from({ length: lineCount }, (_, i) => i);

  const lineLayers = linesToDraw.map((li) => {
    const top = (single ? 0 : li) * LH + 42;
    const measures: BarIndex[] = [];
    for (let m = 0; m < allCnt; m++) {
      if (lineOf(song, asBar(m)) === li) measures.push(asBar(m));
    }
    if (measures.length === 0) return null;
    const right = Math.max(...measures.map((m) => measX(song, mw, m) + measW(song, mw, m)));
    const shade = single && curM !== undefined && lineOf(song, curM) === li ? curM : null;

    return (
      <g key={`line-${li}`}>
        {shade !== null && (
          <g data-shade={shade}>
            <rect
              x={measX(song, mw, shade)}
              y={top - 34}
              width={measW(song, mw, shade)}
              height={98}
              fill="var(--red)"
              opacity={0.055}
            />
            <line
              x1={measX(song, mw, shade)}
              y1={top - 34}
              x2={measX(song, mw, shade)}
              y2={top + 64}
              stroke="var(--red)"
              strokeWidth={1.5}
              opacity={0.75}
            />
            <line
              x1={measX(song, mw, shade) + measW(song, mw, shade)}
              y1={top - 34}
              x2={measX(song, mw, shade) + measW(song, mw, shade)}
              y2={top + 64}
              stroke="var(--red)"
              strokeWidth={1.5}
              opacity={0.75}
            />
          </g>
        )}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`staff-${i}`}
            x1={PAD_X}
            y1={top + i * LINEGAP}
            x2={right}
            y2={top + i * LINEGAP}
            stroke="var(--staff)"
          />
        ))}
        <line x1={PAD_X} y1={top} x2={PAD_X} y2={top + 4 * LINEGAP} stroke="var(--staff)" />
        {measures.map((m) => {
          const bx = measX(song, mw, m) + measW(song, mw, m);
          return (
            <line
              key={`bar-${m}`}
              x1={bx}
              y1={top}
              x2={bx}
              y2={top + 4 * LINEGAP}
              stroke="var(--staff)"
            />
          );
        })}
        <ClefPath x={PAD_X} top={top} />
        {measures.flatMap((m) => {
          const beats = measLen(song, m) / 4;
          const baseBeat = measStart(song, m) / 4;
          return Array.from({ length: beats }, (_, b) => {
            const ch = song.chords[baseBeat + b];
            if (!ch) return null;
            return (
              <text
                key={`chord-${m}-${b}`}
                x={posX(song, mw, m, b / beats) - 5}
                y={top - 24}
                fontSize={10.5}
                fontStyle="italic"
                fontFamily="var(--font-chord)"
                fill="var(--chord-text)"
              >
                {ch}
              </text>
            );
          });
        })}
        {single &&
          measures.map((m) => (
            <rect
              key={`mhit-${m}`}
              data-m={m}
              x={measX(song, mw, m)}
              y={top - 34}
              width={measW(song, mw, m)}
              height={98}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onMeasureTap?.(m)}
            />
          ))}
      </g>
    );
  });

  const noteLayers: JSX.Element[] = [...song.notes]
    .sort((a, b) => a.s - b.s)
    .flatMap((n: Note) => {
      const segs: JSX.Element[] = [];
      let s0: number = n.s;
      let rem = n.d;
      let segIdx = 0;
      let prevEnd: SegEnd | null = null;
      while (rem > 0) {
        const m = measOf(song, asStep(s0));
        const segLen = Math.min(rem, measStart(song, m) + measLen(song, m) - s0);
        if (inLine(m)) {
          const top = topFor(m);
          const x = posX(song, mw, m, (s0 - measStart(song, m)) / measLen(song, m));
          const pd = pitchDia(n.p);
          const yy = top + 4 * LINEGAP - pd.step * (LINEGAP / 2);
          const selected = single && n.id === sel;
          const color = selected ? 'var(--red)' : 'var(--ink)';

          const ledgers: JSX.Element[] = [];
          if (pd.step < 0) {
            const lo = 2 * Math.ceil(pd.step / 2);
            for (let L = -2; L >= lo; L -= 2) {
              ledgers.push(
                <line
                  key={`lg-${L}`}
                  data-ledger={n.id}
                  x1={x - 8.5}
                  y1={top + 40 - L * 5}
                  x2={x + 8.5}
                  y2={top + 40 - L * 5}
                  stroke="var(--staff)"
                  strokeWidth={1}
                />,
              );
            }
          } else if (pd.step > 8) {
            const hi = 2 * Math.floor(pd.step / 2);
            for (let L = 10; L <= hi; L += 2) {
              ledgers.push(
                <line
                  key={`lg-${L}`}
                  data-ledger={n.id}
                  x1={x - 8.5}
                  y1={top + 40 - L * 5}
                  x2={x + 8.5}
                  y2={top + 40 - L * 5}
                  stroke="var(--staff)"
                  strokeWidth={1}
                />,
              );
            }
          }

          const glyph = (
            <NoteSeg x={x} y={yy} d16={segLen} color={color} selected={selected} stemDown={pd.step >= 4} />
          );
          segs.push(
            <g key={`seg-${n.id}-${segIdx}`}>
              {ledgers}
              {pd.acc && (
                <text x={x - 16} y={yy + 3.5} fontSize={12} fill="var(--red)" fontWeight={700}>
                  ♯
                </text>
              )}
              {mode === 'view' ? (
                <g data-note={n.id} style={{ cursor: 'pointer' }} onClick={() => onNoteTap?.(n.id)}>
                  {glyph}
                </g>
              ) : (
                /* SPEC §3.2: edit에서 음표 개별 탭 불가 — 마디 히트영역이 탭을 받도록 통과 */
                <g style={{ pointerEvents: 'none' }}>{glyph}</g>
              )}
              {prevEnd !== null && prevEnd.line === lineOf(song, m) && (
                <path
                  data-tie=""
                  d={`M ${prevEnd.x + 6} ${prevEnd.y + 7} Q ${(prevEnd.x + x) / 2} ${prevEnd.y + 14} ${x - 5} ${yy + 7}`}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.1}
                />
              )}
            </g>,
          );
          prevEnd = { x, y: yy, line: lineOf(song, m) };
        } else {
          prevEnd = null;
        }
        s0 += segLen;
        rem -= segLen;
        segIdx++;
      }
      return segs;
    });

  const restLayers = deriveRests(song)
    .filter((r) => inLine(r.m))
    .map((r, i) => {
      const len = measLen(song, r.m);
      return (
        <RestGlyph
          key={`rest-${i}`}
          x={posX(song, mw, r.m, r.at / len)}
          top={topFor(r.m)}
          take={r.take === 16 && len < 16 ? 8 : r.take}
        />
      );
    });

  const playhead = (() => {
    if (playheadStep === undefined) return null;
    const m = measOf(song, asStep(Math.min(playheadStep, total(song) - 0.001)));
    if (!inLine(m)) return null;
    const top = topFor(m);
    const x = posX(song, mw, m, (playheadStep - measStart(song, m)) / measLen(song, m));
    return (
      <g data-playhead="">
        <line x1={x} y1={top - 34} x2={x} y2={top + 64} stroke="var(--red)" strokeWidth={2} />
        <path d={`M ${x - 4} ${top - 34} L ${x + 4} ${top - 34} L ${x} ${top - 28} Z`} fill="var(--red)" />
      </g>
    );
  })();

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%">
      {lineLayers}
      {noteLayers}
      {restLayers}
      {playhead}
    </svg>
  );
};
