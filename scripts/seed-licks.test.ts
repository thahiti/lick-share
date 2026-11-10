/** seed-licks 명세(docs/features/seed-licks/03-spec.md)의 단위 기준 */
import { describe, expect, it } from 'vitest';
import { parseLicks } from './seed-licks-lib';

const LINK = 'https://lickshare.pages.dev/?mode=view#';
const DOT = ' \u00b7 ';

const md = (...lines: string[]): string => lines.join('\n');

describe('parseLicks', () => {
  it('AC-1 섹션 키, 릭 이름, 접미, 메타 줄, 해시를 항목마다 뽑는다', () => {
    const text = md(
      '# Library',
      '',
      '## Major ii–V–I (Dm7 → G7 → C)',
      '',
      '(2개)',
      '',
      '### 1. Scale Climb to Soaring Sixth — Pepper Adams',
      '',
      `*Just One of Those Things*${DOT}bs${DOT}HARDBOP`,
      '',
      'description',
      '',
      `**[open](${LINK}v2ab_-9)**`,
      '',
      '### 2. Chromatic Climb, Enclosure Landing — Sonny Rollins',
      `*I'll Remember April*${DOT}ts${DOT}HARDBOP`,
      `**[open](${LINK}v2XYZ)** and [again](${LINK}v2other)`,
    );

    expect(parseLicks('wjazzd', text)).toEqual([
      {
        file: 'wjazzd',
        section: 'ii–V–I',
        number: 1,
        name: 'Scale Climb to Soaring Sixth',
        suffix: 'Pepper Adams',
        meta: `*Just One of Those Things*${DOT}bs${DOT}HARDBOP`,
        hash: 'v2ab_-9',
      },
      {
        file: 'wjazzd',
        section: 'ii–V–I',
        number: 2,
        name: 'Chromatic Climb, Enclosure Landing',
        suffix: 'Sonny Rollins',
        meta: `*I'll Remember April*${DOT}ts${DOT}HARDBOP`,
        hash: 'v2XYZ',
      },
    ]);
  });

  it('AC-2 헤딩에 구분자가 두 번이면 마지막 구분자 앞까지가 릭 이름이다', () => {
    const text = md(
      '## Blues IV–I (F → C)',
      '### 1. Call — Response Climb — Singer-Songwriter',
      'meta',
      `${LINK}v2abc`,
    );

    const [lick] = parseLicks('guitarset', text);
    expect(lick?.section).toBe('IV–I');
    expect(lick?.name).toBe('Call — Response Climb');
    expect(lick?.suffix).toBe('Singer-Songwriter');
  });
});
