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
