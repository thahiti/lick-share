#!/usr/bin/env node
// 기능 레지스트리(features.json)를 다루는 유일한 경로.
// 직접 편집을 훅이 막으므로 단계 전진 조건은 여기서만 검사한다.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HARNESS_DIR);
const REGISTRY = join(HARNESS_DIR, 'features.json');
const LAST_CHECK = join(HARNESS_DIR, '.last-check');

const STAGES = ['intake', 'plan', 'design', 'spec', 'implement', 'verify', 'done'];
const TRACKS = ['full', 'light'];
const APPROVALS = ['plan', 'design', 'spec'];

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

function load() {
  return JSON.parse(readFileSync(REGISTRY, 'utf8'));
}

function save(registry) {
  writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function find(registry, id) {
  const feature = registry.features.find((f) => f.id === id);
  if (!feature) fail(`기능 '${id}' 이(가) 없다`);
  return feature;
}

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[i + 1];
      i += 1;
    } else {
      rest.push(arg);
    }
  }
  return { flags, rest };
}

function headCommit() {
  return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
}

function summary(feature) {
  const approved = APPROVALS.filter((s) => feature.approved[s]).join(',') || '-';
  return `${feature.id}  [${feature.stage}]  track=${feature.track}  approved=${approved}  ${feature.title}`;
}

// 전진 조건. 뒤로 가는 전환(NEEDS_WORK 로 implement 복귀 등)은 항상 허용한다.
function checkTransition(feature, to) {
  const from = STAGES.indexOf(feature.stage);
  const target = STAGES.indexOf(to);
  if (target < 0) fail(`알 수 없는 단계 '${to}'. 가능: ${STAGES.join(', ')}`);
  if (target <= from) return;

  const skipsDesign = feature.track === 'light' && feature.stage === 'plan' && to === 'spec';
  if (target !== from + 1 && !skipsDesign) {
    fail(`'${feature.stage}' 에서 '${to}' 로 건너뛸 수 없다. 한 단계씩 전진한다`);
  }
  if (to === 'design' && feature.track === 'light') {
    fail('경량 트랙은 design 단계가 없다. spec 으로 간다');
  }
  if (to === 'implement') {
    const required = feature.track === 'full' ? ['plan', 'design', 'spec'] : ['plan', 'spec'];
    const missing = required.filter((s) => !feature.approved[s]);
    if (missing.length) fail(`implement 진입에는 사용자 승인이 필요하다. 미승인: ${missing.join(', ')}`);
  }
  if (to === 'done') {
    if (!existsSync(LAST_CHECK)) fail('harness/.last-check 가 없다. check.sh 를 통과시킨다');
    const checked = readFileSync(LAST_CHECK, 'utf8').trim();
    const head = headCommit();
    if (checked !== head) fail(`check.sh 통과 커밋(${checked.slice(0, 7)})이 HEAD(${head.slice(0, 7)})와 다르다`);
    const evidenceDir = join(HARNESS_DIR, 'evidence', feature.id);
    const verdictPath = join(evidenceDir, 'verdict.md');
    if (!existsSync(verdictPath)) fail(`평가자 판정 ${verdictPath} 가 없다`);
    const firstLine = readFileSync(verdictPath, 'utf8').split('\n')[0].trim();
    if (firstLine !== 'PASS') fail(`판정 첫 줄이 PASS 가 아니다: '${firstLine}'`);
    // 시나리오가 실제로 실행됐다는 증거. 전체 트랙은 스크린샷, 경량 트랙은 check 출력.
    const files = readdirSync(evidenceDir);
    if (feature.track === 'full' && !files.some((f) => f.endsWith('.png'))) {
      fail(`전체 트랙은 ${evidenceDir} 에 시나리오 스크린샷(.png)이 하나 이상 있어야 한다`);
    }
    if (!files.includes('check.txt')) fail(`${evidenceDir}/check.txt (check.sh 출력) 가 없다`);
  }
}

const commands = {
  list(args) {
    const { flags } = parseFlags(args);
    const registry = load();
    registry.features
      .filter((f) => !flags.stage || f.stage === flags.stage)
      .forEach((f) => console.log(summary(f)));
  },

  show([id]) {
    if (!id) fail('사용법: show <id>');
    console.log(JSON.stringify(find(load(), id), null, 2));
  },

  add(args) {
    const { flags, rest } = parseFlags(args);
    const [id] = rest;
    if (!id || !flags.title) fail('사용법: add <id> --title <제목> [--ref <근거 문서>] [--track full|light] [--deps a,b]');
    if (!/^[a-z0-9-]+$/.test(id)) fail('id 는 소문자, 숫자, 하이픈만');
    const track = flags.track ?? 'full';
    if (!TRACKS.includes(track)) fail(`track 은 ${TRACKS.join(' 또는 ')}`);
    const registry = load();
    if (registry.features.some((f) => f.id === id)) fail(`'${id}' 는 이미 있다`);
    const deps = flags.deps ? flags.deps.split(',').filter(Boolean) : [];
    deps.forEach((d) => find(registry, d));
    registry.features.push({
      id,
      title: flags.title,
      ref: flags.ref ?? '',
      track,
      deps,
      stage: 'intake',
      approved: {},
      history: [{ date: today(), stage: 'intake' }],
    });
    save(registry);
    console.log(`추가: ${id}`);
  },

  start([id]) {
    if (!id) fail('사용법: start <id>');
    const registry = load();
    const feature = find(registry, id);
    if (registry.active && registry.active !== id) {
      fail(`'${registry.active}' 가 진행 중이다. 한 번에 기능 하나만 진행한다. 먼저 finish 하거나 done 으로 보낸다`);
    }
    const blocked = feature.deps.filter((d) => find(registry, d).stage !== 'done');
    if (blocked.length) fail(`의존 기능이 끝나지 않았다: ${blocked.join(', ')}`);
    registry.active = id;
    save(registry);
    console.log(`진행 중: ${summary(feature)}`);
  },

  finish() {
    const registry = load();
    if (!registry.active) fail('진행 중인 기능이 없다');
    console.log(`진행 해제: ${registry.active}`);
    registry.active = null;
    save(registry);
  },

  approve(args) {
    const { flags, rest } = parseFlags(args);
    const [id, stage] = rest;
    if (!id || !APPROVALS.includes(stage)) fail(`사용법: approve <id> <${APPROVALS.join('|')}> [--note <메모>]`);
    const registry = load();
    const feature = find(registry, id);
    feature.approved[stage] = { date: today(), note: flags.note ?? '' };
    save(registry);
    console.log(`승인 기록: ${id} ${stage}`);
  },

  stage(args) {
    const { flags, rest } = parseFlags(args);
    const [id, to] = rest;
    if (!id || !to) fail('사용법: stage <id> <단계> [--model fable|opus] [--note <메모>]');
    const registry = load();
    const feature = find(registry, id);
    checkTransition(feature, to);
    feature.stage = to;
    feature.history.push({ date: today(), stage: to, model: flags.model ?? null, note: flags.note ?? '' });
    if (to === 'done' && registry.active === id) registry.active = null;
    save(registry);
    console.log(`단계 변경: ${summary(feature)}`);
  },

  remove([id]) {
    if (!id) fail('사용법: remove <id>');
    const registry = load();
    const feature = find(registry, id);
    if (STAGES.indexOf(feature.stage) >= STAGES.indexOf('implement')) {
      fail(`'${id}' 는 ${feature.stage} 단계라 지울 수 없다. 코드가 있는 기능은 남긴다`);
    }
    const dependents = registry.features.filter((f) => f.deps.includes(id)).map((f) => f.id);
    if (dependents.length) fail(`'${id}' 에 의존하는 기능이 있다: ${dependents.join(', ')}`);
    registry.features = registry.features.filter((f) => f.id !== id);
    if (registry.active === id) registry.active = null;
    save(registry);
    console.log(`삭제: ${id}`);
  },

  deps(args) {
    const { flags, rest } = parseFlags(args);
    const [id] = rest;
    if (!id || flags.deps === undefined) fail('사용법: deps <id> --deps a,b (빈 문자열이면 의존 없음)');
    const registry = load();
    const feature = find(registry, id);
    const deps = flags.deps.split(',').filter(Boolean);
    deps.forEach((d) => find(registry, d));
    feature.deps = deps;
    save(registry);
    console.log(`의존 변경: ${summary(feature)} deps=${deps.join(',') || '-'}`);
  },

  current() {
    const registry = load();
    if (!registry.active) {
      console.log('진행 중인 기능 없음');
      return;
    }
    const feature = find(registry, registry.active);
    console.log(summary(feature));
    const last = feature.history.at(-1);
    if (last?.note) console.log(`마지막 메모: ${last.note}`);
  },

  next() {
    const registry = load();
    const done = new Set(registry.features.filter((f) => f.stage === 'done').map((f) => f.id));
    const ready = registry.features.filter(
      (f) => f.stage !== 'done' && f.deps.every((d) => done.has(d)),
    );
    if (!ready.length) {
      console.log('시작 가능한 기능 없음');
      return;
    }
    ready.forEach((f) => console.log(summary(f)));
  },
};

const [command, ...args] = process.argv.slice(2);
if (!command || !commands[command]) {
  console.error(`사용법: node harness/feature.mjs <${Object.keys(commands).join('|')}> ...`);
  process.exit(1);
}
commands[command](args);
