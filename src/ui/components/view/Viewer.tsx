/**
 * 열람 화면 (SPEC §4). 곡 전체 멀티라인 악보 + 배지 + 큰 재생 버튼(멜로디만).
 * 음표 탭 = 그 위치부터 끝까지 재생.
 */
import type { JSX } from 'react';
import { measCountAll } from '../../../core/geometry';
import type { Song } from '../../../core/types';
import { Icon } from '../common/Icon';
import { Score } from '../edit/Score';

export interface ViewerProps {
  readonly song: Song;
  readonly playing: boolean;
  readonly playheadStep?: number;
  readonly width?: number;
  readonly onPlayAll: () => void;
  readonly onNoteTap: (id: number) => void;
  readonly onCopyLink: () => void;
  readonly onToEdit: () => void;
}

export const Viewer = ({
  song,
  playing,
  playheadStep,
  width = 384,
  onPlayAll,
  onNoteTap,
  onCopyLink,
  onToEdit,
}: ViewerProps): JSX.Element => (
  <div className="viewer">
    <div className="hero">
      <div className="eyebrow">공유된 악보</div>
      <h1 className="title">{song.title}</h1>
      <hr className="rule" />
      <div className="badges">
        <span data-badge="key">C장조</span>
        <span data-badge="time">4/4</span>
        <span data-badge="tempo">{`♩=${song.tempo}`}</span>
        <span data-badge="meas">{`${measCountAll(song) - (song.pickup ? 1 : 0)}마디`}</span>
      </div>
    </div>
    <div className="score-card">
      <div className="score-scroll">
        <Score
          song={song}
          mode="view"
          width={width}
          {...(playheadStep !== undefined ? { playheadStep } : {})}
          onNoteTap={onNoteTap}
        />
      </div>
    </div>
    <button type="button" data-btn="playv" className="big-play" aria-label="전곡 재생" onClick={onPlayAll}>
      <Icon name={playing ? 'pause' : 'play'} color="#fff" size={26} />
    </button>
    <div className="viewer-actions">
      <button type="button" data-btn="copy" onClick={onCopyLink}>
        링크 복사
      </button>
      <button type="button" data-btn="toedit" className="dark" onClick={onToEdit}>
        <Icon name="plus" color="#fff" size={15} />
        복제해서 편집
      </button>
    </div>
  </div>
);
