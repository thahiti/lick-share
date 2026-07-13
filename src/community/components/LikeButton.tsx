/** 좋아요 버튼 (설계 §7). 낙관적 토글은 호출부(LickDetail)가 담당하고 이 컴포넌트는 순수 표시용. */
import type { JSX } from 'react';

interface Props {
  readonly liked: boolean;
  readonly count: number;
  readonly onToggle: () => void;
  /** 요청 진행 중 중복 토글 방지 (single-flight) */
  readonly disabled?: boolean;
}

export const LikeButton = ({ liked, count, onToggle, disabled = false }: Props): JSX.Element => (
  <button
    type="button"
    className={liked ? 'c-like on' : 'c-like'}
    aria-pressed={liked}
    aria-label={liked ? `Unlike, ${count} likes` : `Like, ${count} likes`}
    disabled={disabled}
    onClick={onToggle}
  >
    ♥ {count}
  </button>
);
