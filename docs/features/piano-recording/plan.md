# Piano Recording Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편집 화면에서 ● Rec → 예비박 1마디 → 피아노 건반 터치로 노트를 실시간 입력하는 레코딩 기능 (spec: docs/superpowers/specs/2026-07-16-piano-recording-design.md).

**Architecture:** 순수 상태 머신(`core/recording.ts`)이 keyDown/keyUp/tick 이벤트를 받아 양자화된 노트 커밋을 반환한다. `engine/schedule.ts`가 예비박+본편 사운드 이벤트를 만들고, `adapters/player.ts`의 record 세션이 클록을 돌린다. `ui/hooks/useRecording.ts`가 셋을 배선하고, 모바일은 `RecordingPiano` 신규 컴포넌트, 데스크톱은 기존 `PianoKeys`를 armed 모드로 확장한다.

**Tech Stack:** TypeScript + React 19, zustand vanilla store, vitest (+ @testing-library/react), 기존 FakeAudioSink/FakeClock 픽스처.

## Global Constraints

- 레이어 방향 준수: `ui → adapters → ports`, `engine → core`. **core는 engine을 import할 수 없다** — `secPerStep`은 core에 못 들어가므로 레코딩 함수는 `sps`(step당 초)를 인자로 받는다.
- 순수 레이어(core/engine/ports)에서 금지: react, DOM, Date, setTimeout, window, AudioContext, Math.random. `npm run typecheck`가 `tsconfig.pure.json`으로 강제한다.
- Step/Midi/Sec/BarIndex는 branded type — 생성은 `asStep/asMidi/asSec/asBar`로만.
- SMP 유니코드 음악 기호(U+1D100~) 금지. UI 텍스트는 영어, 코드 주석은 한국어.
- 색상은 `src/styles/tokens.css` CSS 변수만 사용 (하드코딩 금지).
- TDD: 테스트 먼저 → RED 확인 → 구현 → GREEN. 커밋 전 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp`.
- 커밋: Conventional Commits (`feat(recording): …`), 제목 50자 이내 명령형.
- trailing space 금지.

## 사전 지식 (모든 태스크 공통)

- `Step` = 16분음표 인덱스. 마디 = 16스텝(SPM), 박 = 4스텝. `secPerStep(tempo) = 60/tempo/4` (src/engine/schedule.ts:17). 템포 100 → sps=0.15.
- `LEN_STEPS = [1,2,3,4,6,8,12,16]` (src/core/constants.ts:15) — 허용 노트 길이.
- `Song`(src/core/types.ts:40): `{title, tempo, meas, pickup: 0|8, accPat, metro: 'off'|'quarter', mAcc, notes, chords}`.
- `resolveOverlap(notes, ch)`(src/core/overlap.ts): ch와 겹치는 다른 노트를 자르거나 제거.
- `measStart(song, m)`, `total(song)`, `measOf(song, step)` — src/core/geometry.ts.
- 테스트 실행: `npx vitest run <파일경로>` (전체는 `npm test`).

테스트용 곡 헬퍼(각 테스트 파일에서 로컬 정의 — 공용 픽스처 없음, 기존 관례):

```ts
const mkSong = (over: Partial<Song> = {}): Song => ({
  title: '',
  tempo: 100,
  meas: 2,
  pickup: 0,
  accPat: 'off',
  metro: 'off',
  mAcc: {},
  notes: [],
  chords: {},
  ...over,
});
```

---

### Task 1: core 레코딩 상태 머신

**Files:**
- Create: `src/core/recording.ts`
- Test: `src/core/recording.test.ts`

**Interfaces:**
- Consumes: `LEN_STEPS`(constants), `measStart/total`(geometry), branded types.
- Produces: `RecState`, `NoteSpec = Pick<Note,'s'|'d'|'p'>`, `initRecording(song, curM): RecState`, `recKeyDown(st, sps, midi, t): RecResult`, `recKeyUp(st, sps, midi, t): RecResult`, `recTick(st, sps, t): TickResult`. `RecResult = {st, commit: NoteSpec|null}`, `TickResult = RecResult & {done: boolean}`. 시각 규약: **t=0 = 본편 시작(예비박 끝), 예비박 = t<0**, 단위 초.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/core/recording.test.ts
import { describe, expect, it } from 'vitest';
import { initRecording, recKeyDown, recKeyUp, recTick } from './recording';
import { asBar, asMidi, asSec, type Song } from './types';

const mkSong = (over: Partial<Song> = {}): Song => ({
  title: '', tempo: 100, meas: 2, pickup: 0, accPat: 'off',
  metro: 'off', mAcc: {}, notes: [], chords: {}, ...over,
});

// 템포 100 → 16분음표 1개 = 0.15초
const SPS = 0.15;
const C4 = asMidi(60);
const E4 = asMidi(64);

describe('initRecording', () => {
  it('현재 마디 첫 스텝부터 곡 끝까지', () => {
    const st = initRecording(mkSong(), asBar(1));
    expect(st.startStep).toBe(16);
    expect(st.endStep).toBe(32);
    expect(st.held).toBeNull();
  });

  it('pickup 곡의 0마디는 스텝 0부터', () => {
    const st = initRecording(mkSong({ pickup: 8 }), asBar(0));
    expect(st.startStep).toBe(0);
    expect(st.endStep).toBe(8 + 32);
  });
});

describe('keyDown → keyUp 기본 커밋', () => {
  it('정박 4스텝 홀드 → {s:16, d:4}', () => {
    const st0 = initRecording(mkSong(), asBar(1));
    const d1 = recKeyDown(st0, SPS, C4, asSec(0));
    expect(d1.commit).toBeNull();
    expect(d1.st.held).toEqual({ p: C4, downT: 0 });
    const u1 = recKeyUp(d1.st, SPS, C4, asSec(0.6));
    expect(u1.commit).toEqual({ s: 16, d: 4, p: C4 });
    expect(u1.st.held).toBeNull();
  });

  it('시작 스텝 반올림: 0.07초(0.47스텝)→스텝 0, 0.08초(0.53스텝)→스텝 1', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const a = recKeyUp(recKeyDown(st0, SPS, C4, asSec(0.07)).st, SPS, C4, asSec(0.25));
    expect(a.commit?.s).toBe(0);
    const b = recKeyUp(recKeyDown(st0, SPS, C4, asSec(0.08)).st, SPS, C4, asSec(0.25));
    expect(b.commit?.s).toBe(1);
  });

  it('길이는 LEN_STEPS 최근접 스냅, 동률이면 짧은 쪽: 4.7스텝→4, 5스텝→4', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const a = recKeyUp(recKeyDown(st0, SPS, C4, asSec(0)).st, SPS, C4, asSec(4.7 * SPS));
    expect(a.commit?.d).toBe(4);
    const b = recKeyUp(recKeyDown(st0, SPS, C4, asSec(0)).st, SPS, C4, asSec(5 * SPS));
    expect(b.commit?.d).toBe(4);
  });

  it('아주 짧은 탭도 최소 1스텝', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const r = recKeyUp(recKeyDown(st0, SPS, C4, asSec(0)).st, SPS, C4, asSec(0.02));
    expect(r.commit?.d).toBe(1);
  });
});

describe('레가토 컷 (모노포닉)', () => {
  it('새 keyDown이 기존 held를 그 시각에 잘라 커밋', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const d1 = recKeyDown(st0, SPS, C4, asSec(0));
    const d2 = recKeyDown(d1.st, SPS, E4, asSec(0.3)); // 2스텝 뒤
    expect(d2.commit).toEqual({ s: 0, d: 2, p: C4 });
    expect(d2.st.held).toEqual({ p: E4, downT: 0.3 });
  });

  it('레가토 컷 이후 늦게 도착한 이전 키 keyUp은 무시', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const d2 = recKeyDown(recKeyDown(st0, SPS, C4, asSec(0)).st, SPS, E4, asSec(0.3));
    const u = recKeyUp(d2.st, SPS, C4, asSec(0.35));
    expect(u.commit).toBeNull();
    expect(u.st.held).toEqual({ p: E4, downT: 0.3 }); // E4는 그대로 hold
  });
});

describe('예비박(t<0) 처리', () => {
  it('살짝 이른 터치(-0.05초)는 스텝 0으로 흡수', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const r = recKeyUp(recKeyDown(st0, SPS, C4, asSec(-0.05)).st, SPS, C4, asSec(0.25));
    expect(r.commit).toEqual({ s: 0, d: 2, p: C4 });
  });

  it('많이 이른 터치(-0.2초 → 스텝 -1)는 커밋 없음(소리만)', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const r = recKeyUp(recKeyDown(st0, SPS, C4, asSec(-0.2)).st, SPS, C4, asSec(0.25));
    expect(r.commit).toBeNull();
  });
});

describe('recTick과 곡 끝', () => {
  it('곡 끝 전에는 done=false, 커밋 없음', () => {
    const st0 = initRecording(mkSong(), asBar(1)); // 본편 길이 16스텝 = 2.4초
    const r = recTick(recKeyDown(st0, SPS, C4, asSec(2.1)).st, SPS, asSec(2.39));
    expect(r.done).toBe(false);
    expect(r.commit).toBeNull();
  });

  it('곡 끝 도달 시 done=true + held 잔여를 잘라 커밋', () => {
    const st0 = initRecording(mkSong(), asBar(1));
    const r = recTick(recKeyDown(st0, SPS, C4, asSec(2.1)).st, SPS, asSec(2.4));
    expect(r.done).toBe(true);
    expect(r.commit).toEqual({ s: 30, d: 2, p: C4 }); // 16+round(2.1/0.15)=30, (2.4-2.1)/0.15=2
    expect(r.st.held).toBeNull();
  });

  it('곡 끝을 넘는 길이는 잘라서 내림 스냅', () => {
    // 스텝 31에서 5스텝 홀드 → 31+4>32 → snapLenDown(1)=1
    const st0 = initRecording(mkSong(), asBar(0)); // end=32
    const d = recKeyDown(st0, SPS, C4, asSec(31 * SPS));
    const u = recKeyUp(d.st, SPS, C4, asSec(36 * SPS));
    expect(u.commit).toEqual({ s: 31, d: 1, p: C4 });
  });

  it('시작 스텝이 곡 끝 이후면 커밋 없음', () => {
    const st0 = initRecording(mkSong(), asBar(0));
    const d = recKeyDown(st0, SPS, C4, asSec(32 * SPS));
    const u = recKeyUp(d.st, SPS, C4, asSec(33 * SPS));
    expect(u.commit).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/recording.test.ts`
Expected: FAIL — `Cannot find module './recording'`

- [ ] **Step 3: 구현**

```ts
// src/core/recording.ts
/**
 * 레코딩 상태 머신 (piano-recording-design §2.1). 전부 순수 —
 * 시각(초)은 밖에서 주입한다. t=0 = 본편 시작(예비박 끝), 예비박 구간은 t<0.
 * sps(step당 초)는 engine의 secPerStep이 계산해 넘긴다 (core→engine 의존 금지).
 */
import { LEN_STEPS } from './constants';
import { measStart, total } from './geometry';
import { asStep, type BarIndex, type Midi, type Note, type Sec, type Song, type Step } from './types';

/** 커밋할 노트 스펙 — id는 스토어(insertRecorded)가 부여 */
export type NoteSpec = Pick<Note, 's' | 'd' | 'p'>;

export interface RecState {
  readonly startStep: Step;
  readonly endStep: Step;
  /** 누르고 있는 건반 — 모노포닉이라 최대 1개 */
  readonly held: { readonly p: Midi; readonly downT: Sec } | null;
}

export interface RecResult {
  readonly st: RecState;
  readonly commit: NoteSpec | null;
}

export interface TickResult extends RecResult {
  readonly done: boolean;
}

export const initRecording = (song: Song, curM: BarIndex): RecState => ({
  startStep: measStart(song, curM),
  endStep: asStep(total(song)),
  held: null,
});

/** 길이(스텝 실수)를 LEN_STEPS 최근접 값으로 스냅 (동률이면 짧은 쪽) */
const snapLen = (raw: number): number =>
  LEN_STEPS.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best));

/** max 이하의 최대 LEN_STEPS 값 (max ≥ 1 전제) */
const snapLenDown = (max: number): number => LEN_STEPS.filter((v) => v <= max).at(-1) ?? 1;

/** held → 커밋 스펙. 본편 범위 밖이면 null */
const commitHeld = (st: RecState, sps: number, upT: Sec): NoteSpec | null => {
  if (!st.held) return null;
  const s = st.startStep + Math.round(st.held.downT / sps);
  if (s < st.startStep || s >= st.endStep) return null;
  const d = snapLen((upT - st.held.downT) / sps);
  return { s: asStep(s), d: s + d > st.endStep ? snapLenDown(st.endStep - s) : d, p: st.held.p };
};

/** 건반 누름: 기존 held를 이 시각에 잘라 커밋(레가토 컷) 후 새로 hold */
export const recKeyDown = (st: RecState, sps: number, midi: Midi, t: Sec): RecResult => ({
  st: { ...st, held: { p: midi, downT: t } },
  commit: commitHeld(st, sps, t),
});

/** 건반 뗌: held와 같은 피치일 때만 커밋. 불일치(레가토 컷 잔여)는 무시 */
export const recKeyUp = (st: RecState, sps: number, midi: Midi, t: Sec): RecResult =>
  st.held && st.held.p === midi
    ? { st: { ...st, held: null }, commit: commitHeld(st, sps, t) }
    : { st, commit: null };

/** 프레임 틱: 본편 끝 도달 시 done + held 잔여 커밋 */
export const recTick = (st: RecState, sps: number, t: Sec): TickResult => {
  if (t < (st.endStep - st.startStep) * sps) return { st, commit: null, done: false };
  return { st: { ...st, held: null }, commit: commitHeld(st, sps, t), done: true };
};
```

주의: `snapLen`의 동률 처리 — `reduce`에 초기값을 주지 않으면 첫 원소(1)부터 시작하고 `<`(strict)라 동률이면 앞(짧은) 값이 유지된다. LEN_STEPS는 오름차순.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/recording.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/core/recording.ts src/core/recording.test.ts
git commit -m "feat(recording): add pure recording state machine"
```

---

### Task 2: insertRecorded 순수 삽입 함수

**Files:**
- Modify: `src/core/editing.ts` (파일 끝에 추가)
- Test: `src/core/editing.test.ts` (기존 파일 끝에 describe 추가)

**Interfaces:**
- Consumes: `NoteSpec`(Task 1과 동일 shape — 여기서는 `Pick<Note,'s'|'d'|'p'>`로 표기), `resolveOverlap`, 파일 내부 `nextId`.
- Produces: `insertRecorded(song: Song, spec: Pick<Note,'s'|'d'|'p'>): Song` — Task 5의 store가 사용.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/editing.test.ts` 끝에 추가

```ts
describe('insertRecorded', () => {
  const base: Song = {
    title: '', tempo: 100, meas: 2, pickup: 0, accPat: 'off',
    metro: 'off', mAcc: {},
    notes: [{ id: 1, s: asStep(0), d: 4, p: asMidi(60) }],
    chords: {},
  };

  it('새 id로 삽입하고 기존 노트를 유지', () => {
    const out = insertRecorded(base, { s: asStep(8), d: 4, p: asMidi(64) });
    expect(out.notes).toHaveLength(2);
    const added = out.notes.find((n) => n.s === 8);
    expect(added).toMatchObject({ id: 2, d: 4, p: 64 });
  });

  it('겹치는 기존 노트는 resolveOverlap 규칙으로 잘리거나 제거', () => {
    const out = insertRecorded(base, { s: asStep(2), d: 4, p: asMidi(64) });
    const old = out.notes.find((n) => n.id === 1);
    expect(old?.d).toBe(2); // 앞부분만 남음
  });
});
```

(기존 테스트 파일의 import에 `insertRecorded`를 추가한다. `asStep`/`asMidi`/`Song`은 이미 import되어 있으면 그대로 사용.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/editing.test.ts`
Expected: FAIL — `insertRecorded is not exported`

- [ ] **Step 3: 구현** — `src/core/editing.ts` 파일 끝에 추가

```ts
/** 레코딩 커밋: 지정 스텝·길이로 삽입 + 겹침 해소 (piano-recording-design §2.4).
 *  선택·프리뷰 변경 없음 — 탭 사운드는 즉시 발음 경로가 담당 */
export const insertRecorded = (song: Song, spec: Pick<Note, 's' | 'd' | 'p'>): Song => {
  const n: Note = { id: nextId(song), ...spec };
  return { ...song, notes: resolveOverlap([...song.notes, n], n) };
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/editing.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/core/editing.ts src/core/editing.test.ts
git commit -m "feat(recording): add insertRecorded pure insertion"
```

---

### Task 3: 예비박·레코딩 사운드 이벤트 (engine)

**Files:**
- Modify: `src/engine/schedule.ts` (파일 끝에 추가)
- Test: `src/engine/schedule.test.ts` (기존 파일 끝에 describe 추가)

**Interfaces:**
- Consumes: 기존 `schedule`, `secPerStep`, `SoundEvent`.
- Produces: `COUNT_IN_BEATS = 4`, `countInEvents(tempo): SoundEvent[]`, `recordingEvents(song, accomp: boolean, fromStep: Step): SoundEvent[]` — Task 4의 player가 사용. 시각 규약: **recordingEvents의 t=0은 예비박 시작**, 본편은 `COUNT_IN_BEATS * 4 * sps`부터.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/engine/schedule.test.ts` 끝에 추가

```ts
describe('countInEvents', () => {
  it('4분음표 클릭 4개, 첫 박 액센트 (템포 100 → 박당 0.6초)', () => {
    const evs = countInEvents(100);
    expect(evs).toHaveLength(4);
    expect(evs.map((e) => e.t)).toEqual([0, 0.6, 1.2, 1.8]);
    expect(evs[0]).toMatchObject({ kind: 'metro', freq: 1568, vol: 0.16 });
    expect(evs[1]).toMatchObject({ kind: 'metro', freq: 1047, vol: 0.1 });
  });
});

describe('recordingEvents', () => {
  const song: Song = {
    title: '', tempo: 100, meas: 2, pickup: 0, accPat: 'pad',
    metro: 'off', mAcc: {},
    notes: [{ id: 1, s: asStep(0), d: 4, p: asMidi(60) }],
    chords: { 0: 'C' },
  };

  it('멜로디 제외, 메트로놈은 metro=off여도 강제 포함', () => {
    const evs = recordingEvents(song, false, asStep(0));
    expect(evs.some((e) => e.kind === 'melody')).toBe(false);
    // 예비박 4클릭 + 본편 2마디×4박 = 12개
    expect(evs.filter((e) => e.kind === 'metro')).toHaveLength(12);
  });

  it('본편 이벤트는 예비박 길이(2.4초)만큼 시프트', () => {
    const evs = recordingEvents(song, false, asStep(0));
    const main = evs.filter((e) => e.kind === 'metro' && e.t >= 2.4);
    expect(main[0]?.t).toBeCloseTo(2.4, 5);
  });

  it('accomp=true면 반주 포함, false면 제외', () => {
    expect(recordingEvents(song, true, asStep(0)).some((e) => e.kind === 'acc')).toBe(true);
    expect(recordingEvents(song, false, asStep(0)).some((e) => e.kind === 'acc')).toBe(false);
  });

  it('fromStep부터 본편 스케줄 (마디 2 시작 → 본편 메트로 4클릭)', () => {
    const evs = recordingEvents(song, false, asStep(16));
    expect(evs.filter((e) => e.kind === 'metro')).toHaveLength(4 + 4);
  });
});
```

(기존 테스트 파일 import에 `countInEvents`, `recordingEvents` 추가. `Song`/`asStep`/`asMidi`가 없으면 함께 추가.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/engine/schedule.test.ts`
Expected: FAIL — not exported

- [ ] **Step 3: 구현** — `src/engine/schedule.ts` 파일 끝에 추가

```ts
// ── 레코딩 (piano-recording-design §2.2) ──

/** 예비박 박 수 (1마디, 4/4) */
export const COUNT_IN_BEATS = 4;

/** 예비박 클릭 — t=0이 예비박 시작. 주파수·볼륨은 본편 메트로놈과 동일 */
export const countInEvents = (tempo: number): SoundEvent[] => {
  const spb = secPerStep(tempo) * 4;
  return Array.from({ length: COUNT_IN_BEATS }, (_, b) => ({
    kind: 'metro' as const,
    t: asSec(b * spb),
    freq: b === 0 ? 1568 : 1047,
    vol: b === 0 ? 0.16 : 0.1,
  }));
};

/** 레코딩 세션 이벤트: 예비박 + 본편(멜로디 음소거·메트로 강제·반주는 토글) 시프트 병합 */
export const recordingEvents = (song: Song, accomp: boolean, fromStep: Step): SoundEvent[] => {
  const ciLen = COUNT_IN_BEATS * 4 * secPerStep(song.tempo);
  const forced: Song = song.metro === 'off' ? { ...song, metro: 'quarter' } : song;
  const main = schedule(forced, { melody: false, accomp, metro: true }, fromStep).map((e) => ({
    ...e,
    t: asSec(e.t + ciLen),
  }));
  return [...countInEvents(song.tempo), ...main];
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/engine/schedule.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/schedule.ts src/engine/schedule.test.ts
git commit -m "feat(recording): add count-in and recording sound events"
```

---

### Task 4: player 레코딩 세션

**Files:**
- Modify: `src/adapters/player.ts`
- Test: `src/adapters/player.test.ts` (기존 파일 끝에 describe 추가)

**Interfaces:**
- Consumes: `recordingEvents`, `COUNT_IN_BEATS`(Task 3), 기존 `AudioSink`/`Clock`.
- Produces: `Player.record(song, accomp, fromStep, onFrame: (t: Sec) => void): void`, `Player.isRecording(): boolean`. **onFrame의 t는 본편 시작 기준 상대 초(예비박 동안 음수)** — Task 6의 훅이 core 상태 머신에 그대로 넘긴다. `stop()`은 레코딩 세션도 정리하고 `onEnded`를 발화한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/adapters/player.test.ts` 끝에 추가 (기존 테스트들이 쓰는 `createFakeAudioSink`/`createFakeClock` 생성 관례를 그대로 따른다: `const clock = createFakeClock(); const sink = createFakeAudioSink(() => clock.now());`)

```ts
describe('record 세션', () => {
  const song: Song = {
    title: '', tempo: 100, meas: 1, pickup: 0, accPat: 'off',
    metro: 'off', mAcc: {},
    notes: [{ id: 1, s: asStep(0), d: 4, p: asMidi(60) }],
    chords: {},
  };

  it('예비박+본편 메트로만 스케줄 (멜로디 없음)', () => {
    const clock = createFakeClock();
    const sink = createFakeAudioSink(() => clock.now());
    const player = createPlayer({ sink, clock });
    player.record(song, false, asStep(0), () => {});
    expect(sink.events.some((e) => e.kind === 'melody')).toBe(false);
    expect(sink.events.filter((e) => e.kind === 'metro')).toHaveLength(4 + 4);
    expect(player.isRecording()).toBe(true);
    expect(player.isPlaying()).toBe(false);
  });

  it('onFrame은 본편 기준 t를 전달 — 예비박 동안 음수', () => {
    const clock = createFakeClock();
    const sink = createFakeAudioSink(() => clock.now());
    const player = createPlayer({ sink, clock });
    const ts: number[] = [];
    player.record(song, false, asStep(0), (t) => ts.push(t));
    clock.frame(); // t = now - t0 - 2.4 = 0 - 0.06 - 2.4
    clock.advance(3.0);
    clock.frame(); // 3.0 - 0.06 - 2.4 = 0.54
    expect(ts[0]).toBeCloseTo(-2.46, 5);
    expect(ts[1]).toBeCloseTo(0.54, 5);
  });

  it('stop()이 세션을 정리하고 onEnded를 1회 발화', () => {
    const clock = createFakeClock();
    const sink = createFakeAudioSink(() => clock.now());
    const player = createPlayer({ sink, clock });
    let ended = 0;
    player.onEnded(() => ended++);
    player.record(song, false, asStep(0), () => {});
    player.stop();
    expect(player.isRecording()).toBe(false);
    expect(ended).toBe(1);
    clock.frame(); // 정리 후 프레임 — onFrame 미발화 확인은 아래에서
    player.stop(); // 이중 stop은 no-op
    expect(ended).toBe(1);
  });

  it('record는 진행 중이던 재생 세션을 먼저 정지', () => {
    const clock = createFakeClock();
    const sink = createFakeAudioSink(() => clock.now());
    const player = createPlayer({ sink, clock });
    player.play(song, { melody: true, accomp: false, metro: false }, asStep(0));
    player.record(song, false, asStep(0), () => {});
    expect(player.isPlaying()).toBe(false);
    expect(player.isRecording()).toBe(true);
  });
});
```

(기존 import 관례 확인 후 `Song`/`asStep`/`asMidi` 등 부족한 것만 추가.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/adapters/player.test.ts`
Expected: FAIL — `player.record is not a function`

- [ ] **Step 3: 구현** — `src/adapters/player.ts` 수정

(a) import에 Task 3 산출물 추가:

```ts
import { COUNT_IN_BEATS, recordingEvents, schedule, secPerStep, type PlayOpts } from '../engine/schedule';
import { asMidi, asSec, asStep, type Sec, type Song, type Step } from '../core/types';
```

(b) `Player` 인터페이스에 추가 (`preview` 선언 위):

```ts
  /** 레코딩 세션: 예비박(1마디) 후 fromStep부터 곡 끝까지 사운드.
   *  onFrame(t)는 본편 시작 기준 상대 초 — 예비박 동안 음수 */
  record(song: Song, accomp: boolean, fromStep: Step, onFrame: (t: Sec) => void): void;
  isRecording(): boolean;
```

(c) `createPlayer` 본문 — `let session` 옆에 레코딩 구독 해제 슬롯 추가:

```ts
  let session: Session | null = null;
  let recUnsub: (() => void) | null = null;
```

(d) 기존 `stop`을 레코딩까지 정리하도록 교체:

```ts
  const stop = (): void => {
    if (!session && !recUnsub) return;
    session?.unsubFrame();
    session = null;
    recUnsub?.();
    recUnsub = null;
    sink.stop();
    endedCbs.forEach((cb) => cb());
  };
```

(e) 반환 객체에 추가 (`preview` 앞):

```ts
    record(song, accomp, fromStep, onFrame) {
      stop();
      sink.stop(); // 프리뷰가 남긴 스테일 epoch 리셋 (play와 동일한 이유)
      const ciLen = COUNT_IN_BEATS * 4 * secPerStep(song.tempo);
      const t0 = sink.now() + 0.06; // sink epoch과 동일
      recUnsub = clock.onFrame(() => {
        if (!recUnsub) return;
        onFrame(asSec(sink.now() - t0 - ciLen));
      });
      sink.play(recordingEvents(song, accomp, fromStep));
    },

    isRecording: () => recUnsub !== null,
```

- [ ] **Step 4: 통과 확인 (기존 player 테스트 포함)**

Run: `npx vitest run src/adapters/player.test.ts`
Expected: PASS (기존 재생 테스트 회귀 없음)

- [ ] **Step 5: 커밋**

```bash
git add src/adapters/player.ts src/adapters/player.test.ts
git commit -m "feat(recording): add player record session with count-in"
```

---

### Task 5: store 레코딩 액션

**Files:**
- Modify: `src/ui/store/songStore.ts`
- Test: `src/ui/store/songStore.test.ts` (기존 파일 끝에 describe 추가)

**Interfaces:**
- Consumes: `insertRecorded`(Task 2), 기존 `pushUndo`.
- Produces: store 필드 `recTake: 'off' | 'clean' | 'dirty'`, 액션 `beginRecord()`, `recordCommit(spec: Pick<Note,'s'|'d'|'p'>)`, `endRecord()`. **undo push는 테이크의 첫 커밋에서만 1회** — 빈 테이크는 undo 스택을 오염시키지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/ui/store/songStore.test.ts` 끝에 추가

```ts
describe('레코딩 액션', () => {
  it('테이크 전체가 undo 1회로 롤백', () => {
    const store = createSongStore();
    const before = store.getState().song.notes.length;
    store.getState().beginRecord();
    store.getState().recordCommit({ s: asStep(0), d: 2, p: asMidi(60) });
    store.getState().recordCommit({ s: asStep(4), d: 2, p: asMidi(64) });
    store.getState().endRecord();
    store.getState().undoAction();
    expect(store.getState().song.notes).toHaveLength(before);
  });

  it('빈 테이크(커밋 없음)는 undo 스택에 안 쌓임', () => {
    const store = createSongStore();
    const song0 = store.getState().song;
    store.getState().beginRecord();
    store.getState().endRecord();
    store.getState().undoAction();
    expect(store.getState().song).toBe(song0); // undo할 것이 없어 동일 참조
  });

  it('beginRecord는 선택·프리뷰를 해제하고 recTake를 켠다', () => {
    const store = createSongStore();
    store.getState().selectDir(1);
    store.getState().beginRecord();
    expect(store.getState().sel).toBeNull();
    expect(store.getState().preview).toBeNull();
    expect(store.getState().recTake).toBe('clean');
    store.getState().endRecord();
    expect(store.getState().recTake).toBe('off');
  });

  it('recordCommit은 beginRecord 없이는 no-op', () => {
    const store = createSongStore();
    const before = store.getState().song.notes.length;
    store.getState().recordCommit({ s: asStep(0), d: 2, p: asMidi(60) });
    expect(store.getState().song.notes).toHaveLength(before);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/store/songStore.test.ts`
Expected: FAIL — `beginRecord is not a function`

- [ ] **Step 3: 구현** — `src/ui/store/songStore.ts` 수정

(a) import에 `insertRecorded` 추가 (editing에서), `Note` 타입은 이미 import됨.

(b) `SongStore` 인터페이스에 추가 (`padTap` 선언 위쪽 필드 구역):

```ts
  /** 레코딩 테이크: off=아님, clean=시작(커밋 전), dirty=커밋 있음 (undo push는 첫 커밋 1회) */
  readonly recTake: 'off' | 'clean' | 'dirty';
```

액션 구역(undoAction 앞)에 추가:

```ts
  /** 레코딩 시작: 선택·프리뷰 해제. undo push는 첫 recordCommit이 담당 */
  beginRecord(): void;
  /** 양자화된 노트 삽입 + 겹침 해소. undo push 없음(첫 커밋만 1회) */
  recordCommit(spec: Pick<Note, 's' | 'd' | 'p'>): void;
  endRecord(): void;
```

(c) 구현 — 반환 객체 초기값에 `recTake: 'off' as const,` 추가하고 `undoAction` 앞에:

```ts
      beginRecord: () => set({ recTake: 'clean', sel: null, preview: null, toast: null }),
      recordCommit: (spec) =>
        set((s) =>
          s.recTake === 'off'
            ? s
            : {
                song: insertRecorded(s.song, spec),
                undo: s.recTake === 'clean' ? pushUndo(s.undo, s.song) : s.undo,
                recTake: 'dirty',
              },
        ),
      endRecord: () => set({ recTake: 'off' }),
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/store/songStore.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/store/songStore.ts src/ui/store/songStore.test.ts
git commit -m "feat(recording): add store record actions with single undo"
```

---

### Task 6: useRecording 훅 (배선)

**Files:**
- Create: `src/ui/hooks/useRecording.ts`
- Test: `src/ui/hooks/useRecording.test.tsx`

**Interfaces:**
- Consumes: `initRecording/recKeyDown/recKeyUp/recTick`(Task 1), `secPerStep`·`COUNT_IN_BEATS`(Task 3), `player.record/stop/preview/onEnded`(Task 4), store 액션(Task 5), `measOf`(geometry).
- Produces:

```ts
export type RecPhase = 'idle' | 'countIn' | 'recording';
export interface RecordingApi {
  readonly phase: RecPhase;
  readonly countBeat: number | null; // 예비박 남은 카운트 4→1, countIn 외 null
  readonly recEl: number | null;     // 플레이헤드 스텝, recording 외 null
  start(): void;
  stop(): void;
  keyDown(midi: Midi): void;
  keyUp(midi: Midi): void;
}
export const useRecording = (store: StoreApi<SongStore>, player: Player): RecordingApi;
```

Task 7·8·9의 UI가 이 API만 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/ui/hooks/useRecording.test.tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock } from '../../adapters/fakes/fake-clock';
import { createPlayer } from '../../adapters/player';
import { asMidi } from '../../core/types';
import { createSongStore } from '../store/songStore';
import { useRecording } from './useRecording';

// demoSong 기본: 템포 100 → sps 0.15, 예비박 2.4초
const setup = () => {
  const clock = createFakeClock();
  const sink = createFakeAudioSink(() => clock.now());
  const player = createPlayer({ sink, clock });
  const store = createSongStore();
  const hook = renderHook(() => useRecording(store, player));
  return { clock, sink, player, store, hook };
};

const frameAt = (clock: ReturnType<typeof createFakeClock>, t: number): void => {
  clock.advance(t - clock.now());
  clock.frame();
};

describe('useRecording', () => {
  it('start → countIn → recording → 곡 끝 자동 종료', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    expect(hook.result.current.phase).toBe('countIn');
    expect(store.getState().recTake).toBe('clean');

    act(() => frameAt(clock, 0.1)); // 예비박 초반
    expect(hook.result.current.countBeat).toBe(4);

    act(() => frameAt(clock, 0.06 + 2.5)); // 본편 0.1초 지점
    expect(hook.result.current.phase).toBe('recording');
    expect(hook.result.current.recEl).not.toBeNull();

    const endT = 0.06 + 2.4 + store.getState().song.meas * 16 * 0.15;
    act(() => frameAt(clock, endT + 0.01));
    expect(hook.result.current.phase).toBe('idle');
    expect(store.getState().recTake).toBe('off');
  });

  it('keyDown/keyUp이 양자화된 노트를 스토어에 커밋', () => {
    const { clock, store, hook } = setup();
    const before = store.getState().song.notes.length;
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4)); // 본편 t=0
    act(() => hook.result.current.keyDown(asMidi(60)));
    act(() => frameAt(clock, 0.06 + 2.4 + 0.6)); // t=0.6 (4스텝)
    act(() => hook.result.current.keyUp(asMidi(60)));
    const notes = store.getState().song.notes;
    expect(notes.length).toBe(before + 1) /* 겹침 삭제가 없다면 */ ||
      expect(notes.some((n) => n.p === 60 && n.d === 4)).toBe(true);
  });

  it('수동 stop 시 held를 잘라 커밋하고 정리', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4));
    act(() => hook.result.current.keyDown(asMidi(72)));
    act(() => frameAt(clock, 0.06 + 2.4 + 0.3)); // 2스텝 홀드
    act(() => hook.result.current.stop());
    expect(hook.result.current.phase).toBe('idle');
    expect(store.getState().song.notes.some((n) => n.p === 72 && n.d === 2)).toBe(true);
    expect(store.getState().recTake).toBe('off');
  });

  it('idle에서 keyDown은 no-op', () => {
    const { store, hook } = setup();
    const before = store.getState().song;
    act(() => hook.result.current.keyDown(asMidi(60)));
    expect(store.getState().song).toBe(before);
  });
});
```

주의: 두 번째 테스트의 `||` 구문은 쓰지 말 것 — demoSong의 스텝 0 상황에 따라 겹침이 생길 수 있으므로 **아래처럼 단언 하나로 통일**한다:

```ts
    expect(notes.some((n) => n.p === 60 && n.s === 0 && n.d === 4)).toBe(true);
```

(demoSong 스텝 0에 기존 노트가 있으면 resolveOverlap으로 대체되므로 count 단언 대신 존재 단언을 쓴다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/hooks/useRecording.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

```ts
// src/ui/hooks/useRecording.ts
/**
 * 레코딩 세션 훅 — core/recording 상태 머신과 player.record·songStore를 잇는다.
 * 양자화·타이밍 판정은 전부 core에 있고 여기는 배선만 담당한다 (piano-recording-design §2).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { Player } from '../../adapters/player';
import { measOf } from '../../core/geometry';
import {
  initRecording,
  recKeyDown,
  recKeyUp,
  recTick,
  type NoteSpec,
  type RecState,
} from '../../core/recording';
import { asSec, asStep, type Midi, type Sec } from '../../core/types';
import { COUNT_IN_BEATS, secPerStep } from '../../engine/schedule';
import type { SongStore } from '../store/songStore';

export type RecPhase = 'idle' | 'countIn' | 'recording';

export interface RecordingApi {
  readonly phase: RecPhase;
  /** 예비박 남은 카운트 (4→1). countIn 외에는 null */
  readonly countBeat: number | null;
  /** 플레이헤드 스텝. recording 외에는 null */
  readonly recEl: number | null;
  start(): void;
  stop(): void;
  keyDown(midi: Midi): void;
  keyUp(midi: Midi): void;
}

interface Live {
  st: RecState;
  readonly sps: number;
  /** 마지막 프레임의 본편 기준 시각 */
  t: Sec;
}

export const useRecording = (store: StoreApi<SongStore>, player: Player): RecordingApi => {
  const [phase, setPhase] = useState<RecPhase>('idle');
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [recEl, setRecEl] = useState<number | null>(null);
  const live = useRef<Live | null>(null);

  const commit = useCallback(
    (spec: NoteSpec | null): void => {
      if (spec) store.getState().recordCommit(spec);
    },
    [store],
  );

  /** player.onEnded — stop()·자동 종료·외부 정지(편집 종료 등) 공통 정리 */
  useEffect(
    () =>
      player.onEnded(() => {
        if (!live.current) return;
        live.current = null;
        store.getState().endRecord();
        setPhase('idle');
        setCountBeat(null);
        setRecEl(null);
      }),
    [player, store],
  );

  const start = useCallback((): void => {
    if (live.current) return;
    const { song, curM } = store.getState();
    const sps = secPerStep(song.tempo);
    const st = initRecording(song, curM);
    live.current = { st, sps, t: asSec(-COUNT_IN_BEATS * 4 * sps) };
    store.getState().beginRecord();
    setPhase('countIn');
    setCountBeat(COUNT_IN_BEATS);

    player.record(song, song.accPat !== 'off', st.startStep, (t) => {
      const r = live.current;
      if (!r) return;
      r.t = t;
      if (t < 0) {
        setCountBeat(Math.min(COUNT_IN_BEATS, Math.ceil(-t / (r.sps * 4))));
        return;
      }
      setPhase('recording');
      setCountBeat(null);
      const el = Math.min(r.st.startStep + t / r.sps, r.st.endStep);
      setRecEl(el);
      const st2 = store.getState();
      const m = measOf(st2.song, asStep(Math.min(Math.floor(el), r.st.endStep - 1)));
      if (m !== st2.curM) st2.setCurM(m);
      const { st: next, commit: spec, done } = recTick(r.st, r.sps, t);
      r.st = next;
      commit(spec);
      if (done) player.stop(); // onEnded가 정리
    });
  }, [store, player, commit]);

  const stop = useCallback((): void => {
    const r = live.current;
    if (!r) return;
    if (r.st.held) {
      const { st, commit: spec } = recKeyUp(r.st, r.sps, r.st.held.p, r.t);
      r.st = st;
      commit(spec);
    }
    player.stop(); // onEnded가 정리
  }, [player, commit]);

  const keyDown = useCallback(
    (midi: Midi): void => {
      const r = live.current;
      if (!r) return;
      player.preview(midi);
      const { st, commit: spec } = recKeyDown(r.st, r.sps, midi, r.t);
      r.st = st;
      commit(spec);
    },
    [player, commit],
  );

  const keyUp = useCallback(
    (midi: Midi): void => {
      const r = live.current;
      if (!r) return;
      const { st, commit: spec } = recKeyUp(r.st, r.sps, midi, r.t);
      r.st = st;
      commit(spec);
    },
    [commit],
  );

  return { phase, countBeat, recEl, start, stop, keyDown, keyUp };
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/hooks/useRecording.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/hooks/useRecording.ts src/ui/hooks/useRecording.test.tsx
git commit -m "feat(recording): add useRecording wiring hook"
```

---

### Task 7: RecordingPiano 컴포넌트 (모바일 건반)

**Files:**
- Create: `src/ui/components/edit/RecordingPiano.tsx`
- Modify: `src/styles/global.css` (파일 끝에 스타일 추가)
- Test: `src/ui/components/edit/RecordingPiano.test.tsx`

**Interfaces:**
- Consumes: `BLACK_PC`, `pName`(constants), `asMidi`.
- Produces:

```ts
export interface RecordingPianoProps {
  readonly baseC: number;                    // 창 시작 C 피치 (36~60)
  readonly onShift: (dir: 1 | -1) => void;   // 옥타브 이동 (부모가 baseC 클램프)
  readonly onKeyDown: (p: Midi) => void;
  readonly onKeyUp: (p: Midi) => void;
}
export const RecordingPiano: (props: RecordingPianoProps) => JSX.Element;
export const initialBaseC: (song: Song) => number; // 초기 창 계산 (App이 사용)
```

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/ui/components/edit/RecordingPiano.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { asMidi, asStep, type Song } from '../../../core/types';
import { initialBaseC, RecordingPiano } from './RecordingPiano';

const mkSong = (notes: Song['notes']): Song => ({
  title: '', tempo: 100, meas: 1, pickup: 0, accPat: 'off',
  metro: 'off', mAcc: {}, notes, chords: {},
});

const noop = (): void => {};

describe('RecordingPiano', () => {
  it('흰건반 15개(2옥타브) + 검은건반 10개 렌더', () => {
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={noop} onKeyUp={noop} />);
    expect(document.querySelectorAll('.rp-white')).toHaveLength(15);
    expect(document.querySelectorAll('.rp-black')).toHaveLength(10);
  });

  it('pointerdown/up이 해당 피치로 콜백', () => {
    const down = vi.fn();
    const up = vi.fn();
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={down} onKeyUp={up} />);
    const key = document.querySelector('[data-key="52"]') as HTMLElement; // E3
    fireEvent.pointerDown(key);
    expect(down).toHaveBeenCalledWith(52);
    fireEvent.pointerUp(key);
    expect(up).toHaveBeenCalledWith(52);
  });

  it('pointercancel도 keyUp으로 처리', () => {
    const up = vi.fn();
    render(<RecordingPiano baseC={48} onShift={noop} onKeyDown={noop} onKeyUp={up} />);
    const key = document.querySelector('[data-key="48"]') as HTMLElement;
    fireEvent.pointerDown(key);
    fireEvent.pointerCancel(key);
    expect(up).toHaveBeenCalledWith(48);
  });

  it('옥타브 버튼: 끝(36/60)에서 비활성', () => {
    const shift = vi.fn();
    const { rerender } = render(
      <RecordingPiano baseC={36} onShift={shift} onKeyDown={noop} onKeyUp={noop} />,
    );
    const downBtn = screen.getByLabelText('Octave down');
    const upBtn = screen.getByLabelText('Octave up');
    expect(downBtn).toBeDisabled();
    fireEvent.click(upBtn);
    expect(shift).toHaveBeenCalledWith(1);
    rerender(<RecordingPiano baseC={60} onShift={shift} onKeyDown={noop} onKeyUp={noop} />);
    expect(screen.getByLabelText('Octave up')).toBeDisabled();
  });
});

describe('initialBaseC', () => {
  it('노트 없으면 C3(48)', () => {
    expect(initialBaseC(mkSong([]))).toBe(48);
  });
  it('중앙값 옥타브가 창 가운데: 중앙값 60(C4) → base 48', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(60) }]))).toBe(48);
  });
  it('낮은 곡은 36 클램프: 중앙값 38 → base 36', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(38) }]))).toBe(36);
  });
  it('높은 곡은 60 클램프: 중앙값 84 → base 60', () => {
    expect(initialBaseC(mkSong([{ id: 1, s: asStep(0), d: 4, p: asMidi(84) }]))).toBe(60);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/components/edit/RecordingPiano.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

```tsx
// src/ui/components/edit/RecordingPiano.tsx
/**
 * 레코딩용 2옥타브 피아노 (piano-recording-design §3.2).
 * 흰건반 15개 균등 분할 + 검은건반은 경계 위 배치 (PianoKeys와 동일 기하).
 * pointerdown/up/cancel로 누른 길이를 캡처한다. 글리산도 미지원(키별 capture).
 */
import { useState, type JSX, type PointerEvent } from 'react';
import { BLACK_PC, pName } from '../../../core/constants';
import { asMidi, type Midi, type Song } from '../../../core/types';

export interface RecordingPianoProps {
  /** 창 시작 C 피치 (36~60) */
  readonly baseC: number;
  readonly onShift: (dir: 1 | -1) => void;
  readonly onKeyDown: (p: Midi) => void;
  readonly onKeyUp: (p: Midi) => void;
}

/** 초기 창: 노트 피치 중앙값의 아래 옥타브 C. 노트 없으면 C3(48). 36~60 클램프 */
export const initialBaseC = (song: Song): number => {
  const ps = [...song.notes].map((n) => n.p).sort((a, b) => a - b);
  const med = ps[Math.floor(ps.length / 2)];
  if (med === undefined) return 48;
  return Math.max(36, Math.min(60, Math.floor(med / 12) * 12 - 12));
};

const isWhite = (p: number): boolean => !BLACK_PC.has(p % 12);

export const RecordingPiano = ({ baseC, onShift, onKeyDown, onKeyUp }: RecordingPianoProps): JSX.Element => {
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());

  const whites: number[] = [];
  const blacks: number[] = [];
  for (let p = baseC; p <= baseC + 24; p++) (isWhite(p) ? whites : blacks).push(p);
  const wPct = 100 / whites.length;

  const down = (p: number) => (e: PointerEvent<HTMLButtonElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPressed((s) => new Set(s).add(p));
    onKeyDown(asMidi(p));
  };
  const up = (p: number) => (): void => {
    setPressed((s) => {
      if (!s.has(p)) return s;
      const n = new Set(s);
      n.delete(p);
      return n;
    });
    onKeyUp(asMidi(p));
  };

  const keyProps = (p: number) => ({
    'data-key': p,
    onPointerDown: down(p),
    onPointerUp: up(p),
    onPointerCancel: up(p),
  });

  return (
    <div className="rpiano" role="group" aria-label="Recording piano">
      <div className="rp-top">
        <button
          type="button"
          className="rp-oct"
          aria-label="Octave down"
          disabled={baseC <= 36}
          onClick={() => onShift(-1)}
        >
          ◀
        </button>
        <span className="rp-range">{`${pName(baseC)} – ${pName(baseC + 24)}`}</span>
        <button
          type="button"
          className="rp-oct"
          aria-label="Octave up"
          disabled={baseC >= 60}
          onClick={() => onShift(1)}
        >
          ▶
        </button>
      </div>
      <div className="rp-keys">
        {whites.map((p) => (
          <button
            type="button"
            key={p}
            className={`rp-white${pressed.has(p) ? ' pressed' : ''}`}
            aria-label={pName(p)}
            {...keyProps(p)}
          >
            {p % 12 === 0 && <span className="rp-lab">{pName(p)}</span>}
          </button>
        ))}
        {blacks.map((p) => {
          const wi = whites.indexOf(p - 1);
          return (
            <button
              type="button"
              key={p}
              className={`rp-black${pressed.has(p) ? ' pressed' : ''}`}
              aria-label={pName(p)}
              style={{ left: `${(wi + 1) * wPct}%`, width: `${wPct * 0.62}%` }}
              {...keyProps(p)}
            />
          );
        })}
      </div>
    </div>
  );
};
```

`src/styles/global.css` 파일 끝에 추가:

```css
/* ── 레코딩 피아노 (piano-recording-design §3.2) ── */
.rpiano {
  background: var(--bg-pad-zone);
  padding: 10px 12px 14px;
}
.rp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.rp-oct {
  width: 44px;
  height: 30px;
  border: 1px solid var(--line2);
  border-radius: var(--radius);
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
}
.rp-oct:disabled {
  color: var(--mut);
  border-color: var(--line);
}
.rp-range {
  font-size: 11px;
  color: var(--mut2);
  letter-spacing: 0.04em;
}
.rp-keys {
  position: relative;
  display: flex;
  height: 132px;
  border: 1px solid var(--line2);
  border-radius: var(--radius-pad);
  overflow: hidden;
  background: var(--paper);
  touch-action: none;
}
.rp-white {
  flex: 1;
  min-width: 0;
  border: 0;
  border-right: 1px solid var(--line2);
  background: var(--paper);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 5px;
}
.rp-white:last-child {
  border-right: 0;
}
.rp-white.pressed {
  background: var(--brand-tint);
  box-shadow: inset 0 0 0 2px var(--brand-outline);
}
.rp-lab {
  font-size: 9px;
  color: var(--mut2);
}
.rp-white.pressed .rp-lab {
  color: var(--brand-tint-text);
  font-weight: 700;
}
.rp-black {
  position: absolute;
  top: 0;
  height: 58%;
  transform: translateX(-50%);
  border: 1px solid var(--ink);
  border-radius: 0 0 var(--radius-pad) var(--radius-pad);
  background: var(--ink);
  z-index: 2;
}
.rp-black.pressed {
  background: var(--brand-outline);
  border-color: var(--brand-outline);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/components/edit/RecordingPiano.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/components/edit/RecordingPiano.tsx src/ui/components/edit/RecordingPiano.test.tsx src/styles/global.css
git commit -m "feat(recording): add RecordingPiano two-octave keyboard"
```

---

### Task 8: 모바일 통합 (Header Rec/Stop + 오버레이 + 하단 교체)

**Files:**
- Modify: `src/ui/components/edit/Header.tsx`
- Modify: `src/ui/components/App.tsx` (모바일 return 구역, src/ui/components/App.tsx:330-401 부근)
- Modify: `src/styles/global.css` (파일 끝에 추가)
- Test: `src/ui/components/edit/Header.test.tsx`(기존 파일에 추가), `src/ui/components/App.test.tsx`(기존 파일에 추가 — 기존 App 테스트의 render 헬퍼 관례를 따른다)

**Interfaces:**
- Consumes: `useRecording`(Task 6), `RecordingPiano`/`initialBaseC`(Task 7).
- Produces: Header 신규 props — `recording: boolean`, `onRecord: () => void`, `onStop: () => void`. App 내부 상태 `pianoBase: number`.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/components/edit/Header.test.tsx`에 추가 (기존 render 헬퍼가 있으면 따르고, 신규 props는 기본값 `recording={false} onRecord={noop} onStop={noop}`으로 기존 호출부도 컴파일되게 한다):

```tsx
describe('레코딩 버튼', () => {
  it('평상시 Rec 버튼 표시, 탭하면 onRecord', () => {
    const onRecord = vi.fn();
    renderHeader({ recording: false, onRecord });
    fireEvent.click(screen.getByLabelText('Record'));
    expect(onRecord).toHaveBeenCalled();
  });

  it('레코딩 중엔 Stop만 활성 — 재생·템포·공유·뒤로 비활성', () => {
    const onStop = vi.fn();
    renderHeader({ recording: true, onStop });
    fireEvent.click(screen.getByLabelText('Stop recording'));
    expect(onStop).toHaveBeenCalled();
    expect(screen.getByLabelText('Play/Stop all')).toBeDisabled();
    expect(screen.getByLabelText('Share')).toBeDisabled();
    expect(screen.getByLabelText('Back to community')).toBeDisabled();
  });
});
```

`src/ui/components/App.test.tsx`에 추가 (기존 App 렌더 헬퍼 — player/hashStore 주입 관례 사용. 모바일 레이아웃이 기본이므로 matchMedia 모킹은 기존 관례 그대로):

```tsx
describe('모바일 레코딩 모드', () => {
  it('Rec 탭 → 카운트인 오버레이 + RecordingPiano 표시, Pad 숨김', () => {
    renderApp(); // 기존 헬퍼
    fireEvent.click(screen.getByLabelText('Record'));
    expect(document.querySelector('.rec-countin')).not.toBeNull();
    expect(document.querySelector('.rpiano')).not.toBeNull();
    expect(document.querySelector('.pad')).toBeNull(); // Pad 루트 클래스는 기존 Pad.tsx 확인 후 일치시킬 것
  });

  it('Stop 탭 → 편집 UI 복원', () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Record'));
    fireEvent.click(screen.getByLabelText('Stop recording'));
    expect(document.querySelector('.rpiano')).toBeNull();
  });
});
```

(참고: `renderApp` 헬퍼가 실제 player를 요구하면 `createPlayer({ sink: createFakeAudioSink(() => clock.now()), clock: createFakeClock() })`로 주입 — 기존 App 테스트 파일의 방식을 그대로 복사.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/components/edit/Header.test.tsx src/ui/components/App.test.tsx`
Expected: FAIL — `Record` label 없음

- [ ] **Step 3: 구현**

**(a) Header.tsx** — `HeaderProps`에 추가:

```ts
  /** 레코딩 모드 여부 — true면 Stop만 활성 (piano-recording-design §3.2) */
  readonly recording: boolean;
  readonly onRecord: () => void;
  readonly onStop: () => void;
```

`header-btns` 렌더 수정 — 재생 버튼 앞에 Rec 버튼 추가, recording일 때 나머지 비활성 + Stop 표시:

```tsx
        <div className="header-btns">
          <button
            type="button"
            data-btn="acc"
            className={`icon-btn${accOn ? ' on' : ''}`}
            aria-label="Chord accompaniment"
            disabled={recording}
            onClick={() => setAccPop((v) => !v)}
          >
            <Icon name="chord" color={accOn ? '#fff' : 'var(--ink)'} />
          </button>
          <button
            type="button"
            data-btn="metro"
            className={`icon-btn${metroOn ? ' on' : ''}`}
            aria-label="Metronome"
            disabled={recording}
            onClick={onToggleMetro}
          >
            <Icon name="metro" color={metroOn ? '#fff' : 'var(--ink)'} />
          </button>
          {recording ? (
            <button
              type="button"
              data-btn="stop-rec"
              className="icon-btn rec-stop"
              aria-label="Stop recording"
              onClick={onStop}
            >
              <span className="rec-stop-square" />
            </button>
          ) : (
            <button
              type="button"
              data-btn="rec"
              className="icon-btn rec-btn"
              aria-label="Record"
              onClick={onRecord}
            >
              <span className="rec-dot" />
            </button>
          )}
          <button
            type="button"
            data-btn="playall"
            className="icon-btn"
            aria-label="Play/Stop all"
            disabled={recording}
            onClick={onTogglePlay}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button
            type="button"
            data-btn="tempo"
            className="chip"
            disabled={recording}
            onClick={() => {
              setTempoInput(String(song.tempo));
              setTempoPop((v) => !v);
            }}
          >
            {`♩=${song.tempo}`}
          </button>
          <button type="button" data-btn="share" className="icon-btn" aria-label="Share" disabled={recording} onClick={onShare}>
            <Icon name="share" size={15} />
          </button>
        </div>
```

back 버튼(`data-btn="back"`)에도 `disabled={recording}` 추가.

**(b) App.tsx** — 모바일·데스크톱 공용 배선 (함수 컴포넌트 상단, `desktop` 선언 아래):

```tsx
  /* 레코딩 세션 (piano-recording-design §2·§3) */
  const rec = useRecording(store, player);
  const recActive = rec.phase !== 'idle';
  const [pianoBase, setPianoBase] = useState(48);

  const recStart = (): void => {
    setCpBeat(null);
    setPianoBase(initialBaseC(store.getState().song));
    rec.start();
  };
  const shiftPiano = (dir: 1 | -1): void =>
    setPianoBase((b) => Math.max(36, Math.min(60, b + dir * 12)));
```

import 추가:

```ts
import { useRecording } from '../hooks/useRecording';
import { initialBaseC, RecordingPiano } from './edit/RecordingPiano';
```

모바일 return 수정 — Header에 props 전달:

```tsx
        <Header
          song={s.song}
          accOn={accOn}
          metroOn={metroOn}
          playing={playing}
          recording={recActive}
          onRecord={recStart}
          onStop={rec.stop}
          ...(기존 props 그대로)
        />
```

Header 아래(pane-score 안, Score 위)에 REC 상태줄 + Score playhead + 카운트인 오버레이:

```tsx
        {recActive && (
          <div className="rec-state">
            <span className="rec-dot rec-blink" />
            <span className="rec-lab">{rec.phase === 'countIn' ? 'COUNT-IN' : 'REC'}</span>
            <span className="rec-meta">{`Bar ${s.curM + (s.song.pickup ? 0 : 1)} · ♩=${s.song.tempo}`}</span>
          </div>
        )}
        <div className="score-wrap">
          <Score
            song={s.song}
            mode="edit"
            curM={s.curM}
            sel={s.sel}
            width={scoreW}
            {...(rec.phase === 'recording' && rec.recEl !== null
              ? { playheadStep: rec.recEl }
              : playing && playEl !== null
                ? { playheadStep: playEl }
                : {})}
            onMeasureTap={(m) => {
              if (recActive) return;
              setCpBeat(null);
              store.getState().gotoMeasure(m);
            }}
          />
          {rec.phase === 'countIn' && (
            <div className="rec-countin" role="status">
              <div className="rec-ci-num">{rec.countBeat}</div>
              <div className="rec-ci-hint">Play on the first beat</div>
            </div>
          )}
        </div>
```

(`.score-wrap`은 position:relative 래퍼 — 오버레이 absolute 기준. 기존에 Score가 직접 pane-score 자식이면 이 래퍼 div를 신설한다.)

`pane-edit` 하단 교체:

```tsx
      <div className="pane-edit">
        {recActive ? (
          <RecordingPiano
            baseC={pianoBase}
            onShift={shiftPiano}
            onKeyDown={rec.keyDown}
            onKeyUp={rec.keyUp}
          />
        ) : (
          <>
            <ChordRow ... 기존 그대로 />
            {cpBeat !== null && <ChordPicker ... 기존 그대로 />}
            <Pad ... 기존 그대로 />
            <MeasureBar ... 기존 그대로 />
            <Steppers ... 기존 그대로 />
            <ButtonBar ... 기존 그대로 />
          </>
        )}
      </div>
```

**(c) global.css** 파일 끝에 추가:

```css
/* ── 레코딩 모드 (piano-recording-design §3.2) ── */
.rec-btn .rec-dot,
.rec-state .rec-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--red);
}
.rec-stop {
  background: var(--red);
  border-color: var(--red);
}
.rec-stop-square {
  display: inline-block;
  width: 9px;
  height: 9px;
  background: var(--paper);
}
.rec-blink {
  animation: rec-blink 1s steps(2) infinite;
}
@keyframes rec-blink {
  50% {
    opacity: 0.25;
  }
}
.rec-state {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 14px;
  font-size: 11px;
  border-bottom: 1px solid var(--line);
}
.rec-lab {
  color: var(--red);
  font-weight: 800;
  letter-spacing: 0.08em;
}
.rec-meta {
  color: var(--mut2);
}
.score-wrap {
  position: relative;
}
.rec-countin {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: color-mix(in srgb, var(--bg-page) 90%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rec-ci-num {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--ink);
}
.rec-ci-hint {
  font-size: 12px;
  color: var(--mut2);
}
```

- [ ] **Step 4: 통과 확인 (전체 회귀 포함)**

Run: `npx vitest run src/ui/components/edit/Header.test.tsx src/ui/components/App.test.tsx && npm run typecheck`
Expected: PASS. Header 신규 props 때문에 데스크톱 경로가 컴파일 에러면 이 시점에는 모바일 경로만 고치고, 데스크톱 Workspace 쪽 임시 전달은 하지 않는다(Workspace는 Header를 쓰지 않음 — WsTopBar 사용이라 무관).

- [ ] **Step 5: 커밋**

```bash
git add src/ui/components/edit/Header.tsx src/ui/components/App.tsx src/styles/global.css src/ui/components/edit/Header.test.tsx src/ui/components/App.test.tsx
git commit -m "feat(recording): wire mobile recording mode into edit screen"
```

---

### Task 9: 데스크톱 통합 (Workspace Rec + PianoKeys armed + 단축키 R)

**Files:**
- Modify: `src/ui/components/edit/ws/PianoKeys.tsx`
- Modify: `src/ui/components/edit/ws/Workspace.tsx`
- Modify: `src/ui/hooks/useKeyboardShortcuts.ts`
- Modify: `src/ui/components/App.tsx` (데스크톱 return + shortcuts)
- Modify: `src/styles/ws.css` (파일 끝에 추가)
- Test: `src/ui/components/edit/ws/PianoKeys.test.tsx`(추가), `src/ui/hooks/useKeyboardShortcuts.test.tsx`(추가)

**Interfaces:**
- Consumes: `RecordingApi`(Task 6).
- Produces: PianoKeys 신규 optional props — `recording?: boolean`, `onRecKeyDown?: (p: Midi) => void`, `onRecKeyUp?: (p: Midi) => void`. Workspace 신규 props — `recPhase: RecPhase`, `countBeat: number | null`, `recEl: number | null`, `onRecord: () => void`, `onRecStop: () => void`, `onRecKeyDown: (p: Midi) => void`, `onRecKeyUp: (p: Midi) => void`. ShortcutAction에 `'record'` 추가 (키 `r`).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/components/edit/ws/PianoKeys.test.tsx`에 추가:

```tsx
describe('레코딩 armed 모드', () => {
  it('recording=true면 pointerdown/up이 레코딩 콜백으로', () => {
    const down = vi.fn();
    const up = vi.fn();
    const tap = vi.fn();
    render(
      <PianoKeys onKeyTap={tap} recording onRecKeyDown={down} onRecKeyUp={up} />,
    );
    const key = document.querySelector('[data-key="60"]') as HTMLElement;
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
    expect(down).toHaveBeenCalledWith(60);
    expect(up).toHaveBeenCalledWith(60);
    fireEvent.click(key);
    expect(tap).not.toHaveBeenCalled(); // 레코딩 중엔 탭 삽입 비활성
    expect(document.querySelector('.pk.armed')).not.toBeNull();
  });

  it('recording=false면 기존 클릭 동작 유지', () => {
    const tap = vi.fn();
    render(<PianoKeys onKeyTap={tap} />);
    fireEvent.click(document.querySelector('[data-key="60"]') as HTMLElement);
    expect(tap).toHaveBeenCalledWith(60);
  });
});
```

`src/ui/hooks/useKeyboardShortcuts.test.tsx`에 추가 (기존 resolveShortcut 테스트 관례):

```tsx
it('r → record', () => {
  expect(resolveShortcut(new KeyboardEvent('keydown', { key: 'r' }))).toBe('record');
});
it('한글 자판 ㄱ(KeyR)도 record', () => {
  expect(
    resolveShortcut(new KeyboardEvent('keydown', { key: 'ㄱ', code: 'KeyR' })),
  ).toBe('record');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/components/edit/ws/PianoKeys.test.tsx src/ui/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현**

**(a) PianoKeys.tsx** — props 확장 + 이벤트 분기:

```tsx
export interface PianoKeysProps {
  readonly onKeyTap: (p: Midi) => void;
  /** 레코딩 armed — true면 클릭 삽입 대신 pointer down/up 캡처 (piano-recording-design §3.3) */
  readonly recording?: boolean;
  readonly onRecKeyDown?: (p: Midi) => void;
  readonly onRecKeyUp?: (p: Midi) => void;
}
```

컴포넌트 시그니처를 `({ onKeyTap, recording = false, onRecKeyDown, onRecKeyUp })`로 바꾸고, 키 버튼 공통 핸들러를 정의해 흰/검은건반 양쪽에 적용:

```tsx
  const handlers = (p: number) =>
    recording
      ? {
          onPointerDown: (e: PointerEvent<HTMLButtonElement>): void => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onRecKeyDown?.(asMidi(p));
          },
          onPointerUp: (): void => onRecKeyUp?.(asMidi(p)),
          onPointerCancel: (): void => onRecKeyUp?.(asMidi(p)),
        }
      : { onClick: (): void => onKeyTap(asMidi(p)) };
```

루트 div: `className={`pk${recording ? ' armed' : ''}`}`. 각 버튼의 `onClick={...}`을 `{...handlers(p)}`로 교체. `import type { PointerEvent }` 추가.

**(b) useKeyboardShortcuts.ts** — `ShortcutAction` 유니온에 `| 'record'` 추가, `CODE_KEYS`에 `KeyR: 'r',` 추가, `resolveShortcut` switch에 추가:

```ts
    case 'r':
      return 'record';
```

**(c) Workspace.tsx** — props에 추가:

```ts
  readonly recPhase: 'idle' | 'countIn' | 'recording';
  readonly countBeat: number | null;
  readonly recEl: number | null;
  readonly onRecord: () => void;
  readonly onRecStop: () => void;
  readonly onRecKeyDown: (p: Midi) => void;
  readonly onRecKeyUp: (p: Midi) => void;
```

구조 분해에 추가하고, 본문에 `const recActive = recPhase !== 'idle';` 선언. 플레이헤드는:

```ts
  const playheadStep =
    recPhase === 'recording' && recEl !== null ? recEl : playing && playEl !== null ? playEl : undefined;
```

ws-transport의 재생 버튼 뒤에 Rec 버튼 + 상태 칩:

```tsx
            <button
              type="button"
              data-btn="rec"
              className={`ws-icon-btn ws-rec${recActive ? ' on' : ''}`}
              aria-label={recActive ? 'Stop recording' : 'Record'}
              onClick={recActive ? onRecStop : onRecord}
            >
              <span className={recActive ? 'rec-stop-square' : 'rec-dot'} />
            </button>
            {recActive && (
              <span className="ws-rec-chip">
                {recPhase === 'countIn' ? `Count-in ${countBeat ?? ''}` : 'REC'}
              </span>
            )}
```

undo/redo/del/재생/템포/메트로 버튼에 `disabled={recActive}` 추가. `PianoRoll`의 `onCellTap`/`onDragNote`와 `StaffLane`의 `onChordTap`은 recActive면 no-op으로 감싼다:

```tsx
            <PianoRoll
              song={song}
              pxPerStep={pxPerStep}
              sel={sel}
              onCellTap={recActive ? () => {} : onCellTap}
              onDragNote={recActive ? () => {} : onDragNote}
              {...(playheadStep !== undefined ? { playheadStep } : {})}
            />
```

하단 건반:

```tsx
          <PianoKeys
            onKeyTap={onKeyTap}
            recording={recActive}
            onRecKeyDown={onRecKeyDown}
            onRecKeyUp={onRecKeyUp}
          />
```

**(d) App.tsx** — 데스크톱 return의 Workspace에 props 전달:

```tsx
          recPhase={rec.phase}
          countBeat={rec.countBeat}
          recEl={rec.recEl}
          onRecord={recStart}
          onRecStop={rec.stop}
          onRecKeyDown={rec.keyDown}
          onRecKeyUp={rec.keyUp}
```

shortcuts 객체 수정 — `record` 추가 + 레코딩 중 가드:

```tsx
  const guard = (fn: () => void) => (): void => {
    if (!recActive) fn();
  };
  const shortcuts: Record<ShortcutAction, () => void> = {
    selectPrev: guard(() => store.getState().selectDir(-1)),
    selectNext: guard(() => store.getState().selectDir(1)),
    pitchUp: guard(() => store.getState().stepPitch(1)),
    pitchDown: guard(() => store.getState().stepPitch(-1)),
    posBack: guard(() => store.getState().stepPos(-1)),
    posFwd: guard(() => store.getState().stepPos(1)),
    lenInc: guard(() => store.getState().stepLen(1)),
    lenDec: guard(() => store.getState().stepLen(-1)),
    playToggle: () => (recActive ? rec.stop() : togglePlay()),
    playMeasure: guard(playMeasure),
    del: guard(() => store.getState().deleteSel()),
    measPrev: guard(measurePrev),
    measNext: guard(measureNext),
    undo: guard(() => store.getState().undoAction()),
    redo: guard(() => store.getState().redoAction()),
    escape: () => (recActive ? rec.stop() : setCpBeat(null)),
    record: () => (recActive ? rec.stop() : recStart()),
    noteA: guard(() => store.getState().noteLetter('A')),
    noteB: guard(() => store.getState().noteLetter('B')),
    noteC: guard(() => store.getState().noteLetter('C')),
    noteD: guard(() => store.getState().noteLetter('D')),
    noteE: guard(() => store.getState().noteLetter('E')),
    noteF: guard(() => store.getState().noteLetter('F')),
    noteG: guard(() => store.getState().noteLetter('G')),
  };
```

**(e) ws.css** 파일 끝에 추가:

```css
/* ── 레코딩 (piano-recording-design §3.3) ── */
.ws-rec .rec-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--red);
}
.ws-rec.on {
  background: var(--red);
  border-color: var(--red);
}
.ws-rec.on .rec-stop-square {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--paper);
}
.ws-rec-chip {
  border: 1px solid var(--red);
  color: var(--red);
  border-radius: var(--radius);
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pk.armed {
  border-color: var(--red);
  box-shadow: 0 0 0 1px var(--red);
}
```

(주의: `.rec-stop-square`/`.rec-dot`은 global.css에도 정의된다 — ws.css에서는 `.ws-rec` 스코프로만 정의해 충돌을 피한다.)

- [ ] **Step 4: 통과 확인 (전체)**

Run: `npm test && npm run typecheck`
Expected: PASS — Workspace 신규 필수 props로 인한 컴파일 에러는 (d)의 App 전달로 해소됨. Workspace.test가 있으면 렌더 헬퍼에 신규 props 기본값(`recPhase="idle"` 등) 추가.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/components/edit/ws/PianoKeys.tsx src/ui/components/edit/ws/Workspace.tsx src/ui/hooks/useKeyboardShortcuts.ts src/ui/components/App.tsx src/styles/ws.css src/ui/components/edit/ws/PianoKeys.test.tsx src/ui/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(recording): wire desktop workspace recording mode"
```

---

### Task 10: 게이트 + 실기 검증

**Files:** 없음 (검증만). 발견된 결함은 해당 태스크 파일로 돌아가 수정.

- [ ] **Step 1: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 PASS. lint의 trailing-space·미사용 import 위반은 즉시 수정.

- [ ] **Step 2: 실기 검증 — `verify` 스킬 사용**

`verify` 스킬(dev 서버 + Playwright)을 호출해 다음 시나리오를 확인한다:

1. 모바일 뷰포트(390×844): Rec 탭 → 카운트다운 4·3·2·1 표시 → 피아노 등장 → 건반 몇 개 탭 → 악보에 노트 생김 → 곡 끝 자동 종료 → 편집 UI 복원 → Undo 1회로 테이크 전체 롤백.
2. 데스크톱 뷰포트(1280×800): R 키 → 카운트인 칩 → PianoKeys 클릭·홀드 → 노트 생성 → Esc 정지 → 편집 컨트롤 재활성.
3. 스크린샷을 찍어 사용자에게 전달.

- [ ] **Step 3: 최종 커밋 (수정이 있었던 경우만)**

```bash
git add -A && git commit -m "fix(recording): address issues found in live verification"
```

---

## Self-Review 결과 (계획 작성 후 점검 완료)

- 스펙 §1 표의 모든 UX 결정 → Task 1(길이·양자화·범위), 3(예비박·사운드), 5(언두), 7(2옥타브·초기창), 8·9(양 화면) 커버.
- 스펙 §4 엣지 케이스 → Task 1 테스트(이른 터치·곡 끝·레가토·불일치 keyUp), Task 6(수동 stop held 커밋, onEnded 공통 정리 — 편집 종료 exit()의 player.stop()도 이 경로로 정리됨), Task 7(pointercancel).
- 타입 일관성: `NoteSpec = Pick<Note,'s'|'d'|'p'>` 전 태스크 동일. `record(song, accomp, fromStep, onFrame)` Task 4 정의 = Task 6 사용 일치. `recTake` Task 5 정의 = Task 6·8 사용 일치.
- 미구현 참조 없음: 각 태스크의 Consumes는 전부 앞 태스크의 Produces에 존재.
