/**
 * 열람 화면 (SPEC §4). 곡 전체 멀티라인 악보 + 배지 + 큰 재생 버튼(곡 데이터대로 반주·메트로놈 포함).
 * 음표 탭 = 그 위치부터 끝까지 재생.
 * 악보 폭은 스크롤 영역 실측 1:1 — 음표 크기는 고정, 넓을수록 여유롭게 조판된다.
 */
import { useRef, type JSX } from 'react';
import { measCountAll } from '../../../core/geometry';
import type { Song } from '../../../core/types';
import { useElementWidth } from '../../hooks/useElementWidth';
import { Icon } from '../common/Icon';
import { Score } from '../edit/Score';

export interface ViewerProps {
  readonly song: Song;
  readonly playing: boolean;
  readonly playheadStep?: number;
  readonly onPlayAll: () => void;
  readonly onNoteTap: (id: number) => void;
  readonly onCopyLink: () => void;
  readonly onToEdit: () => void;
}

export const Viewer = ({
  song,
  playing,
  playheadStep,
  onPlayAll,
  onNoteTap,
  onCopyLink,
  onToEdit,
}: ViewerProps): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scrollRef, 384);
  return (
    <div className="viewer">
      <div className="hero">
        <div className="eyebrow">SHARED SCORE</div>
        <h1 className="title">{song.title}</h1>
        <hr className="rule" />
        <div className="badges">
          <span data-badge="key">C Major</span>
          <span data-badge="time">4/4</span>
          <span data-badge="tempo">{`♩=${song.tempo}`}</span>
          <span data-badge="meas">{`${measCountAll(song) - (song.pickup ? 1 : 0)} bars`}</span>
        </div>
      </div>
      <div className="score-card">
        <div className="score-scroll" ref={scrollRef}>
          <Score
            song={song}
            mode="view"
            width={width}
            {...(playheadStep !== undefined ? { playheadStep } : {})}
            onNoteTap={onNoteTap}
          />
        </div>
      </div>
      <button
        type="button"
        data-btn="playv"
        className="big-play"
        aria-label="Play all"
        onClick={onPlayAll}
      >
        <Icon name={playing ? 'pause' : 'play'} color="#fff" size={26} />
      </button>
      <div className="viewer-actions">
        <button type="button" data-btn="copy" onClick={onCopyLink}>
          Copy link
        </button>
        <button type="button" data-btn="toedit" className="dark" onClick={onToEdit}>
          <Icon name="plus" color="#fff" size={15} />
          Duplicate & edit
        </button>
      </div>
    </div>
  );
};
