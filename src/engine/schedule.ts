/**
 * schedule() — 곡 + 설정 + 재생 범위 → 울려야 할 소리들의 목록 (설계 문서 §2 심장부).
 * 시각은 fromStep 시점을 0으로 하는 상대 초. 실제 발음은 AudioSink 어댑터가 담당.
 */
import { measCountAll, measLen, measStart, total } from '../core/geometry';
import { asBar, asSec, asStep, type Sec, type Song, type Step } from '../core/types';
import type { SoundEvent } from '../ports/audio-sink';
import { buildAccEvents } from './accompaniment';

export interface PlayOpts {
  readonly melody: boolean;
  readonly accomp: boolean;
  readonly metro: boolean;
}

/** 16분음표 1개의 초 길이 */
export const secPerStep = (tempo: number): Sec => asSec(60 / tempo / 4);

const KIND_ORDER = { melody: 0, acc: 1, metro: 2 } as const;

export const schedule = (
  song: Song,
  opts: PlayOpts,
  fromStep: Step,
  toStep: Step = asStep(total(song)),
): SoundEvent[] => {
  const sps = secPerStep(song.tempo);
  const events: SoundEvent[] = [];

  if (opts.melody) {
    for (const n of [...song.notes].sort((a, b) => a.s - b.s)) {
      const e = n.s + n.d;
      if (e <= fromStep || n.s >= toStep) continue;
      const st = Math.max(n.s, fromStep);
      events.push({
        kind: 'melody',
        midi: n.p,
        t: asSec((st - fromStep) * sps),
        dur: asSec((Math.min(e, toStep) - st) * sps * 0.96),
        vol: 0.24,
      });
    }
  }

  if (opts.accomp) {
    for (const ev of buildAccEvents(song, fromStep, toStep)) {
      const t = asSec((ev.st - fromStep) * sps);
      if (ev.type === 'pad') {
        for (const midi of ev.tones) {
          events.push({ kind: 'acc', midi, t, dur: asSec((ev.en - ev.st) * sps * 0.98), vol: 0.075 });
        }
      } else if (ev.type === 'hit') {
        for (const midi of ev.tones) {
          events.push({ kind: 'acc', midi, t, dur: asSec(2.3 * sps), vol: 0.07 });
        }
      } else {
        events.push({ kind: 'acc', midi: ev.tone, t, dur: asSec(1.9 * sps), vol: 0.09 });
      }
    }
  }

  if (opts.metro) {
    for (let m = 0; m < measCountAll(song); m++) {
      const ms = measStart(song, asBar(m));
      const len = measLen(song, asBar(m));
      for (let b = 0; b < len; b += 4) {
        const st = ms + b;
        if (st < fromStep || st >= toStep) continue;
        const accent = b === 0 && !(song.pickup && m === 0);
        events.push({
          kind: 'metro',
          t: asSec((st - fromStep) * sps),
          freq: accent ? 1568 : 1047,
          vol: accent ? 0.16 : 0.1,
        });
      }
    }
  }

  return events.sort(
    (a, b) =>
      a.t - b.t ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.kind !== 'metro' && b.kind !== 'metro' ? a.midi - b.midi : 0),
  );
};
