/**
 * player — 재생 세션 관리 + onTick 구독 + 실시간 토글 (설계 문서 §2).
 * 시각 좌표: 이벤트 t는 세션 시작(fromStep)이 0인 상대 초. sink epoch와 동일 기준.
 * 재생 상태는 React 밖에서 관리하고 onTick으로 플레이헤드만 전달한다 (설계 문서 §3).
 */
import { total } from '../core/geometry';
import { asMidi, asSec, asStep, type Song, type Step } from '../core/types';
import { schedule, secPerStep, type PlayOpts } from '../engine/schedule';
import type { AudioSink } from '../ports/audio-sink';
import type { Clock } from '../ports/clock';

export interface PlayerDeps {
  readonly sink: AudioSink;
  readonly clock: Clock;
}

export interface Player {
  isPlaying(): boolean;
  play(song: Song, opts: PlayOpts, fromStep: Step, toStep?: Step): void;
  stop(): void;
  /** 재생 중 메트로놈 토글: on=현재 이후 박만 스케줄, off=클릭 노드만 정지 */
  toggleMetro(on: boolean): void;
  /** 재생 중 반주 토글. song을 주면 새 곡(패턴 변경 등)으로 재스케줄 */
  toggleAcc(on: boolean, song?: Song): void;
  /** 진행 스텝(el) 구독. 반환값은 해제 함수 */
  onTick(cb: (el: number) => void): () => void;
  /** 세션 종료(자동/수동) 구독. 반환값은 해제 함수 */
  onEnded(cb: () => void): () => void;
  /** 입력·선택 프리뷰 사운드 */
  preview(midi: number): void;
}

interface Session {
  song: Song;
  opts: PlayOpts;
  readonly fromStep: Step;
  readonly toStep: Step;
  readonly t0: number;
  readonly sps: number;
  readonly unsubFrame: () => void;
}

export const createPlayer = ({ sink, clock }: PlayerDeps): Player => {
  let session: Session | null = null;
  const tickCbs = new Set<(el: number) => void>();
  const endedCbs = new Set<() => void>();

  /** 진행 스텝 — 시작 전에는 fromStep으로 클램프 (measOf 음수 방지) */
  const elapsed = (s: Session): number =>
    Math.max(s.fromStep, (sink.now() - s.t0) / s.sps + s.fromStep);

  const stop = (): void => {
    if (!session) return;
    session.unsubFrame();
    session = null;
    sink.stop();
    endedCbs.forEach((cb) => cb());
  };

  /** 현재 위치 이후의 kind 이벤트만 다시 스케줄 (프로토타입 elFrom 필터와 동일) */
  const rescheduleFrom = (s: Session, opts: PlayOpts): void => {
    const el = elapsed(s);
    const cutoff = (el - s.fromStep) * s.sps - 0.01;
    sink.play(schedule(s.song, opts, s.fromStep, s.toStep).filter((e) => e.t >= cutoff));
  };

  return {
    isPlaying: () => session !== null,

    play(song, opts, fromStep, toStep) {
      stop();
      /* 세션이 없었어도 항상 리셋 — 프리뷰가 남긴 스테일 epoch로
         과거 시각에 스케줄되면 무음이 된다 (회귀 테스트 참조) */
      sink.stop();
      const sps = secPerStep(song.tempo);
      const t0 = sink.now() + 0.06; // sink epoch과 동일
      const unsubFrame = clock.onFrame(() => {
        if (!session) return;
        const el = elapsed(session);
        if (el >= session.toStep) {
          stop();
          return;
        }
        tickCbs.forEach((cb) => cb(el));
      });
      session = { song, opts, fromStep, toStep: toStep ?? asStep(total(song)), t0, sps, unsubFrame };
      sink.play(schedule(song, opts, fromStep, session.toStep));
    },

    stop,

    toggleMetro(on) {
      if (!session) return;
      session.opts = { ...session.opts, metro: on };
      if (on) {
        rescheduleFrom(session, { melody: false, accomp: false, metro: true });
      } else {
        sink.cancelFrom(asSec(0), ['metro']);
      }
    },

    toggleAcc(on, song) {
      if (!session) return;
      if (song) session.song = song;
      session.opts = { ...session.opts, accomp: on };
      sink.cancelFrom(asSec(0), ['acc']);
      if (on) rescheduleFrom(session, { melody: false, accomp: true, metro: false });
    },

    onTick(cb) {
      tickCbs.add(cb);
      return () => tickCbs.delete(cb);
    },

    onEnded(cb) {
      endedCbs.add(cb);
      return () => endedCbs.delete(cb);
    },

    preview(midi) {
      sink.playNow([
        { kind: 'melody', midi: asMidi(midi), t: asSec(0), dur: asSec(0.35), vol: 0.22 },
      ]);
    },
  };
};
