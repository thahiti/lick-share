/**
 * 오버플로 메뉴 (핸드오프 §5). 프레임(카드) 레벨의 릭 액션을 담는다.
 * 현재 항목은 작성자용 Delete lick 하나뿐 — Report는 미구현이라 비작성자에겐
 * 버튼 자체를 렌더하지 않는다(빈 메뉴 방지). 항목은 1단으로 평평하다.
 */
import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';

interface Props {
  readonly isOwner: boolean;
  readonly onDelete: () => void;
}

export const OverflowMenu = ({ isOwner, onDelete }: Props): JSX.Element | null => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 열릴 때 첫 항목에 포커스
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  // Report 미구현 → 비작성자에겐 노출할 항목이 없으므로 버튼을 렌더하지 않는다
  const items: { key: string; label: string; danger?: boolean; onClick: () => void }[] = [];
  if (isOwner) items.push({ key: 'delete', label: 'Delete lick', danger: true, onClick: onDelete });
  if (items.length === 0) return null;

  const onMenuKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    const i = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <div className="c-tb-overflow" ref={wrapRef}>
      <button
        type="button"
        className="c-tb-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="c-menu" role="menu" ref={menuRef} onKeyDown={onMenuKey}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={it.danger ? 'c-menu-item danger' : 'c-menu-item'}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
