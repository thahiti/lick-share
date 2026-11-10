/**
 * Supabase Management API 로 운영 DB 에 SQL 을 보낸다.
 * 토큰은 .env.local 의 SUPABASE_ACCESS_TOKEN (Database read-write 스코프).
 * postgres 역할로 실행되므로 RLS 를 거치지 않는다. 리포 루트에서 실행한다.
 *
 * 사용: node scripts/sbquery.mjs "select count(*) from licks"
 *       node scripts/sbquery.mjs < seed.sql
 */
import { readFileSync } from 'node:fs';

const PROJECT_REF = 'tejndnivhbdxfstgybmm';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('.env.local 에 SUPABASE_ACCESS_TOKEN 이 없다');
  process.exit(1);
}

const query = process.argv[2] ?? readFileSync(0, 'utf8');
if (query.trim() === '') {
  console.error('SQL 이 비어 있다. 첫 인자나 표준 입력으로 준다');
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${body}`);
  process.exit(1);
}
console.log(body);
