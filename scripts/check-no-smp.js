/**
 * src 내 SMP 유니코드 음악 기호(U+1D100~U+1D1FF) 검출 시 exit 1.
 * Android에 해당 폰트가 없어 악보 기호는 전부 SVG 패스로만 그린다 (CLAUDE.md 절대 규칙).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SMP_RANGE = /[\u{1D100}-\u{1D1FF}]/u;

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });

const offenders = listFiles('src').filter((p) => SMP_RANGE.test(readFileSync(p, 'utf8')));

if (offenders.length > 0) {
  console.error('SMP 음악 기호 문자가 발견되었습니다 (SVG 패스로 대체할 것):');
  offenders.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log('check-no-smp: OK');
