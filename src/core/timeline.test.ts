import { describe, expect, it } from 'vitest';
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  spanW,
  stepCenterX,
  stepToX,
  xToStep,
} from './timeline';

describe('timeline 공유 좌표계', () => {
  it('stepToX: 스텝 좌측 x = step * pxPerStep', () => {
    expect(stepToX(0, 14)).toBe(0);
    expect(stepToX(16, 14)).toBe(224);
  });

  it('stepCenterX: 스텝 셀 중앙', () => {
    expect(stepCenterX(0, 14)).toBe(7);
    expect(stepCenterX(4, 10)).toBe(45);
  });

  it('spanW: 길이 → 폭', () => {
    expect(spanW(4, 14)).toBe(56);
    expect(spanW(1, 10)).toBe(10);
  });

  it('xToStep는 stepToX의 역변환(floor)이다', () => {
    expect(xToStep(0, 14)).toBe(0);
    expect(xToStep(224, 14)).toBe(16);
    // 셀 내부 어디를 눌러도 해당 스텝으로 스냅
    expect(xToStep(13, 14)).toBe(0);
    expect(xToStep(15, 14)).toBe(1);
  });

  it('음수 x는 0 스텝으로 클램프', () => {
    expect(xToStep(-5, 14)).toBe(0);
  });

  it('clampZoom: [ZOOM_MIN, ZOOM_MAX] 범위로 제한', () => {
    expect(clampZoom(ZOOM_DEFAULT)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(ZOOM_MIN - 100)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX + 100)).toBe(ZOOM_MAX);
  });

  it('두 뷰가 같은 pxPerStep으로 같은 스텝을 같은 x에 그린다 (정렬 불변식)', () => {
    const px = 12;
    for (const step of [0, 4, 16, 33]) {
      // 악보 음표 머리(스팬 중앙)와 피아노롤 블록 중앙이 일치해야 한다
      const d = 4;
      const staffHead = stepToX(step, px) + spanW(d, px) / 2;
      const rollCenter = stepToX(step, px) + spanW(d, px) / 2;
      expect(staffHead).toBe(rollCenter);
    }
  });
});
