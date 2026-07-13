/** 게시 화면 (설계 §10). 공유 URL/해시 붙여넣기 → 미리보기 → 게시(멜로디 해시로 중복 판정). */
import { useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { decodeSong } from '../../core/codec';
import { Score } from '../../ui/components/edit/Score';
import { publishLick } from '../api/licks';
import { melodyHash } from '../melody-hash';
import { navigate } from '../routing';

interface Props {
  readonly user: User | null;
}

const extractHash = (input: string): string | null => {
  const t = input.trim();
  const i = t.indexOf('#');
  const h = i >= 0 ? t.slice(i + 1) : t;
  return h.startsWith('v1.') ? h : null;
};

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'error'; readonly message?: string };

interface TitleInputProps {
  readonly initial: string;
  readonly onChange: (value: string) => void;
}

/** hash가 바뀔 때 key 리마운트로 초기값을 새 song.title로 리셋 (Feed의 authorId 리마운트와 동일 패턴) */
const TitleInput = ({ initial, onChange }: TitleInputProps): JSX.Element => {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="c-input"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
};

const initialInput = (): string => {
  const h = window.location.hash;
  return h.startsWith('#v1.') ? h.slice(1) : '';
};

export const Publish = ({ user }: Props): JSX.Element => {
  const [input, setInput] = useState(initialInput);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!user) return <p className="c-state">Sign in to publish</p>;

  const hash = extractHash(input);
  const song = hash ? decodeSong(hash) : null;
  // 음표 없는 곡은 처음부터 끝까지 무효 취급 — 미리보기·게시 버튼·onPublish 전부 이 값 기준
  // (melodyHash([])는 모든 빈 릭이 충돌하므로 게시 자체를 차단)
  const validSong = song && song.notes.length > 0 ? song : null;
  const invalid = input.trim() !== '' && validSong === null;

  const onPublish = async (): Promise<void> => {
    if (!validSong || !hash) return;
    setStatus({ kind: 'submitting' });
    try {
      const mh = await melodyHash(validSong.notes);
      const result = await publishLick(title.trim() || validSong.title, hash, mh);
      if (result.ok) {
        navigate('/lick/' + result.id);
        return;
      }
      if (result.reason === 'duplicate') {
        setStatus({ kind: 'duplicate' });
      } else {
        setStatus(
          result.message === undefined
            ? { kind: 'error' }
            : { kind: 'error', message: result.message },
        );
      }
    } catch {
      setStatus({ kind: 'error', message: 'Publish failed' });
    }
  };

  return (
    <div className="c-form">
      <textarea
        className="c-textarea"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          // 해시가 실제로 바뀔 때만 제목 리셋 — 같은 해시 재붙여넣기(공백 차이 등)는
          // TitleInput이 리마운트되지 않아 타이핑한 제목이 화면에 남으므로 그대로 유지
          if (extractHash(e.target.value) !== hash) setTitle('');
          setStatus({ kind: 'idle' });
        }}
        placeholder="Paste a share URL or hash"
      />
      {invalid && <p className="c-state">Invalid link or no notes</p>}
      {validSong && (
        <>
          <Score song={validSong} mode="view" width={384} />
          <TitleInput key={hash} initial={validSong.title} onChange={setTitle} />
          <button
            type="button"
            className="c-btn"
            disabled={status.kind === 'submitting'}
            onClick={() => void onPublish()}
          >
            {status.kind === 'submitting' ? 'Publishing…' : 'Publish'}
          </button>
        </>
      )}
      {status.kind === 'duplicate' && <p className="c-state">You already published this lick</p>}
      {status.kind === 'error' && <p className="c-state">{status.message ?? 'Publish failed'}</p>}
    </div>
  );
};
