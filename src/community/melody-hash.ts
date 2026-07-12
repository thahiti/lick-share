import type { Note } from '../core/types';

/**
 * 멜로디 정규화 토큰: [첫 음 대비 피치 간격, 첫 음 대비 시작 오프셋, 길이].
 * - 피치 델타 → 조옮김·옥타브 이동 불변 (설계 §5.1)
 * - 시작 오프셋이 음 사이 갭(쉼표) 위치·길이를 보존, 첫 음 이전 무음은 제외
 * - 템포·코드·조성·제목·마디 수는 직렬화에 넣지 않는다 — 이것이 §5.1의 구현
 */
export function melodyTokens(notes: readonly Note[]): number[][] {
  const sorted = [...notes].sort((a, b) => a.s - b.s);
  const first = sorted[0];
  if (!first) return [];
  return sorted.map((n) => [n.p - first.p, n.s - first.s, n.d]);
}

export async function melodyHash(notes: readonly Note[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(melodyTokens(notes)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
