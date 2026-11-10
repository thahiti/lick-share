/**
 * 릭 모음 md 네 파일을 시드 계정의 커뮤니티 릭으로 바꾼다.
 * 기준은 docs/features/seed-licks/03-spec.md 다. DB 에는 접속하지 않는다.
 * SQL 파일 전송은 node scripts/sbquery.mjs < <경로> 가 맡는다.
 *
 * 사용: npm run seed-licks -- --dry-run
 *       npm run seed-licks -- --out <경로>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { buildSeed, seedSql } from './seed-licks-lib';

// 시드 순서는 파일 알파벳 순이다 (R5)
const FILES = ['guitarset', 'nottingham', 'omnibook', 'wjazzd'];
const USAGE = '사용: npm run seed-licks -- --dry-run | --out <경로>';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outAt = args.indexOf('--out');
const hasOut = outAt >= 0;
const outPath = hasOut ? args[outAt + 1] : undefined;

// 두 플래그 중 정확히 하나만 받는다
if (dryRun === hasOut || (hasOut && !outPath)) {
  console.error(USAGE);
  process.exit(1);
}

const seed = await buildSeed(
  FILES.map((file) => ({ file, text: readFileSync(`content/licks/${file}.md`, 'utf8') })),
);

if (outPath) {
  writeFileSync(outPath, seedSql(seed.unique));
  console.log(`${outPath} 에 ${seed.unique.length}건을 썼다`);
} else {
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
}
