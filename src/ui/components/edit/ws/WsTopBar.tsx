/**
 * 워크스페이스 상단 바 (구 DawTopBar 대체, 설계 §4).
 * 좌: ← 뒤로 · 곡 제목 · "Auto-saved"(muted).
 * 우: [Share] 아웃라인 · [Publish] brand primary (화면 유일 primary).
 * 재생·템포·줌·메트로놈·undo/redo/삭제는 편집 캔버스 트랜스포트 행이 담당한다.
 */
import type { JSX } from 'react';
import type { Song } from '../../../../core/types';
import { Icon } from '../../common/Icon';

export interface WsTopBarProps {
  readonly song: Song;
  readonly onBack: () => void;
  /** 열람 링크 복사 */
  readonly onCopyLink: () => void;
  /** 커뮤니티 게시 */
  readonly onPublish: () => void;
}

export const WsTopBar = ({ song, onBack, onCopyLink, onPublish }: WsTopBarProps): JSX.Element => (
  <header className="ws-top">
    <div className="ws-top-left">
      <button type="button" data-btn="back" className="ws-back" aria-label="Back" onClick={onBack}>
        <Icon name="prev" size={16} />
      </button>
      <h1 className="ws-title">{song.title}</h1>
      <span className="ws-saved">Auto-saved</span>
    </div>
    <div className="ws-top-right">
      <button type="button" data-btn="share" className="ws-btn-outline" onClick={onCopyLink}>
        Share
      </button>
      <button type="button" data-btn="publish" className="ws-btn-primary" onClick={onPublish}>
        Publish
      </button>
    </div>
  </header>
);
