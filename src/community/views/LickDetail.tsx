/**
 * 릭 상세 (핸드오프 시안 C + 설계 §7, §9, §11).
 * 구조: LickHeader → ScoreFrame(툴바+악보) → LickFooter(액션+태그) → DeleteLickDialog.
 * primary는 페이지당 하나(Duplicate & edit). 재생·반복·템포는 전부 프레임 안 툴바에.
 * 파괴적 액션(Delete)은 오버플로 메뉴 + 확인 다이얼로그로 격하한다.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { measCountAll, total } from '../../core/geometry';
import { asStep, type Song } from '../../core/types';
import { Score } from '../../ui/components/edit/Score';
import { deleteLick, fetchLick, type LickRow } from '../api/licks';
import { addLike, fetchLikeCounts, fetchMyLikedSet, likeTargetId, removeLike } from '../api/likes';
import { DeleteLickDialog } from '../components/DeleteLickDialog';
import { LickActions } from '../components/LickActions';
import { OverflowMenu } from '../components/OverflowMenu';
import { ScoreFrame } from '../components/ScoreFrame';
import { ScoreToolbar } from '../components/ScoreToolbar';
import { TagChips } from '../components/TagChips';
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

// 열람 재생: 각 종류를 모두 내보내고 실제 소리는 곡 데이터(accPat/metro)가 결정
const VIEW_OPTS = { melody: true, accomp: true, metro: true };

/** 못갖춘마디를 제외한 표시용 마디 수 */
const barCount = (song: Song): number => measCountAll(song) - (song.pickup ? 1 : 0);

const LickDetailView = ({ id, user, player }: Props): JSX.Element => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 재생/툴바 세션 상태 (bpm·loop는 세션 한정 — 저장하지 않는다)
  const [playing, setPlaying] = useState(false);
  const [playheadStep, setPlayheadStep] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  // 삭제 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const started = useRef(false);
  const alive = useRef(true);
  const lastEl = useRef(0);

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
        setBpm(song.tempo); // 세션 기본 템포 = 원곡 템포
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

  if (phase.kind === 'loading') return <p className="c-state">Loading…</p>;
  if (phase.kind === 'notfound')
    return (
      <div className="c-detail">
        <p className="c-state">Lick not found</p>
        <a href="/" onClick={(e) => (e.preventDefault(), navigate('/'))}>
          Back to Latest
        </a>
      </div>
    );
  if (phase.kind === 'baddecode')
    return (
      <div className="c-detail">
        <p className="c-state">Couldn&apos;t read this score</p>
        <a href="/" onClick={(e) => (e.preventDefault(), navigate('/'))}>
          Back to Latest
        </a>
      </div>
    );

  const { lick, song } = phase;
  const profiles = lick.profiles;
  const isOwner = user?.id === lick.author_id;
  const tempo = bpm ?? song.tempo;

  /* 세션 템포로 재생 — bpm은 곡을 바꾸지 않고 지금 듣는 속도만 바꾼다 */
  const playFrom = (fromStep: number): void => {
    player.play({ ...song, tempo }, VIEW_OPTS, asStep(fromStep), asStep(total(song)), loop);
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
    // 재생 중 변경은 현재 위치에서 새 템포로 이어 재생 (핸드오프 §10)
    if (player.isPlaying()) {
      player.play(
        { ...song, tempo: v },
        VIEW_OPTS,
        asStep(Math.floor(lastEl.current)),
        asStep(total(song)),
        loop,
      );
    }
  };

  const onNoteTap = (noteId: number): void => {
    const note = song.notes.find((n) => n.id === noteId);
    if (note) playFrom(note.s);
  };

  const onShare = (): void => {
    const url = `${window.location.origin}/lick/${lick.id}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      void nav.share({ title: lick.title, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => setToast('Link copied'));
    } else {
      window.prompt('Copy this link', url);
    }
  };

  const onDuplicate = (): void => {
    // 이 앱은 편집이 비로그인 허용 — 복제에 로그인 게이트를 두지 않는다
    navigate('/edit#' + lick.blob);
  };

  /* 낙관적 토글 — single-flight: 요청 진행 중에는 버튼을 비활성화해 중복 토글의
     롤백 경합(늦게 실패한 요청이 다른 토글의 카운트를 되돌리는 문제)을 원천 차단 */
  const onToggleLike = (): void => {
    if (likeBusy) return;
    if (!user) {
      setToast('Sign in to like');
      return;
    }
    const target = likeTargetId(lick);
    const next = !liked;
    setLikeBusy(true);
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    void (next ? addLike(target) : removeLike(target))
      .catch(() => {
        if (!alive.current) return;
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
        setToast('Like failed');
      })
      .finally(() => {
        if (alive.current) setLikeBusy(false);
      });
  };

  const onConfirmDelete = async (): Promise<void> => {
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await deleteLick(lick.id);
      player.stop();
      setToast('Lick deleted');
      navigate('/me');
    } catch {
      if (!alive.current) return;
      setDeleteBusy(false);
      setDeleteErr('Delete failed. Please try again.');
    }
  };

  const toUser =
    (publicId: string) =>
    (e: { preventDefault: () => void }): void => {
      e.preventDefault();
      navigate('/user/' + publicId);
    };

  const toCanonical =
    (canonicalId: string) =>
    (e: { preventDefault: () => void }): void => {
      e.preventDefault();
      navigate('/lick/' + canonicalId);
    };

  return (
    <div className="c-detail">
      <header className="c-lickhead">
        <div className="c-lickhead-title">
          <span className="c-detail-title">{lick.title}</span>
          <span className="c-badge">Key of C</span>
          <span className="c-badge">{barCount(song)} bars</span>
        </div>
        <div className="c-meta">
          {profiles && (
            <a href={'/user/' + profiles.public_id} onClick={toUser(profiles.public_id)}>
              {profiles.display_name}
            </a>
          )}
          <span>{new Date(lick.created_at).toLocaleDateString('en-US')}</span>
        </div>
      </header>

      {lick.canonical_id && (
        <p className="c-notice">
          This is a similar lick. Likes are collected on the{' '}
          <a href={'/lick/' + lick.canonical_id} onClick={toCanonical(lick.canonical_id)}>
            original lick
          </a>{' '}
          (♥ {count})
        </p>
      )}

      <ScoreFrame
        toolbar={
          <ScoreToolbar
            playing={playing}
            loop={loop}
            bpm={tempo}
            onTogglePlay={onTogglePlay}
            onToggleLoop={onToggleLoop}
            onBpmChange={onBpmChange}
            overflow={<OverflowMenu isOwner={isOwner} onDelete={() => setDialogOpen(true)} />}
          />
        }
      >
        <Score
          song={song}
          mode="view"
          width={420}
          {...(playheadStep !== null ? { playheadStep } : {})}
          onNoteTap={onNoteTap}
        />
      </ScoreFrame>

      <footer className="c-footer">
        <LickActions
          likeCount={count}
          isLiked={liked}
          likeBusy={likeBusy}
          onDuplicate={onDuplicate}
          onLike={onToggleLike}
          onShare={onShare}
        />
        <TagChips tags={lick.tags} />
      </footer>

      <DeleteLickDialog
        open={dialogOpen}
        busy={deleteBusy}
        error={deleteErr}
        onCancel={() => {
          if (!deleteBusy) {
            setDialogOpen(false);
            setDeleteErr(null);
          }
        }}
        onConfirm={() => void onConfirmDelete()}
      />

      {toast && (
        <div className="c-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
};

/** id별로 완전히 새 인스턴스 — 유사릭 원본 링크 등 같은 라우트 내 id 전환 시에도 상태를 리셋 (Feed의 key 리마운트와 동일 패턴) */
export const LickDetail = (props: Props): JSX.Element => (
  <LickDetailView key={props.id} {...props} />
);
