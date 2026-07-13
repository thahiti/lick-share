/**
 * 편집 헤더 (SPEC §3.1). 반주/메트로놈/재생/템포/공유/보기 + 메타라인.
 */
import { useState, type JSX } from 'react';
import type { AccPattern, Song } from '../../../core/types';
import { Icon } from '../common/Icon';

export interface HeaderProps {
  readonly song: Song;
  readonly accOn: boolean;
  readonly metroOn: boolean;
  readonly playing: boolean;
  readonly onAccSelect: (v: AccPattern | 'off') => void;
  readonly onToggleMetro: () => void;
  readonly onTogglePlay: () => void;
  /** 클램프는 core setTempo가 담당 — 원시 값 전달 */
  readonly onTempoApply: (v: number) => void;
  readonly onPublish: () => void;
  readonly onCopyLink: () => void;
  readonly onView: () => void;
}

const ACC_OPTIONS: readonly (readonly [AccPattern | 'off', string])[] = [
  ['off', 'Off'],
  ['pad', 'Pad'],
  ['comp', 'Comp'],
  ['arp', 'Arp'],
];

export const Header = ({
  song,
  accOn,
  metroOn,
  playing,
  onAccSelect,
  onToggleMetro,
  onTogglePlay,
  onTempoApply,
  onPublish,
  onCopyLink,
  onView,
}: HeaderProps): JSX.Element => {
  const [accPop, setAccPop] = useState(false);
  const [tempoPop, setTempoPop] = useState(false);
  const [sharePop, setSharePop] = useState(false);
  const [tempoInput, setTempoInput] = useState(String(song.tempo));

  const applyTempo = (v: number): void => {
    onTempoApply(v);
    setTempoInput(String(v));
  };

  return (
    <header className="header">
      <div className="header-row">
        <div className="header-left">
          <div className="eyebrow">LICK SHARE — EDIT</div>
          <h1 className="title">{song.title}</h1>
        </div>
        <div className="header-btns">
          <button
            type="button"
            data-btn="acc"
            className={`icon-btn${accOn ? ' on' : ''}`}
            aria-label="Chord accompaniment"
            onClick={() => setAccPop((v) => !v)}
          >
            <Icon name="chord" color={accOn ? '#fff' : 'var(--ink)'} />
          </button>
          <button
            type="button"
            data-btn="metro"
            className={`icon-btn${metroOn ? ' on' : ''}`}
            aria-label="Metronome"
            onClick={onToggleMetro}
          >
            <Icon name="metro" color={metroOn ? '#fff' : 'var(--ink)'} />
          </button>
          <button
            type="button"
            data-btn="playall"
            className="icon-btn"
            aria-label="Play/Stop all"
            onClick={onTogglePlay}
          >
            <Icon name={playing ? 'pause' : 'play'} />
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
          <button type="button" data-btn="share" className="icon-btn" aria-label="Share" onClick={() => setSharePop((v) => !v)}>
            <Icon name="share" size={15} />
          </button>
          <button type="button" data-btn="view" className="icon-btn" aria-label="View mode" onClick={onView}>
            View
          </button>
        </div>
      </div>
      <div className="metaline">
        <span>{`C Major · 4/4 · ${song.meas} bars${song.pickup ? ' + pickup' : ''}`}</span>
      </div>

      {accPop && (
        <div className="popover acc-pop">
          {ACC_OPTIONS.map(([v, label]) => (
            <button
              type="button"
              key={v}
              data-ap={v}
              className={(v === 'off' ? !accOn : accOn && song.accPat === v) ? 'on' : ''}
              onClick={() => {
                onAccSelect(v);
                setAccPop(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

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
            Close
          </button>
        </div>
      )}

      {sharePop && (
        <div className="popover share-pop">
          <button
            type="button"
            data-share="publish"
            onClick={() => {
              onPublish();
              setSharePop(false);
            }}
          >
            Publish
          </button>
          <button
            type="button"
            data-share="copy"
            onClick={() => {
              onCopyLink();
              setSharePop(false);
            }}
          >
            Copy link
          </button>
        </div>
      )}
    </header>
  );
};
