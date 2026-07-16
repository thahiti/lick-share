/**
 * 레코딩 상태 머신 테스트 (piano-recording-design §2.1).
 * 시각은 전부 숫자로 주입 — 템포 100 기준 sps=0.15.
 */
import { describe, expect, it } from 'vitest';
import { initRecording, recKeyDown, recKeyUp, recTick } from './recording';
import { asBar, asMidi, asSec, type Song } from './types';

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
