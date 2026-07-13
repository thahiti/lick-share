/**
 * 워크스페이스 오선보 (설계 §5, §4.5) — 줄바꿈 없는 한 줄 조판.
 * 피아노롤과 같은 pxPerStep 좌표를 써서 마디 경계가 픽셀 단위로 일치한다.
 * 마디폭 = SPM × pxPerStep. 각 뷰가 독립적으로 x를 계산하지 않는다(timeline.ts만 사용).
 * 글리프는 Score에서 export한 ClefPath·RestGlyph·NoteSeg를 재사용(조판 수치 중복 금지).
 */
import type { JSX } from 'react';
import { LAYOUT } from '../../../../core/constants';
import { measCountAll, measLen, measStart, pitchDia, total } from '../../../../core/geometry';
import { deriveRests } from '../../../../core/rests';
import { spanW, stepToX } from '../../../../core/timeline';
import { asBar, type Song } from '../../../../core/types';
import { ClefPath, NoteSeg, RestGlyph } from '../Score';

const { LINEGAP, PAD_X, STAFF_TOP, GUTTER_W } = LAYOUT;
/** SVG 세로 크기 (코드/덧줄/기둥 여유 포함) */
const H = 128;

export interface StaffLaneProps {
  readonly song: Song;
  /** 공유 줌 (px/step) */
  readonly pxPerStep: number;
  readonly sel: number | null;
  /** 재생 진행 스텝 (정지 시 미표시) */
  readonly playheadStep?: number;
  /** 악보 위 코드 심볼 클릭 (없으면 비인터랙티브) */
  readonly onChordTap?: (m: number, b: number) => void;
}

/** 온음계 좌표 → y (보표 최하단 선 기준) */
const diaY = (step: number): number => STAFF_TOP + 4 * LINEGAP - step * (LINEGAP / 2);

/** 덧줄: 보표 위(step>8)·아래(step<0) */
const ledgers = (id: number, step: number, x: number): JSX.Element[] => {
  const out: JSX.Element[] = [];
  const push = (L: number): void => {
    out.push(
      <line
        key={`lg-${id}-${L}`}
        data-ledger={id}
        x1={x - 8.5}
        y1={STAFF_TOP + 40 - L * 5}
        x2={x + 8.5}
        y2={STAFF_TOP + 40 - L * 5}
        stroke="var(--staff)"
        strokeWidth={1}
      />,
    );
  };
  if (step < 0) for (let L = -2; L >= 2 * Math.ceil(step / 2); L -= 2) push(L);
  else if (step > 8) for (let L = 10; L <= 2 * Math.floor(step / 2); L += 2) push(L);
  return out;
};

export const StaffLane = ({ song, pxPerStep, sel, playheadStep, onChordTap }: StaffLaneProps): JSX.Element => {
  const px = pxPerStep;
  const bodyW = stepToX(total(song), px);
  const allCnt = measCountAll(song);
  const staffTop = STAFF_TOP;

  // 오선 5선
  const staffLines = Array.from({ length: 5 }, (_, i) => (
    <line
      key={`staff-${i}`}
      x1={0}
      y1={staffTop + i * LINEGAP}
      x2={bodyW}
      y2={staffTop + i * LINEGAP}
      stroke="var(--staff)"
    />
  ));

  // 마디 세로선: 각 마디 시작 경계 + 곡 끝 닫음선 (롤과 동일 좌표)
  const barLines = [
    ...Array.from({ length: allCnt }, (_, mi) => {
      const bx = stepToX(measStart(song, asBar(mi)), px);
      return (
        <line
          key={`bar-${mi}`}
          data-bar={mi}
          x1={bx}
          y1={staffTop}
          x2={bx}
          y2={staffTop + 4 * LINEGAP}
          stroke="var(--staff)"
        />
      );
    }),
    <line
      key="bar-end"
      data-bar={allCnt}
      x1={bodyW}
      y1={staffTop}
      x2={bodyW}
      y2={staffTop + 4 * LINEGAP}
      stroke="var(--staff)"
    />,
  ];

  // 코드 심볼 (마디 위) — 있는 코드만, 클릭 시 피커
  const chordLayers: JSX.Element[] = [];
  for (let mi = 0; mi < allCnt; mi++) {
    const m = asBar(mi);
    const beats = measLen(song, m) / 4;
    const base = measStart(song, m) / 4;
    for (let b = 0; b < beats; b++) {
      const ch = song.chords[base + b];
      if (!ch) continue;
      const cx = stepToX(measStart(song, m) + b * 4, px);
      chordLayers.push(
        <text
          key={`chord-${mi}-${b}`}
          data-chord={`${mi}:${b}`}
          x={cx}
          y={staffTop - 24}
          fontSize={10.5}
          fontStyle="italic"
          fontFamily="var(--font-chord)"
          fill="var(--chord-text)"
          style={onChordTap ? { cursor: 'pointer' } : undefined}
          onClick={onChordTap ? () => onChordTap(mi, b) : undefined}
        >
          {ch}
        </text>,
      );
    }
  }

  // 음표: 머리 = 블록 중앙 (stepToX(s) + spanW(d)/2), 롤 블록과 정렬
  const noteLayers = song.notes.map((n) => {
    const hx = stepToX(n.s, px) + spanW(n.d, px) / 2;
    const pd = pitchDia(n.p);
    const yy = diaY(pd.step);
    const selected = n.id === sel;
    const color = selected ? 'var(--brand-primary)' : 'var(--ink)';
    return (
      <g key={`note-${n.id}`} data-note={n.id} data-sel={selected} data-hx={hx} style={{ pointerEvents: 'none' }}>
        {ledgers(n.id, pd.step, hx)}
        {pd.acc && (
          <text x={hx - 16} y={yy + 3.5} fontSize={12} fill="var(--brand-primary)" fontWeight={700}>
            ♯
          </text>
        )}
        <NoteSeg x={hx} y={yy} d16={n.d} color={color} selected={selected} stemDown={pd.step >= 4} />
      </g>
    );
  });

  // 쉼표 (파생) — 빈 구간 중앙
  const restLayers = deriveRests(song).map((r, i) => {
    const rx = stepToX(measStart(song, r.m) + r.at, px) + spanW(r.take, px) / 2;
    const len = measLen(song, r.m);
    return (
      <RestGlyph key={`rest-${i}`} x={rx} top={staffTop} take={r.take === 16 && len < 16 ? 8 : r.take} />
    );
  });

  const playhead = ((): JSX.Element | null => {
    if (playheadStep === undefined) return null;
    const phx = stepToX(Math.min(playheadStep, total(song)), px);
    return (
      <g data-playhead="">
        <line x1={phx} y1={staffTop - 34} x2={phx} y2={staffTop + 64} stroke="var(--playhead)" strokeWidth={2} />
        <circle cx={phx} cy={staffTop - 34} r={3.5} fill="var(--playhead)" />
      </g>
    );
  })();

  return (
    <div className="sl">
      <div className="sl-gutter">
        <svg width={GUTTER_W} height={H} viewBox={`0 0 ${GUTTER_W} ${H}`} aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`g-staff-${i}`}
              x1={0}
              y1={staffTop + i * LINEGAP}
              x2={GUTTER_W}
              y2={staffTop + i * LINEGAP}
              stroke="var(--staff)"
            />
          ))}
          <line x1={PAD_X} y1={staffTop} x2={PAD_X} y2={staffTop + 4 * LINEGAP} stroke="var(--staff)" />
          <ClefPath x={PAD_X} top={staffTop} />
        </svg>
      </div>
      <svg className="sl-body" width={bodyW} height={H} viewBox={`0 0 ${bodyW} ${H}`}>
        {staffLines}
        {barLines}
        {chordLayers}
        {restLayers}
        {noteLayers}
        {playhead}
      </svg>
    </div>
  );
};
