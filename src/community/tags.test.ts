/** 태그 정규화 (publish-tags 설계 §3) — 순수 함수 규칙 검증 */
import { describe, expect, it } from 'vitest';
import { normalizeTag, normalizeTags } from './tags';

describe('normalizeTag', () => {
  it('# 제거·소문자화·공백 런은 하이픈 1개로', () => {
    expect(normalizeTag('#Jazz Blues')).toBe('jazz-blues');
    expect(normalizeTag('Jazz   Blues')).toBe('jazz-blues');
  });

  it('trim 후 처리한다', () => {
    expect(normalizeTag('  bebop  ')).toBe('bebop');
  });

  it('허용 문자 외(이모지·특수문자)는 제거하고 한글은 유지한다', () => {
    expect(normalizeTag('재즈')).toBe('재즈');
    expect(normalizeTag('jazz!🎷')).toBe('jazz');
    expect(normalizeTag('ㅋㅋ')).toBe('ㅋㅋ');
  });

  it('연속 하이픈은 1개로, 양끝 하이픈은 제거한다', () => {
    expect(normalizeTag('  --jazz--  ')).toBe('jazz');
    expect(normalizeTag('jazz--blues')).toBe('jazz-blues');
  });

  it('15자로 truncate한다', () => {
    expect(normalizeTag('a'.repeat(20))).toBe('a'.repeat(15));
  });

  it('빈 문자열·공백만·정규화 후 빈 값은 null', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('#')).toBeNull();
    expect(normalizeTag('!!!')).toBeNull();
  });
});

describe('normalizeTags', () => {
  it('null 결과는 제거하고 첫 등장 순서를 유지한다', () => {
    expect(normalizeTags(['#Jazz', '', 'blues'])).toEqual(['jazz', 'blues']);
  });

  it('대소문자 차이는 중복으로 1개만 남긴다', () => {
    expect(normalizeTags(['Bebop', 'bebop'])).toEqual(['bebop']);
  });

  it('4개 입력은 앞 3개로 컷한다', () => {
    expect(normalizeTags(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });

  it('빈 입력은 빈 배열', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
