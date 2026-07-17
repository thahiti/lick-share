/**
 * 데스크톱 편집 워크스페이스 (구 DawEdit 대체, 설계 §4).
 * WsTopBar / [편집 캔버스(트랜스포트·악보·롤·힌트·건반) | PropertyPanel].
 * 악보(StaffLane)와 피아노롤은 하나의 .ws-scroll에 쌓여 가로 스크롤·좌표를
 * 공유한다. pxPerStep(줌)만 이 컴포넌트의 로컬 상태이고 나머지 상태·핸들러는
 * App이 소유한다.
 */
import { useState, type JSX } from 'react';
import { clampZoom, ZOOM_DEFAULT } from '../../../../core/timeline';
import type { AccPattern, BarIndex, Midi, Song } from '../../../../core/types';
import { Icon } from '../../common/Icon';
import { ChordPicker } from '../ChordPicker';
import { PianoKeys } from './PianoKeys';
import { PianoRoll } from './PianoRoll';
import { PropertyPanel } from './PropertyPanel';
import { StaffLane } from './StaffLane';
import { WsTopBar } from './WsTopBar';
import '../../../../styles/ws.css';

/** 단축키 힌트 (설계 §6.2) — 키캡 뱃지 + 설명 */
const HINTS: readonly (readonly [string, string])[] = [
  ['↑↓ ←→', 'Pitch · Select'],
  ['Shift+↑↓ ←→', 'Length · Position'],
  ['A–G', 'Add note'],
  ['Space', 'Play'],
  ['Enter', 'Play bar'],
  ['[ ]', 'Move bar'],
  ['Del', 'Delete'],
  ['Cmd+Z', 'Undo'],
];

const ZOOM_STEP = 2;

export interface WorkspaceProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
  readonly accOn: boolean;
  readonly metroOn: boolean;
  readonly playing: boolean;
  readonly playEl: number | null;
  /** 코드 피커가 열린 박 (curM 기준, 닫힘 = null) */
  readonly cpBeat: number | null;
  readonly inputLen: number;

  // ── 레코딩 (piano-recording-design §3.3) ──
  readonly recPhase: 'idle' | 'countIn' | 'recording';
  readonly countBeat: number | null;
  readonly recEl: number | null;
  readonly onRecord: () => void;
  readonly onRecStop: () => void;
  readonly onRecKeyDown: (p: Midi) => void;
  readonly onRecKeyUp: (p: Midi) => void;
  readonly onRecKeyAbort: (p: Midi) => void;

  readonly onCellTap: (m: number, pv: Midi | 'rest', st: number) => void;
  readonly onDragNote: (id: number, patch: { s?: number; p?: Midi; d?: number }) => void;
  readonly onSlotTap: (m: number, b: number) => void;
  readonly onPickerApply: (ch: string) => void;
  readonly onPickerClear: () => void;
  readonly onPickerDone: () => void;
  readonly onStepPitch: (dir: 1 | -1) => void;
  readonly onStepPos: (dir: 1 | -1) => void;
  readonly onStepLen: (dir: 1 | -1) => void;
  readonly onSetLen: (len: number) => void;
  readonly onDelete: () => void;
  readonly onAccSelect: (v: AccPattern | 'off') => void;
  readonly onCycleAcc: () => void;
  readonly onSetTitle: (title: string) => void;
  readonly onTempoApply: (v: number) => void;
  readonly onPreviewDown: (p: Midi) => void;
  readonly onPreviewUp: (p: Midi) => void;
  readonly onTogglePlay: () => void;
  readonly onToggleMetro: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** 편집 종료 — 커뮤니티 복귀 */
  readonly onExit: () => void;
  /** Share 화면(/publish) 진입 */
  readonly onShare: () => void;
}

export const Workspace = (props: WorkspaceProps): JSX.Element => {
  const {
    song,
    sel,
    curM,
    accOn,
    metroOn,
    playing,
    playEl,
    cpBeat,
    inputLen,
    recPhase,
    countBeat,
    recEl,
    onRecord,
    onRecStop,
    onRecKeyDown,
    onRecKeyUp,
    onRecKeyAbort,
    onCellTap,
    onDragNote,
    onSlotTap,
    onPickerApply,
    onPickerClear,
    onPickerDone,
    onStepPitch,
    onStepPos,
    onStepLen,
    onSetLen,
    onDelete,
    onAccSelect,
    onCycleAcc,
    onSetTitle,
    onTempoApply,
    onPreviewDown,
    onPreviewUp,
    onTogglePlay,
    onToggleMetro,
    onUndo,
    onRedo,
    onExit,
    onShare,
  } = props;

  const [pxPerStep, setPxPerStep] = useState(ZOOM_DEFAULT);
  const [tempoPop, setTempoPop] = useState(false);
  const [tempoInput, setTempoInput] = useState(String(song.tempo));

  const recActive = recPhase !== 'idle';
  const playheadStep =
    recPhase === 'recording' && recEl !== null
      ? recEl
      : playing && playEl !== null
        ? playEl
        : undefined;
  const zoom = (d: number): void => setPxPerStep((v) => clampZoom(v + d));
  const applyTempo = (v: number): void => {
    onTempoApply(v);
    setTempoInput(String(v));
  };

  return (
    <div className="ws">
      <WsTopBar song={song} onExit={onExit} onShare={onShare} />
      <div className="ws-main">
        <div className="ws-canvas">
          <div className="ws-transport">
            <button
              type="button"
              data-btn="playall"
              className="ws-play"
              aria-label="Play/Stop all"
              disabled={recActive}
              onClick={onTogglePlay}
            >
              <Icon name={playing ? 'pause' : 'play'} size={16} color="var(--brand-tint-text)" />
            </button>
            <button
              type="button"
              data-btn="rec"
              className={`ws-icon-btn ws-rec${recActive ? ' on' : ''}`}
              aria-label={recActive ? 'Stop recording' : 'Record'}
              onClick={recActive ? onRecStop : onRecord}
            >
              <span className={recActive ? 'rec-stop-square' : 'rec-dot'} />
            </button>
            {recActive && (
              <span className="ws-rec-chip" role="status">
                {recPhase === 'countIn' ? `Count-in ${countBeat ?? ''}` : 'REC'}
              </span>
            )}
            <div className="ws-tempo-wrap">
              <button
                type="button"
                data-btn="tempo"
                className="ws-chip"
                onClick={() => {
                  setTempoInput(String(song.tempo));
                  setTempoPop((v) => !v);
                }}
              >
                {`♩=${song.tempo}`}
              </button>
              {tempoPop && (
                <div className="popover ws-tempo-pop">
                  <button type="button" data-tempo="down" onClick={() => applyTempo(song.tempo - 4)}>
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={40}
                    max={240}
                    aria-label="Tempo"
                    value={tempoInput}
                    onChange={(e) => {
                      setTempoInput(e.target.value);
                      onTempoApply(Number(e.target.value));
                    }}
                  />
                  <button type="button" data-tempo="up" onClick={() => applyTempo(song.tempo + 4)}>
                    ＋
                  </button>
                  <button type="button" className="cls" onClick={() => setTempoPop(false)}>
                    Close
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              data-btn="metro"
              className={`ws-icon-btn${metroOn ? ' on' : ''}`}
              aria-label="Metronome"
              onClick={onToggleMetro}
            >
              <Icon name="metro" color={metroOn ? 'var(--paper)' : 'var(--ink)'} />
            </button>
            <span className="ws-transport-sep" />
            <button
              type="button"
              data-btn="undo"
              className="ws-icon-btn"
              aria-label="Undo"
              disabled={recActive}
              onClick={onUndo}
            >
              <Icon name="undo" />
            </button>
            <button
              type="button"
              data-btn="redo"
              className="ws-icon-btn"
              aria-label="Redo"
              disabled={recActive}
              onClick={onRedo}
            >
              <Icon name="redo" />
            </button>
            <button
              type="button"
              data-btn="del"
              className="ws-icon-btn"
              aria-label="Delete selection"
              disabled={recActive}
              onClick={onDelete}
            >
              <Icon name="del" color="var(--red)" />
            </button>
            <div className="ws-zoom">
              <button type="button" data-btn="zoom-out" aria-label="Zoom out" onClick={() => zoom(-ZOOM_STEP)}>
                −
              </button>
              <button type="button" data-btn="zoom-in" aria-label="Zoom in" onClick={() => zoom(ZOOM_STEP)}>
                ＋
              </button>
            </div>
          </div>

          <div className="ws-scroll">
            <StaffLane
              song={song}
              pxPerStep={pxPerStep}
              sel={sel}
              onChordTap={onSlotTap}
              {...(playheadStep !== undefined ? { playheadStep } : {})}
            />
            <PianoRoll
              song={song}
              pxPerStep={pxPerStep}
              sel={sel}
              onCellTap={recActive ? () => {} : onCellTap}
              onDragNote={recActive ? () => {} : onDragNote}
              {...(playheadStep !== undefined ? { playheadStep } : {})}
            />
          </div>

          <div className="ws-hints">
            {HINTS.map(([keys, desc]) => (
              <span className="ws-hint" key={desc}>
                <kbd>{keys}</kbd>
                {desc}
              </span>
            ))}
          </div>

          <PianoKeys
            onPreviewDown={onPreviewDown}
            onPreviewUp={onPreviewUp}
            recording={recActive}
            onRecKeyDown={onRecKeyDown}
            onRecKeyUp={onRecKeyUp}
            onRecKeyAbort={onRecKeyAbort}
          />
        </div>

        <PropertyPanel
          song={song}
          sel={sel}
          curM={curM}
          accOn={accOn}
          inputLen={inputLen}
          openBeat={cpBeat}
          onSetTitle={onSetTitle}
          onTempoApply={onTempoApply}
          onSetLen={onSetLen}
          onDelete={onDelete}
          onStepPitch={onStepPitch}
          onStepPos={onStepPos}
          onStepLen={onStepLen}
          onSlotTap={onSlotTap}
          onAccSelect={onAccSelect}
          onCycleAcc={onCycleAcc}
        />
      </div>

      {cpBeat !== null && (
        <div className="ws-picker">
          <ChordPicker
            song={song}
            curM={curM}
            beat={cpBeat}
            onApply={onPickerApply}
            onClear={onPickerClear}
            onDone={onPickerDone}
          />
        </div>
      )}
    </div>
  );
};
