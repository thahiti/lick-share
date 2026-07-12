/**
 * 자동 쉼표 파생 (SPEC §5.2). 쉼표는 저장하지 않고 노트 배열에서 항상 파생한다.
 * take → 쉼표 종류: 16=온, 8=2분, 4=4분, 2=8분, 1=16분.
 */
import { total, measCountAll, measLen, measStart } from './geometry';
import type { BarSpec } from './geometry';
import { asBar, type BarIndex, type Note } from './types';

export interface Rest {
  /** 마디 인덱스 */
  readonly m: BarIndex;
  /** 마디 내 상대 시작 스텝 */
  readonly at: number;
  /** 쉼표 길이 (16분음표 개수) */
  readonly take: number;
}

export type SongLike = BarSpec & { readonly notes: readonly Note[] };

export const deriveRests = (song: SongLike): Rest[] => {
  const tot = total(song);
  const occ = new Array<boolean>(tot).fill(false);
  for (const n of song.notes) {
    for (let t = n.s; t < n.s + n.d && t < tot; t++) occ[t] = true;
  }

  const rests: Rest[] = [];
  const cnt = measCountAll(song);
  for (let mi = 0; mi < cnt; mi++) {
    const m = asBar(mi);
    const ms = measStart(song, m);
    const len = measLen(song, m);
    let a = 0;
    while (a < len) {
      if (occ[ms + a]) {
        a++;
        continue;
      }
      let b = a;
      while (b < len && !occ[ms + b]) b++;
      let c = a;
      while (c < b) {
        let take = 1;
        for (const cand of [16, 8, 4, 2, 1]) {
          if (c % cand === 0 && cand <= b - c && cand <= len) {
            take = cand;
            break;
          }
        }
        rests.push({ m, at: c, take });
        c += take;
      }
      a = b;
    }
  }
  return rests;
};
