/**
 * 인기 태그 집계 (desktop-community-layout-design §5.1) — 순수 함수.
 * 이미 로드된 피드 행에서 태그 빈도를 세어 상위 N개를 반환한다.
 * 방어 처리: tags 컬럼이 아직 DB에 없을 수 있으므로 tags 필드가 없는 행은 건너뛴다.
 */

/** 집계에 필요한 최소 행 형태 — tags는 선택(컬럼 미적용 대비) */
export interface TaggedRow {
  readonly tags?: readonly string[];
}

export const topTags = (rows: readonly TaggedRow[], limit: number): string[] => {
  // 빈도 + 첫 등장 순서를 함께 기록 (동률 tie-break용)
  const count = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;
  for (const row of rows) {
    if (!Array.isArray(row.tags)) continue;
    for (const tag of row.tags) {
      count.set(tag, (count.get(tag) ?? 0) + 1);
      if (!firstSeen.has(tag)) firstSeen.set(tag, order++);
    }
  }
  return [...count.keys()]
    .sort((a, b) => {
      const byCount = (count.get(b) ?? 0) - (count.get(a) ?? 0);
      return byCount !== 0 ? byCount : (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
    })
    .slice(0, limit);
};
