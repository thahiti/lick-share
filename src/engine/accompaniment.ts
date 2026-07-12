/**
 * 반주 스케줄 전개 (SPEC §5.5). 박(4스텝) 단위로 (코드, 유효패턴) 연속 구간을
 * 세그먼트로 그룹핑해 이벤트 목록으로 전개한다. 코드 없는 구간은 완전 무음.
 */
import { chordAtBeat, chordTones } from '../core/chords';
import { measOf } from '../core/geometry';
import { asStep, type Midi, type Song, type Step } from '../core/types';

export type AccEvent =
  | { readonly type: 'pad'; readonly st: Step; readonly en: Step; readonly tones: readonly Midi[] }
  | { readonly type: 'hit'; readonly st: Step; readonly tones: readonly Midi[] }
  | { readonly type: 'one'; readonly st: Step; readonly tone: Midi };

/** 마디의 유효 패턴 = 오버라이드 || 전역 */
const patFor = (song: Song, m: number): string => song.mAcc[m] ?? song.accPat;

export const buildAccEvents = (song: Song, fromStep: number, toStep: number): AccEvent[] => {
  const events: AccEvent[] = [];
  let curKey: number | null = null;
  let curPat: string | null = null;
  let segStart: number | null = null;
  let segTones: readonly Midi[] = [];
  let arpI = 0;

  const flush = (endSt: number): void => {
    if (segStart !== null && curPat === 'pad') {
      events.push({ type: 'pad', st: asStep(segStart), en: asStep(endSt), tones: segTones });
    }
    segStart = null;
  };

  const b0 = Math.ceil(fromStep / 4) * 4;
  for (let st = b0; st < toStep; st += 4) {
    const ch = chordAtBeat(song.chords, st / 4);
    const pat = ch ? patFor(song, measOf(song, asStep(st))) : null;
    if (!ch || pat === 'off') {
      flush(st);
      curKey = null;
      curPat = null;
      continue;
    }
    if (pat !== curPat || ch.key !== curKey) {
      flush(st);
      curPat = pat;
      curKey = ch.key;
      segTones = chordTones(ch.str) ?? [];
      segStart = st;
      arpI = 0;
    }
    if (pat === 'comp') events.push({ type: 'hit', st: asStep(st), tones: segTones });
    if (pat === 'arp' && segTones.length > 0) {
      events.push({ type: 'one', st: asStep(st), tone: segTones[arpI % segTones.length] as Midi });
      events.push({
        type: 'one',
        st: asStep(st + 2),
        tone: segTones[(arpI + 1) % segTones.length] as Midi,
      });
      arpI += 2;
    }
  }
  flush(toStep);
  return events;
};
