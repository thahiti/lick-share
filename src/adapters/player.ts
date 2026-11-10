/**
 * player — 재생 세션 관리 + onTick 구독 + 실시간 토글 (설계 문서 §2).
 * 시각 좌표: 이벤트 t는 세션 시작(fromStep)이 0인 상대 초. sink epoch와 동일 기준.
 * 재생 상태는 React 밖에서 관리하고 onTick으로 플레이헤드만 전달한다 (설계 문서 §3).
 */
import { total } from '../core/geometry';
import { asMidi, asSec, asStep, type Sec, type Song, type Step } from '../core/types';
import { COUNT_IN_BEATS, recordingEvents, schedule, secPerStep, type PlayOpts } from '../engine/schedule';
import type { AudioSink } from '../ports/audio-sink';
import type { Clock } from '../ports/clock';

/** 간격 있는 반복: toStep 에 닿으면 gapBeats 박을 쉬고 fromStep 부터 다시 (swipe-play R1) */
export interface LoopGap {
  readonly gapBeats: number;
}

export interface PlayerDeps {
  readonly sink: AudioSink;
  readonly clock: Clock;
}

export interface Player {
  isPlaying(): boolean;
  play(song: Song, opts: PlayOpts, fromStep: Step, toStep?: Step, loop?: boolean | LoopGap): void;
  stop(): void;
  /** 재생 중 반복 토글: on=toStep 도달 시 fromStep부터 되감아 계속 */
  setLoop(on: boolean): void;
  /** 재생 중 메트로놈 토글: on=현재 이후 박만 스케줄, off=클릭 노드만 정지.
   *  song을 주면 새 곡(metro 패턴 변경 반영)으로 재스케줄 */
  toggleMetro(on: boolean, song?: Song): void;
  /** 재생 중 반주 토글. song을 주면 새 곡(패턴 변경 등)으로 재스케줄 */
  toggleAcc(on: boolean, song?: Song): void;
  /** 진행 스텝(el) 구독. 반환값은 해제 함수 */
  onTick(cb: (el: number) => void): () => void;
  /** 세션 종료(자동/수동) 구독. 반환값은 해제 함수 */
  onEnded(cb: () => void): () => void;
  /** 간격 진행 구독: 남은 박 수(4, 3, 2, 1), 간격이 끝나거나 버려지면 null (swipe-play R2) */
  onGap(cb: (beatsLeft: number | null) => void): () => void;
  /** 레코딩 세션: 예비박(1마디) 후 fromStep부터 곡 끝까지 사운드.
   *  onFrame(t)는 본편 시작 기준 상대 초 — 예비박 동안 음수 */
  record(song: Song, accomp: boolean, fromStep: Step, onFrame: (t: Sec) => void): void;
  isRecording(): boolean;
  /** 입력·선택 프리뷰 사운드 (짧은 고정 길이) */
  preview(midi: number): void;
  /** 건반 홀드 프리뷰 — previewUp까지 지속 발음 */
  previewDown(midi: number): void;
  previewUp(midi: number): void;
}

interface Session {
  song: Song;
  opts: PlayOpts;
  loop: boolean | LoopGap;
  /** 간격 종료 시각(sink epoch). null 이면 간격이 아니다 */
  gapUntil: number | null;
  /** 마지막으로 알린 남은 박 수 */
  gapLeft: number | null;
  readonly fromStep: Step;
  readonly toStep: Step;
  /** sink epoch 기준 시작 시각 — 반복 되감김 시 갱신되므로 가변 */
  t0: number;
  readonly sps: number;
  readonly unsubFrame: () => void;
}

export const createPlayer = ({ sink, clock }: PlayerDeps): Player => {
  let session: Session | null = null;
  /** 레코딩 세션 프레임 구독 해제 (null=레코딩 아님) */
  let recUnsub: (() => void) | null = null;
  const tickCbs = new Set<(el: number) => void>();
  const endedCbs = new Set<() => void>();
  const gapCbs = new Set<(n: number | null) => void>();

  /** 진행 스텝 — 시작 전에는 fromStep으로 클램프 (measOf 음수 방지) */
  const elapsed = (s: Session): number =>
    Math.max(s.fromStep, (sink.now() - s.t0) / s.sps + s.fromStep);

  const stop = (): void => {
    if (!session && !recUnsub) return;
    if (session && session.gapUntil !== null) gapCbs.forEach((cb) => cb(null));
    session?.unsubFrame();
    session = null;
    recUnsub?.();
    recUnsub = null;
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

    play(song, opts, fromStep, toStep, loop = false) {
      stop();
      /* 세션이 없었어도 항상 리셋 — 프리뷰가 남긴 스테일 epoch로
         과거 시각에 스케줄되면 무음이 된다 (회귀 테스트 참조) */
      sink.stop();
      const sps = secPerStep(song.tempo);
      const t0 = sink.now() + 0.06; // sink epoch과 동일
      const unsubFrame = clock.onFrame(() => {
        if (!session) return;
        if (session.gapUntil !== null) {
          const now = sink.now();
          if (now >= session.gapUntil) {
            session.gapUntil = null;
            session.gapLeft = null;
            session.t0 = now + 0.06;
            sink.play(schedule(session.song, session.opts, session.fromStep, session.toStep));
            gapCbs.forEach((cb) => cb(null));
            return;
          }
          // 부동소수 오차로 정확한 박 경계가 한 박 위로 올림되지 않게 작은 여유를 뺀다
          const left = Math.ceil((session.gapUntil - now) / (4 * session.sps) - 1e-9);
          if (left !== session.gapLeft) {
            session.gapLeft = left;
            gapCbs.forEach((cb) => cb(left));
          }
          return;
        }
        const el = elapsed(session);
        if (el >= session.toStep) {
          if (typeof session.loop === 'object') {
            // 간격 진입: 남은 소리를 끊고 gapBeats 박 뒤 재시작을 예약 (정지, onEnded 없음)
            const gapBeats = session.loop.gapBeats;
            sink.stop();
            session.gapUntil = sink.now() + gapBeats * 4 * session.sps;
            session.gapLeft = gapBeats;
            gapCbs.forEach((cb) => cb(gapBeats));
            return;
          }
          if (session.loop) {
            // 되감기: 새 epoch으로 fromStep부터 다시 스케줄 (정지·onEnded 없음)
            session.t0 = sink.now() + 0.06;
            sink.stop();
            sink.play(schedule(session.song, session.opts, session.fromStep, session.toStep));
            return;
          }
          stop();
          return;
        }
        tickCbs.forEach((cb) => cb(el));
      });
      session = {
        song,
        opts,
        loop,
        gapUntil: null,
        gapLeft: null,
        fromStep,
        toStep: toStep ?? asStep(total(song)),
        t0,
        sps,
        unsubFrame,
      };
      sink.play(schedule(song, opts, fromStep, session.toStep));
    },

    stop,

    setLoop(on) {
      if (session) session.loop = on;
    },

    toggleMetro(on, song) {
      if (!session) return;
      if (song) session.song = song;
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

    onGap(cb) {
      gapCbs.add(cb);
      return () => gapCbs.delete(cb);
    },

    record(song, accomp, fromStep, onFrame) {
      stop();
      sink.stop(); // 프리뷰가 남긴 스테일 epoch 리셋 (play와 동일한 이유)
      const ciLen = COUNT_IN_BEATS * 4 * secPerStep(song.tempo);
      const t0 = sink.now() + 0.06; // sink epoch과 동일
      recUnsub = clock.onFrame(() => {
        if (!recUnsub) return;
        onFrame(asSec(sink.now() - t0 - ciLen));
      });
      sink.play(recordingEvents(song, accomp, fromStep));
    },

    isRecording: () => recUnsub !== null,

    preview(midi) {
      sink.playNow([
        { kind: 'melody', midi: asMidi(midi), t: asSec(0), dur: asSec(0.35), vol: 0.22 },
      ]);
    },

    previewDown(midi) {
      sink.noteOn(asMidi(midi), 0.22);
    },

    previewUp(midi) {
      sink.noteOff(asMidi(midi));
    },
  };
};
