// 미디어쿼리 구독 훅 (ui 레이어) — 데스크톱/모바일 편집 레이아웃 분기용.
// query는 정적 리터럴 전제 — 마운트 후 query가 바뀌면 change 이벤트 전까지
// 이전 값이 유지된다 (렌더 중 setState 없이 단순함 유지).
import { useEffect, useState } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: { matches: boolean }): void => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};
