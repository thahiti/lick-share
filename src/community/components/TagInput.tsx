/**
 * 태그 칩 입력 (publish-tags 설계 §5) — 제어 컴포넌트.
 * Enter/','로 정규화 커밋(null·중복 무시), × 클릭·빈 필드 Backspace로 제거,
 * 3개 도달 시 필드 비활성 + 안내 문구.
 */
import { useState, type JSX, type KeyboardEvent } from 'react';
import { MAX_TAGS, normalizeTag } from '../tags';

interface Props {
  readonly value: readonly string[];
  readonly onChange: (next: string[]) => void;
}

export const TagInput = ({ value, onChange }: Props): JSX.Element => {
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_TAGS;

  /** 커밋은 draft를 소비한다 — 정규화 결과가 null이거나 이미 있으면 칩 추가 없이 무시 */
  const commit = (): void => {
    const tag = normalizeTag(draft);
    setDraft('');
    if (tag === null || value.includes(tag)) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="c-tags">
      {value.map((tag) => (
        <span key={tag} className="c-tag">
          {'#' + tag}
          <button
            type="button"
            className="c-tag-x"
            aria-label={'Remove ' + tag}
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="c-tag-field"
        value={draft}
        disabled={full}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={full ? '' : 'Add tags'}
        aria-label="Add tags"
      />
      {full && <span className="c-tag-hint">Up to 3 tags</span>}
    </div>
  );
};
