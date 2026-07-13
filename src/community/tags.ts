/**
 * 태그 정규화 (publish-tags 설계 §3) — 순수 문자열 로직.
 * 개수 상한(3)은 DB CHECK와 이중 방어, 원소 길이(15)·문자 집합은 여기서만 강제한다.
 */

export const MAX_TAGS = 3;
export const MAX_TAG_LENGTH = 15;

/** 자유 입력 raw 문자열 하나 → 정규 태그 or null (규칙 순서는 설계 §3 그대로) */
export const normalizeTag = (raw: string): string | null => {
  const t = raw
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH);
  return t === '' ? null : t;
};

/** raw 배열 → 정규 태그 배열 (null 제거·중복 제거·최대 3개, 첫 등장 순서 유지) */
export const normalizeTags = (raws: readonly string[]): string[] => {
  const out: string[] = [];
  for (const raw of raws) {
    const tag = normalizeTag(raw);
    if (tag !== null && !out.includes(tag)) out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
};
