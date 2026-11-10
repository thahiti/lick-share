/**
 * 릭 모음 md 네 파일을 시드 계정의 커뮤니티 릭으로 바꾼다.
 * 기준은 docs/features/seed-licks/03-spec.md 다. DB 에는 접속하지 않는다.
 *
 * 사용: npm run seed-licks -- --dry-run
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { buildSeed } from './seed-licks-lib';

// 시드 순서는 파일 알파벳 순이다 (R5)
const FILES = ['guitarset', 'nottingham', 'omnibook', 'wjazzd'];
const USAGE = '사용: npm run seed-licks -- --dry-run';

if (!process.argv.slice(2).includes('--dry-run')) {
  console.error(USAGE);
  process.exit(1);
}

const seed = await buildSeed(
  FILES.map((file) => ({ file, text: readFileSync(`content/licks/${file}.md`, 'utf8') })),
);

// R8: 파일별 건수, 제외 목록, 유일 건수, 태그별 건수(태그 이름 순)
const tags = seed.unique.flatMap((l) => l.tags);
console.log(
  [
    ...seed.counts.map((c) => `${c.file} ${c.count}`),
    ...seed.excluded.map((l) => `excluded ${l.file} ${l.section} ${l.name}`),
    `unique ${seed.unique.length}`,
    ...[...new Set(tags)].sort().map((t) => `tag ${t} ${tags.filter((x) => x === t).length}`),
  ].join('\n'),
);
