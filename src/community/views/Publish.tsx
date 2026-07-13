/**
 * 게시 화면 (설계 §10, 2026-07-13 개정). 에디터 Share→Publish로 진입 —
 * 곡 blob(v1.…)은 URL 해시로 전달된다. 인코딩 문자열은 노출하지 않고,
 * 조용히 디코드해 미리보기 → 게시(멜로디 해시로 중복 판정)만 보여준다.
 */
import { useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { decodeSong } from '../../core/codec';
import { Score } from '../../ui/components/edit/Score';
import { publishLick } from '../api/licks';
import { TagInput } from '../components/TagInput';
import { melodyHash } from '../melody-hash';
import { navigate } from '../routing';
import { normalizeTags } from '../tags';

interface Props {
  readonly user: User | null;
}

/** 진입 시점의 URL 해시에서 곡 blob(v1.…)을 한 번 캡처 — 없으면 빈 문자열 */
const readInitialHash = (): string => {
  const h = window.location.hash;
  return h.startsWith('#v1.') ? h.slice(1) : '';
};

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'error'; readonly message?: string };

export const Publish = ({ user }: Props): JSX.Element => {
  const [hash] = useState(readInitialHash);
  const song = hash ? decodeSong(hash) : null;
  // 음표 없는 곡은 무효 취급 — melodyHash([])는 모든 빈 릭이 충돌하므로 게시 차단
  const validSong = song && song.notes.length > 0 ? song : null;
  const [title, setTitle] = useState(validSong?.title ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!user) return <p className="c-state">Sign in to publish</p>;

  if (!hash)
    return (
      <p className="c-state">
        No score to publish.{' '}
        <a
          href="/edit"
          onClick={(e) => {
            e.preventDefault();
            navigate('/edit');
          }}
        >
          Go to the editor
        </a>{' '}
        to create one.
      </p>
    );

  if (!song) return <p className="c-state">Couldn&apos;t read this score</p>;
  if (!validSong) return <p className="c-state">This lick has no notes</p>;

  const onPublish = async (): Promise<void> => {
    setStatus({ kind: 'submitting' });
    try {
      const mh = await melodyHash(validSong.notes);
      // TagInput이 이미 정규화하지만 최종 방어로 한 번 더 적용 (설계 §5)
      const result = await publishLick(
        title.trim() || validSong.title,
        hash,
        mh,
        normalizeTags(tags),
      );
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
      <Score song={validSong} mode="view" width={384} />
      <input className="c-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TagInput value={tags} onChange={setTags} />
      <button
        type="button"
        className="c-btn c-btn-primary"
        disabled={status.kind === 'submitting'}
        onClick={() => void onPublish()}
      >
        {status.kind === 'submitting' ? 'Publishing…' : 'Publish'}
      </button>
      {status.kind === 'duplicate' && <p className="c-state">You already published this lick</p>}
      {status.kind === 'error' && <p className="c-state">{status.message ?? 'Publish failed'}</p>}
    </div>
  );
};
