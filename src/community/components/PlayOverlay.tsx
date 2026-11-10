/**
 * 전체 화면 넘기기 재생 (swipe-play 명세 R4 ~ R16).
 * 목록 위 오버레이다. 새 라우트가 아니라 history 항목 하나를 넣고 popstate 로 닫는다.
 * 목록이 받아 둔 행과 loadMore 를 그대로 써서 순서가 목록과 같다.
 * 현재 장(60% 이상 보이는 장)만 재생하고, 끝나면 4박 무음 뒤 처음부터 반복한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { total } from '../../core/geometry';
import { asStep, type Song } from '../../core/types';
import { Icon } from '../../ui/components/common/Icon';
import { Score } from '../../ui/components/edit/Score';
import { useElementWidth } from '../../ui/hooks/useElementWidth';
import type { LickRow } from '../api/licks';
import { addLike, fetchMyLikedSet, likeTargetId, removeLike } from '../api/likes';
import { LikeButton } from './LikeButton';

// 열람과 같이 종류를 모두 내보내고 실제 소리는 곡 데이터가 정한다 (R5)
const VIEW_OPTS = { melody: true, accomp: true, metro: true };
const LOOP = { gapBeats: 4 };
const HINT_KEY = 'swipe-play-hint';
/* 60% 보인 장이 이만큼 유지돼야 현재가 된다. 두 장을 한 번에 넘길 때
   지나가는 중간 장이 잠깐 재생되는 것을 막는다 (E3, S8) */
const SETTLE_MS = 120;

const readHint = (): boolean => {
  try {
    return localStorage.getItem(HINT_KEY) !== '1';
  } catch {
    return true;
  }
};
const writeHint = (): void => {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* 저장 못 하면 다음에 다시 보인다 (R10) */
  }
};

interface Props {
  readonly licks: readonly LickRow[];
  readonly counts: ReadonlyMap<string, number>;
  readonly startIndex: number;
  readonly hasMore: boolean;
  /** 목록의 다음 페이지 불러오기가 실패한 상태 (E2) */
  readonly loadError: boolean;
  readonly loadMore: () => Promise<boolean>;
  /** 상단 바의 출처 라벨 (R14) */
  readonly source: string;
  readonly player: Player;
  readonly user: User | null;
  readonly onClose: () => void;
  /** 좋아요 토글 결과를 목록 카운트에 반영 (R11) */
  readonly onCount: (targetId: string, count: number) => void;
}

interface PageProps {
  readonly index: number;
  readonly lick: LickRow;
  readonly song: Song | null;
  readonly current: boolean;
  readonly playing: boolean;
  readonly playheadStep: number | null;
  /** 간격 중 남은 박 수 (R8). null 이면 간격이 아니다 */
  readonly countdown: number | null;
  readonly last: boolean;
  readonly loadError: boolean;
  readonly source: string;
  readonly onTap: () => void;
  readonly onRetry: () => void;
  readonly count: number;
  readonly liked: boolean;
  readonly onLike: () => void;
  readonly onShare: () => void;
  readonly onDuplicate: () => void;
}

const Page = ({
  index,
  lick,
  song,
  current,
  playing,
  playheadStep,
  countdown,
  last,
  loadError,
  source,
  onTap,
  onRetry,
  count,
  liked,
  onLike,
  onShare,
  onDuplicate,
}: PageProps): JSX.Element => {
  const [boxRef, width] = useElementWidth(358);
  return (
    <section className="c-play-page" data-index={index}>
      <div className="c-play-body">
        {/* R7: 악보 탭은 멈춤과 재개. 음표 탭 핸들러를 주지 않아 클릭이 여기로 올라온다 */}
        <div
          className={countdown !== null ? 'c-play-frame c-play-frame--dim' : 'c-play-frame'}
          ref={boxRef}
          onClick={onTap}
        >
          {song ? (
            <Score
              song={song}
              mode="view"
              width={width}
              {...(playheadStep !== null ? { playheadStep } : {})}
            />
          ) : (
            <p className="c-state">Couldn&apos;t read this score</p>
          )}
          {countdown !== null && (
            <div className="c-play-count" aria-live="polite">
              <div className="c-play-count-num">{countdown}</div>
              <div className="c-play-count-cap">Again in</div>
              <div className="c-play-count-dots">
                {[0, 1, 2, 3].map((b) => (
                  <i key={b} className={b < LOOP.gapBeats - countdown ? 'on' : ''} />
                ))}
              </div>
            </div>
          )}
          {current && !playing && song && (
            <div className="c-play-paused">
              <span>
                <Icon name="play" color="var(--paper)" size={30} />
              </span>
            </div>
          )}
        </div>
        <h2 className="c-play-title">{lick.title}</h2>
        <div className="c-play-meta">
          {lick.profiles && <span>{lick.profiles.display_name}</span>}
          <span>{new Date(lick.created_at).toLocaleDateString('en-US')}</span>
        </div>
        {/* R12: 작성자와 태그는 표시만. 링크가 아니다 */}
        {lick.tags.length > 0 && (
          <div className="c-play-tags">
            {lick.tags.map((t) => (
              <span key={t} className="c-tag">
                {'#' + t}
              </span>
            ))}
          </div>
        )}
        {last && <p className="c-play-end">{`This is the last lick in ${source}`}</p>}
        {loadError && (
          <p className="c-play-end">
            Couldn&apos;t load more{' '}
            <button type="button" className="c-btn" onClick={onRetry}>
              Retry
            </button>
          </p>
        )}
      </div>
      {/* R11, R16: 액션 행은 장 하단에 고정. 순서는 상세와 같다 */}
      <div className="c-play-actions">
        <button type="button" className="c-play-dup" onClick={onDuplicate}>
          <Icon name="plus" color="var(--brand-primary-text)" size={14} />
          Duplicate &amp; edit
        </button>
        <LikeButton liked={liked} count={count} onToggle={onLike} />
        <button type="button" className="c-play-share" onClick={onShare}>
          <Icon name="share" color="var(--ink)" size={15} />
          Share
        </button>
      </div>
    </section>
  );
};

export const PlayOverlay = ({
  licks,
  counts,
  startIndex,
  hasMore,
  loadError,
  loadMore,
  source,
  player,
  user,
  onClose,
  onCount,
}: Props): JSX.Element => {
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(true);
  const [playheadStep, setPlayheadStep] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hint, setHint] = useState(readHint);
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const likeBusy = useRef(new Set<string>());
  const popRef = useRef<() => void>(() => {});
  const hintRef = useRef(hint);
  const indexRef = useRef(startIndex);
  const songs = useMemo(() => licks.map((l) => decodeSong(l.blob)), [licks]);
  const songsRef = useRef(songs);
  const playingRef = useRef(true);
  const lastEl = useRef(0);
  const loading = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
    songsRef.current = songs;
  });

  /* 곡 목록이 늘어도(loadMore) 현재 곡을 다시 시작하지 않도록 ref 로 읽는다 */
  const startFrom = useCallback(
    (i: number, step: number): void => {
      const song = songsRef.current[i];
      if (!song) {
        player.stop();
        return;
      }
      player.play(song, VIEW_OPTS, asStep(step), asStep(total(song)), LOOP);
    },
    [player],
  );

  /* R4: history 항목 하나. 뒤로 가기(popstate)가 닫는다. 닫기 버튼은 history.back 으로 같은 길을 탄다 */
  useEffect(() => {
    window.history.pushState({ swipePlay: true }, '');
    const onPop = (): void => {
      player.stop();
      onCloseRef.current();
    };
    popRef.current = onPop;
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [player]);

  /* R11: 내 좋아요 집합은 열릴 때 한 번. 비로그인은 빈 집합 */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchMyLikedSet(user.id).then((set) => {
      if (alive) setLiked(set);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  /* 토스트 자동 소멸 (상세와 같은 1.6초) */
  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  /* R11: 낙관적 토글, 대상마다 단일 요청, 실패는 되돌림. 결과는 목록 카운트로 */
  const onLike = (lick: LickRow): void => {
    if (!user) {
      setToast('Sign in to like');
      return;
    }
    const target = likeTargetId(lick);
    if (likeBusy.current.has(target)) return;
    const was = liked.has(target);
    const count = counts.get(target) ?? 0;
    const withTarget = (prev: ReadonlySet<string>, add: boolean): ReadonlySet<string> => {
      const next = new Set(prev);
      if (add) next.add(target);
      else next.delete(target);
      return next;
    };
    likeBusy.current.add(target);
    setLiked((prev) => withTarget(prev, !was));
    onCount(target, count + (was ? -1 : 1));
    void (was ? removeLike(target) : addLike(target))
      .catch(() => {
        setLiked((prev) => withTarget(prev, was));
        onCount(target, count);
        setToast('Like failed');
      })
      .finally(() => likeBusy.current.delete(target));
  };

  /* R11: 공유는 단축 URL. 상세와 같은 순서(공유 시트, 클립보드, 프롬프트) */
  const onShare = (lick: LickRow): void => {
    const url = `${window.location.origin}/s/${lick.id}`;
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

  /* R11: 오버레이 항목을 편집 항목으로 바꿔 편집의 Back 이 목록으로 돌아오게 한다 */
  const onDuplicate = (lick: LickRow): void => {
    player.stop();
    window.removeEventListener('popstate', popRef.current);
    window.history.replaceState(null, '', '/edit#' + lick.blob);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  /* 시작 장으로 스크롤하고 닫기 버튼에 포커스 (R13) */
  useEffect(() => {
    const pager = pagerRef.current;
    if (pager) pager.scrollTop = pager.clientHeight * startIndex;
    closeRef.current?.focus();
  }, [startIndex]);

  /* 장 전환 (R5, R6, R8, R10): 재생 중이면 새 곡을 0 부터, 멈춘 상태면 앞 곡도 멈춘다.
     플레이헤드와 힌트도 여기서 정리한다 */
  const goTo = useCallback(
    (i: number): void => {
      if (i === indexRef.current) return;
      indexRef.current = i;
      lastEl.current = 0;
      setIndex(i);
      setPlayheadStep(null);
      if (hintRef.current) {
        hintRef.current = false;
        setHint(false);
        writeHint();
      }
      if (playingRef.current) startFrom(i, 0);
      else player.stop();
    },
    [startFrom, player],
  );

  /* R5: 열리면 시작 장의 곡을 0 부터 */
  useEffect(() => {
    startFrom(startIndex, 0);
  }, [startFrom, startIndex]);

  /* R6: 현재 장 판정. 60% 이상 보인 장이 SETTLE_MS 동안 유지되면 현재가 된다 */
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (Number.isNaN(i)) continue;
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => goTo(i), SETTLE_MS);
        }
      },
      { root: pager, threshold: 0.6 },
    );
    pager.querySelectorAll('.c-play-page').forEach((el) => io.observe(el));
    return () => {
      if (timer !== null) clearTimeout(timer);
      io.disconnect();
    };
  }, [licks.length, goTo]);

  /* R7: 멈춤과 재개 */
  const toggle = (): void => {
    if (playingRef.current) {
      player.stop();
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    const song = songsRef.current[index];
    const from = song && lastEl.current < total(song) ? Math.floor(lastEl.current) : 0;
    startFrom(index, from);
    playingRef.current = true;
    setPlaying(true);
  };

  /* 플레이헤드와 간격 구독, 언마운트 시 정지 (R4, R8). 간격은 stop 이나 새 play 가 null 로 끝낸다 */
  useEffect(() => {
    const unsubTick = player.onTick((el) => {
      lastEl.current = el;
      setPlayheadStep(el);
    });
    const unsubGap = player.onGap((n) => setCountdown(n));
    return () => {
      unsubTick();
      unsubGap();
      player.stop();
    };
  }, [player]);

  /* R9: 뒤에서 두 번째 장에 이르면 다음 페이지를 미리 받는다. 진행 중에는 다시 부르지 않는다 */
  useEffect(() => {
    if (index < licks.length - 2 || !hasMore || loading.current) return;
    loading.current = true;
    void loadMore().finally(() => {
      loading.current = false;
    });
  }, [index, licks.length, hasMore, loadMore]);

  return (
    <div className="c-play" role="dialog" aria-modal="true">
      <div className="c-play-panel">
        <div className="c-play-top">
          <button
            ref={closeRef}
            type="button"
            className="c-play-close"
            aria-label="Close"
            onClick={() => window.history.back()}
          >
            <Icon name="close" color="var(--ink)" size={16} />
          </button>
          <span className="c-play-counter">{`${index + 1} / ${licks.length}`}</span>
          <span className="c-play-source">{source}</span>
        </div>
        <div className="c-play-pager" ref={pagerRef}>
          {licks.map((lick, i) => (
            <Page
              key={lick.id}
              index={i}
              lick={lick}
              song={songs[i] ?? null}
              current={i === index}
              playing={playing}
              playheadStep={i === index ? playheadStep : null}
              countdown={i === index ? countdown : null}
              last={!hasMore && !loadError && i === licks.length - 1}
              loadError={loadError && i === licks.length - 1}
              source={source}
              onTap={toggle}
              onRetry={() => void loadMore()}
              count={counts.get(likeTargetId(lick)) ?? 0}
              liked={user !== null && liked.has(likeTargetId(lick))}
              onLike={() => onLike(lick)}
              onShare={() => onShare(lick)}
              onDuplicate={() => onDuplicate(lick)}
            />
          ))}
        </div>
        {toast && (
          <div className="c-toast" role="status">
            {toast}
          </div>
        )}
        {hint && (
          <div className="c-play-hint">
            <Icon name="up" color="var(--paper)" size={14} />
            Swipe up for the next lick
          </div>
        )}
      </div>
    </div>
  );
};
