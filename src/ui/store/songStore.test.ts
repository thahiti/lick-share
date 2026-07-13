import { describe, expect, test } from 'vitest';
import { demoSong } from '../../core/demo-song';
import { asMidi } from '../../core/types';
import { createSongStore } from './songStore';

describe('songStore (core 순수 함수 래핑)', () => {
  test('padTap 입력 → song 반영 + 선택 + undo 스냅샷', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0);
    const s = store.getState();
    // 기존 [0,4) p=64 노트는 겹침 해소로 제거되고 새 노트가 들어간다
    const added = s.song.notes.find((n) => n.p === 60);
    expect(added).toMatchObject({ s: 0, d: 4 });
    expect(s.song.notes.some((n) => n.id === 1)).toBe(false);
    expect(s.sel).toBe(added?.id);
    expect(s.undo.past).toHaveLength(1);
  });

  test('padTapAt: 지정 마디에 입력 + curM 이동 + 단일 undo', () => {
    const store = createSongStore();
    store.getState().loadSong({ ...demoSong, notes: [] });
    store.getState().padTapAt(2, asMidi(60), 4);
    const s = store.getState();
    expect(s.curM).toBe(2);
    expect(s.song.notes).toHaveLength(1);
    expect(s.song.notes[0]).toMatchObject({ s: 2 * 16 + 4, d: 4, p: 60 });
    expect(s.sel).toBe(s.song.notes[0]?.id ?? null);
    expect(s.undo.past).toHaveLength(1);
    store.getState().undoAction();
    expect(store.getState().song.notes).toHaveLength(0);
  });

  test('변경 없는 조작(선택만)은 undo 스냅샷을 쌓지 않음', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(64), 0); // 기존 노트 선택
    expect(store.getState().sel).toBe(1);
    expect(store.getState().undo.past).toHaveLength(0);
  });

  test('임의 5조작 후 undo×5 → 초기 상태 deep equal', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0); // 1: 입력
    store.getState().stepPitch(1); // 2: 음높이
    store.getState().stepPos(1); // 3: 위치
    store.getState().addMeasure(); // 4: 마디 추가
    store.getState().cycleMeasureAcc(); // 5: 마디 반주
    expect(store.getState().song).not.toEqual(demoSong);
    for (let i = 0; i < 5; i++) store.getState().undoAction();
    expect(store.getState().song).toEqual(demoSong);
    expect(store.getState().undo.past).toHaveLength(0);
  });

  test('redo: undo 전 상태로 복원', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0);
    store.getState().stepPitch(1);
    const after = store.getState().song;
    store.getState().undoAction();
    store.getState().undoAction();
    store.getState().redoAction();
    store.getState().redoAction();
    expect(store.getState().song).toEqual(after);
  });

  test('restore 후 정합: 사라진 마디의 curM 클램프, 사라진 선택 해제', () => {
    const store = createSongStore();
    store.getState().addMeasure(); // meas=5, curM=4
    store.getState().padTap(asMidi(60), 0); // 마디 4에 입력 + 선택
    expect(store.getState().curM).toBe(4);
    store.getState().undoAction(); // 입력 취소 → 선택 노트 소멸
    expect(store.getState().sel).toBeNull();
    store.getState().undoAction(); // 마디 추가 취소 → curM 범위 밖
    expect(store.getState().curM).toBe(3);
    expect(store.getState().song).toEqual(demoSong);
  });

  test('toast/preview 전달', () => {
    const store = createSongStore();
    store.getState().padTap('rest', 3); // 데모 곡 마디0 step3은 노트 중간 → 자르기 토스트
    expect(store.getState().toast).toBe('쉼표로 변경');
  });
});

describe('songStore: 세션 상태 (설계 문서 §3, SPEC §3.1)', () => {
  test('setTempo: 클램프 반영 + undo', () => {
    const store = createSongStore();
    store.getState().setTempo(300);
    expect(store.getState().song.tempo).toBe(240);
    store.getState().undoAction();
    expect(store.getState().song.tempo).toBe(100);
  });

  test('setAccGlobal: 패턴 선택 = 반주 켬 + 전역 패턴, 끔 = accOn false (패턴 유지)', () => {
    const store = createSongStore();
    expect(store.getState().accOn).toBe(true);
    store.getState().setAccGlobal('comp');
    expect(store.getState().accOn).toBe(true);
    expect(store.getState().song.accPat).toBe('comp');
    store.getState().setAccGlobal('off');
    expect(store.getState().accOn).toBe(false);
    expect(store.getState().song.accPat).toBe('comp');
  });

  test('setAccGlobal: 같은 패턴 재선택은 undo를 쌓지 않음', () => {
    const store = createSongStore();
    store.getState().setAccGlobal('pad'); // 이미 pad
    expect(store.getState().undo.past).toHaveLength(0);
    store.getState().setAccGlobal('arp');
    expect(store.getState().undo.past).toHaveLength(1);
  });

  test('toggleMetro: 세션 토글 (undo 무관)', () => {
    const store = createSongStore();
    expect(store.getState().metroOn).toBe(false);
    store.getState().toggleMetro();
    expect(store.getState().metroOn).toBe(true);
    expect(store.getState().undo.past).toHaveLength(0);
  });
});

describe('songStore: 소리 피드백 규칙 (SPEC §3.7)', () => {
  test('입력·선택·pitch 변경 → preview 있음', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0); // 입력
    expect(store.getState().preview).not.toBeNull();
    store.getState().stepPitch(1); // 음높이
    expect(store.getState().preview).not.toBeNull();
    store.getState().selectDir(1); // 선택 이동
    expect(store.getState().preview).not.toBeNull();
  });

  test('pos/len 변경 → preview 없음', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0);
    store.getState().stepPos(1);
    expect(store.getState().preview).toBeNull();
    store.getState().stepLen(1);
    expect(store.getState().preview).toBeNull();
  });
});

describe('songStore: 조립용 액션 (P8)', () => {
  test('gotoMeasure: 이동 + 첫 노트 선택 + 프리뷰, undo 안 쌓임', () => {
    const store = createSongStore();
    store.getState().gotoMeasure(2);
    expect(store.getState().curM).toBe(2);
    expect(store.getState().sel).toBe(8);
    expect(store.getState().preview).not.toBeNull();
    expect(store.getState().undo.past).toHaveLength(0);
  });

  test('setCurM: 재생 추적 — 선택 유지, 프리뷰 없음', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(64), 0); // sel=1 (선택만)
    store.getState().setCurM(3);
    expect(store.getState().curM).toBe(3);
    expect(store.getState().sel).toBe(1);
    expect(store.getState().preview).toBeNull();
  });

  test('setSel: 재생 중 현재 음 선택 — sel 갱신, 프리뷰 없음(소리 중복 방지)', () => {
    const store = createSongStore();
    store.getState().setSel(6);
    expect(store.getState().sel).toBe(6);
    expect(store.getState().preview).toBeNull();
  });

  test('loadSong: 곡 교체 + undo/세션 초기화', () => {
    const store = createSongStore();
    store.getState().padTap(asMidi(60), 0);
    store.getState().loadSong({ ...demoSong, tempo: 88 });
    const s = store.getState();
    expect(s.song.tempo).toBe(88);
    expect(s.undo.past).toHaveLength(0);
    expect(s.sel).toBeNull();
    expect(s.curM).toBe(0);
  });

  test('clearToast', () => {
    const store = createSongStore();
    store.getState().padTap('rest', 3);
    expect(store.getState().toast).not.toBeNull();
    store.getState().clearToast();
    expect(store.getState().toast).toBeNull();
  });
});

describe('songStore: showToast (P9)', () => {
  test('임의 토스트 표시', () => {
    const store = createSongStore();
    store.getState().showToast('열람 링크 복사됨');
    expect(store.getState().toast).toBe('열람 링크 복사됨');
  });
});
