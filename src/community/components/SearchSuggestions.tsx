/** 검색 제안 목록 (tag-search 설계 §3) — Licks/Users 섹션 렌더 전용. */
import type { JSX } from 'react';

export interface SearchItem {
  readonly key: string;
  readonly label: string;
  readonly kind: 'lick' | 'user';
  readonly to: string;
}

interface Props {
  readonly items: readonly SearchItem[];
  readonly selected: number;
  readonly onPick: (to: string) => void;
}

const SECTIONS = [
  { kind: 'lick', label: 'Licks' },
  { kind: 'user', label: 'Users' },
] as const;

export const SearchSuggestions = ({ items, selected, onPick }: Props): JSX.Element => (
  <div className="c-sugbox" role="listbox" aria-label="Search suggestions">
    {SECTIONS.map(({ kind, label }) => {
      const group = items.filter((i) => i.kind === kind);
      if (group.length === 0) return null;
      return (
        <div key={kind}>
          <div className="c-sug-label">{label}</div>
          {group.map((i) => {
            const idx = items.indexOf(i);
            return (
              <button
                key={i.key}
                type="button"
                role="option"
                aria-selected={idx === selected}
                className={'c-sug' + (idx === selected ? ' sel' : '')}
                onClick={() => onPick(i.to)}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      );
    })}
  </div>
);
