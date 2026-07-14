/**
 * 태그 칩 목록 (publish-tags 설계 §6, tag-search 설계 §3) — 칩은 /tag/:name 링크.
 * 빈 배열이면 아무것도 렌더하지 않는다.
 */
import type { JSX } from 'react';
import { navigate } from '../routing';

interface Props {
  readonly tags: readonly string[];
}

export const TagChips = ({ tags }: Props): JSX.Element | null => {
  if (tags.length === 0) return null;
  return (
    <div className="c-tags">
      {tags.map((tag) => {
        const to = '/tag/' + encodeURIComponent(tag);
        return (
          <a
            key={tag}
            className="c-tag"
            href={to}
            onClick={(e) => {
              e.preventDefault();
              navigate(to);
            }}
          >
            {'#' + tag}
          </a>
        );
      })}
    </div>
  );
};
