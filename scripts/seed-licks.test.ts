/** seed-licks 명세(docs/features/seed-licks/03-spec.md)의 단위 기준 */
import { describe, expect, it } from 'vitest';
import {
  decodeLick,
  dedupeByMelody,
  lickTags,
  parseLicks,
  type ParsedLick,
  type SeedLick,
} from './seed-licks-lib';

const LINK = 'https://lickshare.pages.dev/?mode=view#';
const DOT = ' \u00b7 ';

const md = (...lines: string[]): string => lines.join('\n');

const lick = (over: Partial<ParsedLick>): ParsedLick => ({
  file: 'omnibook',
  section: 'ii–V–I',
  number: 1,
  name: 'Line',
  suffix: 'Tune',
  meta: 'meta',
  hash: 'v2abc',
  ...over,
});

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

  it('AC-3 다음 헤딩 전까지 링크가 없으면 파일명과 항목 번호를 담은 에러를 던진다', () => {
    const text = md(
      '## I–IV–V (C → F → G)',
      '### 1. First Phrase — Tune A',
      'meta',
      `${LINK}v2abc`,
      '### 2. Missing Link — Tune B',
      'meta',
      'description only',
      '## I–IV–V–I (C → F → G → C)',
      '### 1. Third Phrase — Tune C',
      'meta',
      `${LINK}v2def`,
    );

    expect(() => parseLicks('nottingham', text)).toThrow(/nottingham.* 2번 항목/);
  });
});

describe('decodeLick', () => {
  it('AC-4 디코딩되지 않는 해시는 파일명과 항목 번호를 담은 에러를 던진다', () => {
    expect(() => decodeLick(lick({ number: 7, hash: 'v2zzzz' }))).toThrow(/omnibook.* 7번 항목/);
  });
});

describe('lickTags', () => {
  it('AC-5 섹션 키와 접미, 메타 스타일에서 진행, 장르, 스타일 태그를 만든다', () => {
    const meta = `*Tune*${DOT}ts${DOT}HARDBOP${DOT}4 bars`;
    expect(lickTags(lick({ file: 'wjazzd', section: 'ii–V–I', meta }))).toEqual([
      'ii-v-i',
      'jazz',
      'hardbop',
    ]);
    expect(
      lickTags(lick({ file: 'guitarset', section: 'IV–I', suffix: 'Singer-Songwriter' })),
    ).toEqual(['iv-i', 'blues', 'songwriter']);
    expect(lickTags(lick({ file: 'nottingham', section: 'I–IV–V', suffix: 'East Dene' }))).toEqual([
      'i-iv-v',
      'folk',
      'traditional',
    ]);
  });

  it('AC-6 매핑표에 없는 섹션 키는 파일명과 섹션 키를 담은 에러를 던진다', () => {
    expect(() => lickTags(lick({ file: 'nottingham', section: 'ii–V–I' }))).toThrow(
      /nottingham.*ii–V–I/,
    );
  });
});

describe('dedupeByMelody', () => {
  it('AC-7 같은 melody_hash 가 다시 나오면 첫 항목만 남기고 뒤 항목을 제외 목록에 둔다', () => {
    const seed = (over: Partial<SeedLick>): SeedLick => ({
      ...lick(over),
      melodyHash: 'aaa',
      tags: [],
      ...over,
    });
    const first = seed({ file: 'nottingham', section: 'I–IV–V', name: 'Punch Bowl arch motif' });
    const other = seed({ file: 'nottingham', name: 'Other Tune', melodyHash: 'bbb' });
    const again = seed({ file: 'nottingham', section: 'I–IV–V–I', name: 'Arching Punch Bowl' });

    const { unique, excluded } = dedupeByMelody([first, other, again]);

    expect(unique).toEqual([first, other]);
    expect(excluded.map(({ file, section, name }) => [file, section, name])).toEqual([
      ['nottingham', 'I–IV–V–I', 'Arching Punch Bowl'],
    ]);
  });
});
