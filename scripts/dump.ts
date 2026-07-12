/**
 * dump 계기판 — 해시(또는 데모 곡)를 이벤트 테이블 + ASCII 피아노롤로 출력한다.
 * 귀 없는 협업자(에이전트)용 (harness.md §7).
 *
 * 사용: npm run dump -- "#v1.…" [--metro] [--no-acc] [--from=step]
 */
import process from 'node:process';
import { decodeSong } from '../src/core/codec';
import { demoSong } from '../src/core/demo-song';
import { measCountAll, measStart, total } from '../src/core/geometry';
import { asBar, asStep, type Song } from '../src/core/types';
import { schedule } from '../src/engine/schedule';

const args = process.argv.slice(2);
const hashArg = args.find((a) => !a.startsWith('--'));
const metro = args.includes('--metro');
const accomp = !args.includes('--no-acc');
const fromArg = args.find((a) => a.startsWith('--from='));
const fromStep = asStep(fromArg ? Number(fromArg.slice(7)) : 0);

const song: Song | null = hashArg ? decodeSong(hashArg.replace(/^#/, '')) : demoSong;
if (!song) {
  console.error('해시 디코딩 실패 (v1. 형식이 아니거나 손상됨)');
  process.exit(1);
}

const tot = total(song);
console.log(`제목: ${song.title} | ♩=${song.tempo} | ${song.meas}마디${song.pickup ? ' + 못갖춘(2박)' : ''}`);
console.log(`반주: ${song.accPat} | 오버라이드: ${JSON.stringify(song.mAcc)} | 코드: ${JSON.stringify(song.chords)}`);
console.log('');

/* ── ASCII 피아노롤 (스텝 도메인) ── */
const pitches = [...new Set(song.notes.map((n) => n.p as number))].sort((a, b) => b - a);
const cell = (p: number, st: number): string => {
  const n = song.notes.find((x) => x.p === p && x.s <= st && st < x.s + x.d);
  return n ? (n.s === st ? 'O' : '=') : '·';
};
const barSeps = new Set<number>();
for (let m = 1; m < measCountAll(song); m++) barSeps.add(measStart(song, asBar(m)));
const rowFor = (label: string, at: (st: number) => string): string => {
  let out = `${label.padStart(4)} |`;
  for (let st = 0; st < tot; st++) {
    if (st > 0 && barSeps.has(st)) out += '|';
    out += at(st);
  }
  return `${out}|`;
};
for (const p of pitches) console.log(rowFor(`m${p}`, (st) => cell(p, st)));
console.log(rowFor('beat', (st) => (st % 4 === 0 ? String((st % 16) / 4 + 1) : ' ')));
console.log('');

/* ── 이벤트 테이블 ── */
const events = schedule(song, { melody: true, accomp, metro }, fromStep);
console.log(`이벤트 ${events.length}개 (melody+acc osc 환산 ${events.filter((e) => e.kind !== 'metro').length * 2}개):`);
console.log('t(초)    종류    음/주파수  길이(초)  vol');
for (const e of events) {
  if (e.kind === 'metro') {
    console.log(`${e.t.toFixed(3).padEnd(8)} metro   ${String(e.freq).padEnd(9)} ${'—'.padEnd(9)} ${e.vol}`);
  } else {
    console.log(
      `${e.t.toFixed(3).padEnd(8)} ${e.kind.padEnd(7)} m${String(e.midi).padEnd(8)} ${e.dur.toFixed(3).padEnd(9)} ${e.vol}`,
    );
  }
}
