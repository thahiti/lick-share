/**
 * 릭 상세 (설계 §7, §9, §11). 재생(전곡/음표 탭)·좋아요 낙관적 토글·원본 삭제(승계는 DB trigger).
 * 유사릭은 좋아요가 canonical_id에 모이므로 안내 문구 + 원본 링크를 보여준다.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { total } from '../../core/geometry';
import { asStep, type Song } from '../../core/types';
import { Score } from '../../ui/components/edit/Score';
import { deleteLick, fetchLick, type LickRow } from '../api/licks';
import { addLike, fetchLikeCounts, fetchMyLikedSet, likeTargetId, removeLike } from '../api/likes';
import { LikeButton } from '../components/LikeButton';
import { navigate } from '../routing';

interface Props {
  readonly id: string;
  readonly user: User | null;
  readonly player: Player;
}

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'notfound' }
  | { readonly kind: 'baddecode' }
  | { readonly kind: 'ready'; readonly lick: LickRow; readonly song: Song };

const VIEW_OPTS = { melody: true, accomp: false, metro: false };

const LickDetailView = ({ id, user, player }: Props): JSX.Element => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeMsg, setLikeMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);

  /* 릭·악보 로드 — StrictMode 이중 이펙트에서도 fetchLick은 정확히 1회 (Feed와 동일 패턴) */
  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void fetchLick(id).then((lick) => {
        if (!alive.current) return;
        if (!lick) {
          setPhase({ kind: 'notfound' });
          return;
        }
        const song = decodeSong(lick.blob);
        if (!song) {
          setPhase({ kind: 'baddecode' });
          return;
        }
        setPhase({ kind: 'ready', lick, song });
      });
    }
    return () => {
      alive.current = false;
    };
  }, [id]);

  /* 좋아요 카운트·내 좋아요 여부 — 대상은 항상 canonical_id ?? id */
  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const target = likeTargetId(phase.lick);
    void Promise.all([
      fetchLikeCounts([target]),
      user ? fetchMyLikedSet(user.id) : Promise.resolve(new Set<string>()),
    ]).then(([counts, likedSet]) => {
      if (!alive.current) return;
      setCount(counts.get(target) ?? 0);
      setLiked(likedSet.has(target));
    });
  }, [phase, user]);

  /* 언마운트 시 재생 정지 + 구독 해제 */
  useEffect(() => {
    const unsubEnded = player.onEnded(() => setPlaying(false));
    return () => {
      unsubEnded();
      player.stop();
    };
  }, [player]);

  if (phase.kind === 'loading') return <p className="c-state">불러오는 중…</p>;
  if (phase.kind === 'notfound') return <p className="c-state">릭을 찾을 수 없어요</p>;
  if (phase.kind === 'baddecode') return <p className="c-state">악보를 읽을 수 없어요</p>;

  const { lick, song } = phase;
  const profiles = lick.profiles;
  const isAuthor = user?.id === lick.author_id;

  const onTogglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      setPlaying(false);
      return;
    }
    player.play(song, VIEW_OPTS, asStep(0), asStep(total(song)));
    setPlaying(true);
  };

  const onNoteTap = (noteId: number): void => {
    const note = song.notes.find((n) => n.id === noteId);
    if (!note) return;
    player.play(song, VIEW_OPTS, note.s, asStep(total(song)));
    setPlaying(true);
  };

  /* 낙관적 토글 — single-flight: 요청 진행 중에는 버튼을 비활성화해 중복 토글의
     롤백 경합(늦게 실패한 요청이 다른 토글의 카운트를 되돌리는 문제)을 원천 차단 */
  const onToggleLike = (): void => {
    if (likeBusy) return;
    if (!user) {
      setLikeMsg('좋아요는 로그인 후에 누를 수 있어요');
      return;
    }
    const target = likeTargetId(lick);
    const next = !liked;
    setLikeBusy(true);
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    setLikeMsg(null);
    void (next ? addLike(target) : removeLike(target))
      .catch(() => {
        if (!alive.current) return;
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
        setLikeMsg('좋아요 처리에 실패했어요');
      })
      .finally(() => {
        if (alive.current) setLikeBusy(false);
      });
  };

  const onDeleteClick = async (): Promise<void> => {
    if (!window.confirm('이 릭을 삭제할까요? 원본이면 좋아요는 다음 유사릭이 승계해요.')) return;
    await deleteLick(lick.id);
    navigate('/');
  };

  const toUser = (publicId: string) => (e: { preventDefault: () => void }): void => {
    e.preventDefault();
    navigate('/user/' + publicId);
  };

  const toCanonical = (canonicalId: string) => (e: { preventDefault: () => void }): void => {
    e.preventDefault();
    navigate('/lick/' + canonicalId);
  };

  return (
    <div className="c-detail">
      <div className="c-detail-title">{lick.title}</div>
      <div className="c-meta">
        {profiles && (
          <a href={'/user/' + profiles.public_id} onClick={toUser(profiles.public_id)}>
            {profiles.display_name}
          </a>
        )}
        <span>{new Date(lick.created_at).toLocaleDateString('ko-KR')}</span>
      </div>
      {lick.canonical_id && (
        <p className="c-notice">
          이 릭은 유사릭이에요. 좋아요는{' '}
          <a href={'/lick/' + lick.canonical_id} onClick={toCanonical(lick.canonical_id)}>
            원본 릭
          </a>
          에 모여요 (♥ {count})
        </p>
      )}
      <Score song={song} mode="view" width={420} onNoteTap={onNoteTap} />
      <div className="c-row">
        <button type="button" className="c-btn" onClick={onTogglePlay}>
          {playing ? '정지' : '전곡 재생'}
        </button>
        <LikeButton liked={liked} count={count} onToggle={onToggleLike} disabled={likeBusy} />
      </div>
      {likeMsg && <p className="c-state">{likeMsg}</p>}
      {isAuthor && (
        <button type="button" className="c-danger" onClick={() => void onDeleteClick()}>
          삭제
        </button>
      )}
    </div>
  );
};

/** id별로 완전히 새 인스턴스 — 유사릭 원본 링크 등 같은 라우트 내 id 전환 시에도 상태를 리셋 (Feed의 key 리마운트와 동일 패턴) */
export const LickDetail = (props: Props): JSX.Element => <LickDetailView key={props.id} {...props} />;
