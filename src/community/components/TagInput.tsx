/**
 * 태그 칩 입력 (publish-tags 설계 §5 + 입력 UX 개선).
 * - Enter/','/스페이스 또는 필드 blur 시 정규화 커밋 (blur 커밋으로 미확정 draft 유실 방지)
 * - × 클릭·빈 필드 Backspace로 제거, 3개 도달 시 필드 비활성 + 안내
 * - 상시 제스처 힌트 + 추천 태그 칩(클릭해 추가)으로 발견성 보강
 */
import { useState, type JSX, type KeyboardEvent } from 'react';
import { MAX_TAGS, normalizeTag } from '../tags';

interface Props {
  readonly value: readonly string[];
  readonly onChange: (next: string[]) => void;
}

/** 발견성 보조용 추천 태그 (이미 정규화된 형태) */
const SUGGESTED: readonly string[] = ['bebop', 'ballad', 'ii-v-i'];

export const TagInput = ({ value, onChange }: Props): JSX.Element => {
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_TAGS;

  /** raw 문자열을 정규화해 추가 — null·중복·상한 초과면 무시 */
  const add = (raw: string): void => {
    const tag = normalizeTag(raw);
    if (tag === null || value.includes(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  };

  /** draft를 소비해 커밋 (Enter/','·blur 공통 경로) */
  const commitDraft = (): void => {
    add(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    // Enter/','/스페이스로 커밋. 스페이스를 구분자로 쓰므로 선행 공백은 preventDefault로 막는다.
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const suggestions = SUGGESTED.filter((s) => !value.includes(s));

  return (
    <div className="c-tagfield">
      <div className="c-taginput">
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
          onBlur={commitDraft}
          placeholder={full ? '' : 'Add tags'}
          aria-label="Add tags"
        />
      </div>

      {full ? (
        <span className="c-tag-hint">Up to 3 tags</span>
      ) : (
        <>
          <span className="c-tag-hint">Press space, Enter, or comma · up to 3</span>
          {suggestions.length > 0 && (
            <div className="c-tagsug">
              <span className="c-tagsug-label">Try</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="c-tag-sug"
                  aria-label={'Add tag ' + s}
                  onClick={() => add(s)}
                >
                  {'#' + s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
