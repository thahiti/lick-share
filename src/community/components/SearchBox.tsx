/**
 * 검색 입력 + 실시간 제안 (tag-search 설계 §3~4).
 * 디바운스 300ms · 2자 미만 질의 생략 · 질의 id로 응답 역전 가드.
 * Enter → /search?q=… 전체 결과, 제안 선택 → 해당 릭/유저 직행.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Icon } from '../../ui/components/common/Icon';
import { searchLicks, searchUsers } from '../api/search';
import { navigate } from '../routing';
import { SearchSuggestions, type SearchItem } from './SearchSuggestions';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
const SUGGEST_LIMIT = 5;

interface Props {
  readonly autoFocus?: boolean;
  /** 이동 직후 호출 — 모바일 전체 화면 오버레이가 자신을 닫는 데 쓴다 */
  readonly onNavigated?: () => void;
}

export const SearchBox = ({ autoFocus = false, onNavigated }: Props = {}): JSX.Element => {
  const [q, setQ] = useState('');
  // null = 드롭다운 닫힘 (빈 배열과 구분)
  const [items, setItems] = useState<readonly SearchItem[] | null>(null);
  const [sel, setSel] = useState(-1);
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback((): void => {
    seq.current++; // 진행 중인 질의 응답도 무효화
    setItems(null);
    setSel(-1);
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < MIN_QUERY) return; // 닫기는 onChange가 처리
    const id = ++seq.current;
    const t = setTimeout(() => {
      void Promise.all([searchLicks(text, { limit: SUGGEST_LIMIT }), searchUsers(text, SUGGEST_LIMIT)])
        .then(([licks, users]) => {
          if (seq.current !== id) return; // 늦게 도착한 이전 질의는 버린다
          setItems([
            ...licks.map((l) => ({
              key: 'l:' + l.id,
              label: l.title,
              kind: 'lick' as const,
              to: '/lick/' + l.id,
            })),
            ...users.map((u) => ({
              key: 'u:' + u.public_id,
              label: u.display_name,
              kind: 'user' as const,
              to: '/user/' + u.public_id,
            })),
          ]);
          setSel(-1);
        })
        .catch(() => {
          /* 제안 실패는 조용히 무시 — 드롭다운만 안 뜬다 */
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, close]);

  // 외부 클릭 → 닫힘
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [close]);

  const go = (to: string): void => {
    close();
    navigate(to);
    onNavigated?.();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown' && items?.length) {
      e.preventDefault();
      setSel((s) => (s + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items?.length) {
      e.preventDefault();
      setSel((s) => (s <= 0 ? items.length - 1 : s - 1));
    } else if (e.key === 'Escape') {
      // 드롭다운이 열려 있으면 닫기만 — Chrome의 search input 네이티브 클리어를 막는다.
      // 닫혀 있으면 preventDefault 없이 네이티브 동작(텍스트 클리어)에 맡긴다.
      if (items) {
        e.preventDefault();
        close();
      }
    } else if (e.key === 'Enter') {
      const text = q.trim();
      const picked = sel >= 0 ? items?.[sel] : undefined;
      if (picked) go(picked.to);
      else if (text) go('/search?q=' + encodeURIComponent(text));
    }
  };

  return (
    <div className="c-searchwrap" ref={rootRef}>
      <Icon name="search" color="var(--mut2)" size={16} />
      <input
        className="c-search"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < MIN_QUERY) close();
        }}
        onKeyDown={onKeyDown}
        placeholder="Search licks, tags, users"
        aria-label="Search"
        autoFocus={autoFocus}
      />
      {items && items.length > 0 && <SearchSuggestions items={items} selected={sel} onPick={go} />}
    </div>
  );
};
