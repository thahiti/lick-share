/**
 * 릭 모음 md 네 파일을 시드 계정의 커뮤니티 릭으로 바꾼다.
 * 기준은 docs/features/seed-licks/03-spec.md 다. DB 에는 접속하지 않는다.
 *
 * 사용: npm run seed-licks -- --dry-run
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { decodeLick, parseLicks } from './seed-licks-lib';

// 시드 순서는 파일 알파벳 순이다 (R5)
const FILES = ['guitarset', 'nottingham', 'omnibook', 'wjazzd'];
const USAGE = '사용: npm run seed-licks -- --dry-run';

if (!process.argv.slice(2).includes('--dry-run')) {
  console.error(USAGE);
  process.exit(1);
}

// 모든 파일을 검증한 뒤에 출력해 중간에 실패하면 아무것도 남기지 않는다
const counts = FILES.map((file) => {
  const licks = parseLicks(file, readFileSync(`content/licks/${file}.md`, 'utf8'));
  licks.forEach(decodeLick);
  return `${file} ${licks.length}`;
});
console.log(counts.join('\n'));
