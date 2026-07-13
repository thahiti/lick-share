/**
 * 태그 칩 목록 (publish-tags 설계 §6) — 클릭 비활성 순수 표시.
 * 빈 배열이면 아무것도 렌더하지 않는다. 향후 검색 도입 시 링크화 여지만 남긴다.
 */
import type { JSX } from 'react';

interface Props {
  readonly tags: readonly string[];
}

export const TagChips = ({ tags }: Props): JSX.Element | null => {
  if (tags.length === 0) return null;
  return (
    <div className="c-tags">
      {tags.map((tag) => (
        <span key={tag} className="c-tag">
          {'#' + tag}
        </span>
      ))}
    </div>
  );
};
