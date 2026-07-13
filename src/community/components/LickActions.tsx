/**
 * 하단 액션 (핸드오프 §6, §7). 순서: Duplicate & edit(primary) → Like(secondary) → Share(secondary).
 * 데스크톱·모바일 모두 같은 순서. 좋아요는 카운터를 겸하므로 primary와 등급이 다르다.
 */
import type { JSX } from 'react';
import { Icon } from '../../ui/components/common/Icon';
import { LikeButton } from './LikeButton';

interface Props {
  readonly likeCount: number;
  readonly isLiked: boolean;
  readonly likeBusy?: boolean;
  readonly onDuplicate: () => void;
  readonly onLike: () => void;
  readonly onShare: () => void;
}

export const LickActions = ({
  likeCount,
  isLiked,
  likeBusy = false,
  onDuplicate,
  onLike,
  onShare,
}: Props): JSX.Element => (
  <div className="c-actions">
    <button type="button" className="c-dup" onClick={onDuplicate}>
      <Icon name="plus" color="var(--brand-primary-text)" size={14} />
      Duplicate &amp; edit
    </button>
    <LikeButton liked={isLiked} count={likeCount} onToggle={onLike} disabled={likeBusy} />
    <button type="button" className="c-share" onClick={onShare}>
      <Icon name="share" size={14} />
      Share
    </button>
  </div>
);
