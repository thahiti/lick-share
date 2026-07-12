/**
 * DAW 트랜스포트 바 — 제목·메타 | 재생·메트로놈·템포 | 실행취소·재실행·삭제 | 공유·보기.
 * 기존 data-btn 명명을 유지해 키보드/테스트와 일관.
 */
import { useState, type JSX } from 'react';
import type { Song } from '../../../../core/types';
import { Icon } from '../../common/Icon';

export interface DawTopBarProps {
  readonly song: Song;
  readonly playing: boolean;
  readonly metroOn: boolean;
  readonly onTogglePlay: () => void;
  readonly onToggleMetro: () => void;
  /** 클램프는 core setTempo가 담당 — 원시 값 전달 */
  readonly onTempoApply: (v: number) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
  readonly onShare: () => void;
  readonly onView: () => void;
}

export const DawTopBar = ({
  song,
  playing,
  metroOn,
  onTogglePlay,
  onToggleMetro,
  onTempoApply,
  onUndo,
  onRedo,
  onDelete,
  onShare,
  onView,
}: DawTopBarProps): JSX.Element => {
  const [tempoPop, setTempoPop] = useState(false);
  const [tempoInput, setTempoInput] = useState(String(song.tempo));

  const applyTempo = (v: number): void => {
    onTempoApply(v);
    setTempoInput(String(v));
  };

  return (
    <header className="daw-top">
      <div className="daw-title">
        <h1>{song.title}</h1>
        <span className="daw-meta">{`C장조 4/4 ${song.meas}마디${song.pickup ? ' + 못갖춘' : ''}`}</span>
      </div>
      <div className="daw-transport">
        <button
          type="button"
          data-btn="playall"
          className="icon-btn"
          aria-label="전체 재생/정지"
          onClick={onTogglePlay}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          data-btn="metro"
          className={`icon-btn${metroOn ? ' on' : ''}`}
          aria-label="메트로놈"
          onClick={onToggleMetro}
        >
          <Icon name="metro" color={metroOn ? 'var(--daw-bg, #fff)' : 'var(--ink)'} />
        </button>
        <button
          type="button"
          data-btn="tempo"
          className="chip"
          onClick={() => {
            setTempoInput(String(song.tempo));
            setTempoPop((v) => !v);
          }}
        >
          {`♩=${song.tempo}`}
        </button>
      </div>
      <div className="daw-actions">
        <button type="button" data-btn="undo" className="icon-btn" aria-label="실행취소" onClick={onUndo}>
          <Icon name="undo" />
        </button>
        <button type="button" data-btn="redo" className="icon-btn" aria-label="재실행" onClick={onRedo}>
          <Icon name="redo" />
        </button>
        <button type="button" data-btn="del" className="icon-btn" aria-label="선택 삭제" onClick={onDelete}>
          <Icon name="del" color="var(--red)" />
        </button>
        <button type="button" data-btn="share" className="chip" onClick={onShare}>
          공유
        </button>
        <button type="button" data-btn="view" className="chip" onClick={onView}>
          보기
        </button>
      </div>

      {tempoPop && (
        <div className="popover tempo-pop">
          <button type="button" data-tempo="down" onClick={() => applyTempo(song.tempo - 4)}>
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={40}
            max={240}
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
            닫기
          </button>
        </div>
      )}
    </header>
  );
};
