/**
 * Share 화면 (unified-nav-share 설계). 에디터 Share로 진입 — 곡 blob(v1.…)은 URL 해시.
 * 미리보기 + 재생(ScoreToolbar) + 제목/태그 + Copy link(비로그인 가능) + 게시(로그인 게이트).
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { total } from '../../core/geometry';
import { asStep } from '../../core/types';
import { Score } from '../../ui/components/edit/Score';
import { publishLick } from '../api/licks';
import { ScoreToolbar } from '../components/ScoreToolbar';
import { TagInput } from '../components/TagInput';
import { melodyHash } from '../melody-hash';
import { navigate } from '../routing';
import { normalizeTags } from '../tags';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

// 열람 재생: 각 종류를 모두 내보내고 실제 소리는 곡 데이터(accPat/metro)가 결정
const VIEW_OPTS = { melody: true, accomp: true, metro: true };

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

export const Publish = ({ user, player }: Props): JSX.Element => {
  const [hash] = useState(readInitialHash);
  const song = hash ? decodeSong(hash) : null;
  // 음표 없는 곡은 무효 취급 — melodyHash([])는 모든 빈 릭이 충돌하므로 게시 차단
  const validSong = song && song.notes.length > 0 ? song : null;
  const [title, setTitle] = useState(validSong?.title ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  // 재생/툴바 세션 상태 (bpm·loop는 세션 한정 — 저장하지 않는다, LickDetail과 동일 패턴)
  const [playing, setPlaying] = useState(false);
  const [playheadStep, setPlayheadStep] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [bpm, setBpm] = useState(validSong?.tempo ?? 120);
  const lastEl = useRef(0);

  /* 재생 진행 구독 + 언마운트 시 정지 */
  useEffect(() => {
    const unsubTick = player.onTick((el) => {
      lastEl.current = el;
      setPlayheadStep(el);
    });
    const unsubEnded = player.onEnded(() => {
      setPlaying(false);
      setPlayheadStep(null);
    });
    return () => {
      unsubTick();
      unsubEnded();
      player.stop();
    };
  }, [player]);

  /* 토스트 자동 소멸 */
  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

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

  /* 세션 템포로 재생 — bpm은 곡을 바꾸지 않고 지금 듣는 속도만 바꾼다 */
  const playFrom = (fromStep: number): void => {
    player.play(
      { ...validSong, tempo: bpm },
      VIEW_OPTS,
      asStep(fromStep),
      asStep(total(validSong)),
      loop,
    );
    setPlaying(true);
  };

  const onTogglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    playFrom(0);
  };

  const onToggleLoop = (): void => {
    const next = !loop;
    setLoop(next);
    player.setLoop(next); // 재생 중이면 즉시 반영, 아니면 no-op
  };

  const onBpmChange = (v: number): void => {
    setBpm(v);
    // 재생 중 변경은 현재 위치에서 새 템포로 이어 재생
    if (player.isPlaying()) {
      player.play(
        { ...validSong, tempo: v },
        VIEW_OPTS,
        asStep(Math.floor(lastEl.current)),
        asStep(total(validSong)),
        loop,
      );
    }
  };

  /** 열람 링크 복사 — 비로그인도 가능. 클립보드 미지원 시 prompt 폴백 (LickDetail과 동일) */
  const onCopyLink = (): void => {
    const url = `${window.location.origin}/?mode=view#${hash}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => setToast('Link copied'));
    } else {
      window.prompt('Copy this link', url);
    }
  };

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
      <a
        className="c-backlink"
        href={'/edit#' + hash}
        onClick={(e) => {
          e.preventDefault();
          navigate('/edit#' + hash);
        }}
      >
        ← Back to editor
      </a>
      <Score
        song={validSong}
        mode="view"
        width={384}
        {...(playing && playheadStep !== null ? { playheadStep } : {})}
      />
      <ScoreToolbar
        playing={playing}
        loop={loop}
        bpm={bpm}
        onTogglePlay={onTogglePlay}
        onToggleLoop={onToggleLoop}
        onBpmChange={onBpmChange}
      />
      <input
        className="c-input"
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TagInput value={tags} onChange={setTags} />
      <div className="c-form-actions">
        <button type="button" className="c-btn" onClick={onCopyLink}>
          Copy link
        </button>
        {user ? (
          <button
            type="button"
            className="c-btn c-btn-primary"
            disabled={status.kind === 'submitting'}
            onClick={() => void onPublish()}
          >
            {status.kind === 'submitting' ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <p className="c-state">Sign in to publish</p>
        )}
      </div>
      {status.kind === 'duplicate' && <p className="c-state">You already published this lick</p>}
      {status.kind === 'error' && <p className="c-state">{status.message ?? 'Publish failed'}</p>}
      {toast && (
        <div className="c-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
};
