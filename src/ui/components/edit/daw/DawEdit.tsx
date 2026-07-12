/**
 * 데스크톱 DAW 편집 화면 조립 (설계 문서 P11 v2 §6).
 * 트랜스포트 바 / (코드 레일 + 피아노롤 | 인스펙터) / 오선 악보 / 상태 바.
 * 상태·핸들러는 App이 소유하고 여기는 배치만 담당한다.
 */
import type { JSX, RefObject } from 'react';
import { measCountAll } from '../../../../core/geometry';
import type { AccPattern, BarIndex, Midi, Song } from '../../../../core/types';
import { ChordPicker } from '../ChordPicker';
import { Score } from '../Score';
import { ChordRail } from './ChordRail';
import { DawTopBar } from './DawTopBar';
import { Inspector } from './Inspector';
import { PianoRoll } from './PianoRoll';
import '../../../../styles/daw.css';

export interface DawEditProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
  readonly accOn: boolean;
  readonly metroOn: boolean;
  readonly playing: boolean;
  readonly playEl: number | null;
  /** 코드 피커가 열린 박 (curM 기준) */
  readonly cpBeat: number | null;
  readonly scoreW: number;
  /** 악보 패널 폭 측정용 (App의 ResizeObserver 대상) */
  readonly scoreRef: RefObject<HTMLDivElement | null>;

  readonly onCellTap: (m: number, pv: Midi | 'rest', st: number) => void;
  readonly onSlotTap: (m: number, b: number) => void;
  readonly onPickerApply: (ch: string) => void;
  readonly onPickerClear: () => void;
  readonly onPickerDone: () => void;
  readonly onMeasureTap: (m: number) => void;
  readonly onStepPitch: (dir: 1 | -1) => void;
  readonly onStepPos: (dir: 1 | -1) => void;
  readonly onStepLen: (dir: 1 | -1) => void;
  readonly onAccSelect: (v: AccPattern | 'off') => void;
  readonly onCycleAcc: () => void;
  readonly onTogglePlay: () => void;
  readonly onToggleMetro: () => void;
  readonly onTempoApply: (v: number) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
  readonly onShare: () => void;
  readonly onView: () => void;
}

export const DawEdit = ({
  song,
  sel,
  curM,
  accOn,
  metroOn,
  playing,
  playEl,
  cpBeat,
  scoreW,
  scoreRef,
  onCellTap,
  onSlotTap,
  onPickerApply,
  onPickerClear,
  onPickerDone,
  onMeasureTap,
  onStepPitch,
  onStepPos,
  onStepLen,
  onAccSelect,
  onCycleAcc,
  onTogglePlay,
  onToggleMetro,
  onTempoApply,
  onUndo,
  onRedo,
  onDelete,
  onShare,
  onView,
}: DawEditProps): JSX.Element => (
  <div className="daw-shell">
    <DawTopBar
      song={song}
      playing={playing}
      metroOn={metroOn}
      onTogglePlay={onTogglePlay}
      onToggleMetro={onToggleMetro}
      onTempoApply={onTempoApply}
      onUndo={onUndo}
      onRedo={onRedo}
      onDelete={onDelete}
      onShare={onShare}
      onView={onView}
    />
    <div className="daw-main">
      <div className="daw-left">
        <ChordRail song={song} curM={curM} openBeat={cpBeat} onSlotTap={onSlotTap} />
        {cpBeat !== null && (
          <ChordPicker
            song={song}
            curM={curM}
            beat={cpBeat}
            onApply={onPickerApply}
            onClear={onPickerClear}
            onDone={onPickerDone}
          />
        )}
        <PianoRoll
          song={song}
          sel={sel}
          {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
          onCellTap={onCellTap}
        />
      </div>
      <Inspector
        song={song}
        sel={sel}
        curM={curM}
        accOn={accOn}
        onStepPitch={onStepPitch}
        onStepPos={onStepPos}
        onStepLen={onStepLen}
        onAccSelect={onAccSelect}
        onCycleAcc={onCycleAcc}
      />
    </div>
    <div className="daw-score" ref={scoreRef}>
      <Score
        song={song}
        mode="edit"
        curM={curM}
        sel={sel}
        width={scoreW}
        {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
        onMeasureTap={onMeasureTap}
      />
    </div>
    <div className="daw-status">
      <span>{`${measCountAll(song)}마디 전체 표시`}</span>
      <span>자동 저장 · v1</span>
    </div>
  </div>
);
