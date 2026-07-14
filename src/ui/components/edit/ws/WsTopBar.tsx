/**
 * 워크스페이스 상단 바 (unified-nav-share 설계).
 * 좌: ← 뒤로(커뮤니티 복귀) · 곡 제목 · "Auto-saved"(muted).
 * 우: [Share] brand primary 단일 버튼 — /publish 화면이 재생·복사·게시를 모두 담당.
 */
import type { JSX } from 'react';
import type { Song } from '../../../../core/types';
import { Icon } from '../../common/Icon';

export interface WsTopBarProps {
  readonly song: Song;
  /** 편집 종료 — 커뮤니티 복귀 */
  readonly onExit: () => void;
  /** Share 화면(/publish) 진입 */
  readonly onShare: () => void;
}

export const WsTopBar = ({ song, onExit, onShare }: WsTopBarProps): JSX.Element => (
  <header className="ws-top">
    <div className="ws-top-left">
      <button type="button" data-btn="back" className="ws-back" aria-label="Back to community" onClick={onExit}>
        <Icon name="prev" size={16} />
      </button>
      <h1 className="ws-title">{song.title}</h1>
      <span className="ws-saved">Auto-saved</span>
    </div>
    <div className="ws-top-right">
      <button type="button" data-btn="share" className="ws-btn-primary" onClick={onShare}>
        Share
      </button>
    </div>
  </header>
);
