/** 좋아요 버튼 (설계 §7). 낙관적 토글은 호출부(LickDetail)가 담당하고 이 컴포넌트는 순수 표시용. */
import type { JSX } from 'react';

interface Props {
  readonly liked: boolean;
  readonly count: number;
  readonly onToggle: () => void;
}

export const LikeButton = ({ liked, count, onToggle }: Props): JSX.Element => (
  <button type="button" className={liked ? 'c-like on' : 'c-like'} onClick={onToggle}>
    ♥ {count}
  </button>
);
