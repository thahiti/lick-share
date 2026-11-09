/**
 * 표시 이름 편집 — My licks 머리글. 보기(이름 + Edit) / 편집(입력 + Save, Cancel) 두 상태.
 * 유일성은 DB의 unique 인덱스가 판정하므로 화면은 onSave 결과(taken)로만 안다.
 */
import { useState, type JSX } from 'react';
import type { RenameResult } from '../api/profiles';

interface Props {
  readonly name: string;
  readonly onSave: (name: string) => Promise<RenameResult>;
}

/** DB 제약(profiles_display_name_len)과 같은 값 */
const MAX_LEN = 30;

export const NameEditor = ({ name, onSave }: Props): JSX.Element => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && !saving;

  const open = (): void => {
    setDraft(name);
    setError(null);
    setEditing(true);
  };

  const close = (): void => {
    setEditing(false);
    setError(null);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    const result = await onSave(trimmed);
    setSaving(false);
    if (result.ok) {
      close();
      return;
    }
    setError(result.reason === 'taken' ? 'Already taken' : (result.message ?? "Couldn't save"));
  };

  if (!editing) {
    return (
      <div className="c-namehead">
        <div className="c-title">{name}</div>
        <button type="button" className="c-namehead-edit" onClick={open}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="c-namehead">
      <div className="c-form-actions">
        <input
          className="c-input"
          value={draft}
          maxLength={MAX_LEN}
          aria-label="Display name"
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="c-btn c-btn-primary"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save
        </button>
        <button type="button" className="c-btn" onClick={close}>
          Cancel
        </button>
      </div>
      {error && <p className="c-namehead-err">{error}</p>}
    </div>
  );
};
