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

  if (!user) return <p className="c-state">게시하려면 로그인이 필요해요</p>;

  const hash = extractHash(input);
  const song = hash ? decodeSong(hash) : null;
  const invalid = input.trim() !== '' && (song === null || song.notes.length === 0);

  const onPublish = async (): Promise<void> => {
    if (!song || !hash) return;
    setStatus({ kind: 'submitting' });
    const mh = await melodyHash(song.notes);
    const result = await publishLick(title.trim() || song.title, hash, mh);
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
  };

  return (
    <div className="c-form">
      <textarea
        className="c-textarea"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setStatus({ kind: 'idle' });
        }}
        placeholder="공유 URL 또는 해시를 붙여넣으세요"
      />
      {invalid && <p className="c-state">해석할 수 없는 링크이거나 음표가 없어요</p>}
      {song && (
        <>
          <Score song={song} mode="view" width={384} />
          <TitleInput key={hash} initial={song.title} onChange={setTitle} />
          <button
            type="button"
            className="c-btn"
            disabled={status.kind === 'submitting'}
            onClick={() => void onPublish()}
          >
            {status.kind === 'submitting' ? '게시 중…' : '게시'}
          </button>
        </>
      )}
      {status.kind === 'duplicate' && <p className="c-state">이미 게시한 릭이에요</p>}
      {status.kind === 'error' && (
        <p className="c-state">{status.message ?? '게시에 실패했어요'}</p>
      )}
    </div>
  );
};
