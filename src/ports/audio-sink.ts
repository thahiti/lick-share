/**
 * AudioSink 포트 — 소리를 낸다 (설계 문서 §2).
 * SoundEvent의 종류 태그(melody/acc/metro)로 부분 토글 시 해당 노드군만 취소한다.
 */
import type { Midi, Sec } from '../core/types';

export type SoundKind = 'melody' | 'acc' | 'metro';

export type SoundEvent =
  | {
      readonly kind: 'melody' | 'acc';
      readonly midi: Midi;
      /** 스케줄 시작 기준 상대 시각 */
      readonly t: Sec;
      readonly dur: Sec;
      readonly vol: number;
    }
  | {
      readonly kind: 'metro';
      readonly t: Sec;
      readonly freq: number;
      readonly vol: number;
    };

export interface AudioSink {
  /** 오디오 시계 (재생 진행 계산의 기준) */
  now(): Sec;
  play(events: readonly SoundEvent[]): void;
  /** 세션 epoch과 무관하게 현재 시각 기준으로 즉시 발음 (프리뷰용 — 과거 스케줄 방지) */
  playNow(events: readonly SoundEvent[]): void;
  /** t(스케줄 기준 상대 시각) 이후로 예약된 이벤트 취소. kinds를 주면 해당 종류만. t=0이면 전부 */
  cancelFrom(t: Sec, kinds?: readonly SoundKind[]): void;
  stop(): void;
}
