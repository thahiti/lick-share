/**
 * 전체 화면 넘기기 재생 (swipe-play 명세 R4 ~ R16).
 * 목록 위 오버레이다. 새 라우트가 아니라 history 항목 하나를 넣고 popstate 로 닫는다.
 * 목록이 받아 둔 행과 loadMore 를 그대로 써서 순서가 목록과 같다.
 * 현재 장(60% 이상 보이는 장)만 재생하고, 끝나면 4박 무음 뒤 처음부터 반복한다.
 */
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { total } from '../../core/geometry';
import { asStep, type Song } from '../../core/types';
import { Icon } from '../../ui/components/common/Icon';
import { Score } from '../../ui/components/edit/Score';
import { useElementWidth } from '../../ui/hooks/useElementWidth';
import type { LickRow } from '../api/licks';

// 열람과 같이 종류를 모두 내보내고 실제 소리는 곡 데이터가 정한다 (R5)
const VIEW_OPTS = { melody: true, accomp: true, metro: true };
const LOOP = { gapBeats: 4 };

interface Props {
  readonly licks: readonly LickRow[];
  readonly counts: ReadonlyMap<string, number>;
  readonly startIndex: number;
  readonly hasMore: boolean;
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
  readonly lick: LickRow;
  readonly song: Song | null;
  readonly playheadStep: number | null;
}

const Page = ({ lick, song, playheadStep }: PageProps): JSX.Element => {
  const [boxRef, width] = useElementWidth(358);
  return (
    <section className="c-play-page">
      <div className="c-play-body">
        <div className="c-play-frame" ref={boxRef}>
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
      </div>
    </section>
  );
};

export const PlayOverlay = ({
  licks,
  startIndex,
  source,
  player,
  onClose,
}: Props): JSX.Element => {
  const [index] = useState(startIndex);
  const [playheadStep, setPlayheadStep] = useState<number | null>(null);
  const songs = useMemo(() => licks.map((l) => decodeSong(l.blob)), [licks]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /* R4: history 항목 하나. 뒤로 가기(popstate)가 닫는다. 닫기 버튼은 history.back 으로 같은 길을 탄다 */
  useEffect(() => {
    window.history.pushState({ swipePlay: true }, '');
    const onPop = (): void => {
      player.stop();
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [player]);

  /* 시작 장으로 스크롤하고 닫기 버튼에 포커스 (R13) */
  useEffect(() => {
    const pager = pagerRef.current;
    if (pager) pager.scrollTop = pager.clientHeight * startIndex;
    closeRef.current?.focus();
  }, [startIndex]);

  /* R5, R6: 현재 장이 정해지면 그 곡을 0 부터 간격 반복으로 재생 */
  useEffect(() => {
    const song = songs[index];
    if (!song) return;
    player.play(song, VIEW_OPTS, asStep(0), asStep(total(song)), LOOP);
  }, [index, songs, player]);

  /* 플레이헤드 구독, 언마운트 시 정지 (R4, R8) */
  useEffect(() => {
    const unsubTick = player.onTick((el) => setPlayheadStep(el));
    return () => {
      unsubTick();
      player.stop();
    };
  }, [player]);

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
              lick={lick}
              song={songs[i] ?? null}
              playheadStep={i === index ? playheadStep : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
