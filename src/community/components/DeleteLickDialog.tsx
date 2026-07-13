/**
 * 삭제 확인 다이얼로그 (핸드오프 §12). 진입은 오버플로 → Delete lick 하나뿐.
 * 포커스를 가두고(Esc=취소), 확인은 destructive. 삭제 자체는 호출부가 수행한다.
 */
import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react';

interface Props {
  readonly open: boolean;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export const DeleteLickDialog = ({
  open,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props): JSX.Element | null => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 열릴 때 취소 버튼에 포커스
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  // 포커스 트랩: Tab이 다이얼로그 밖으로 나가지 않게 순환. Esc는 취소.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [
      ...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
    ];
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="c-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="c-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="c-dialog-title"
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <h2 className="c-dialog-title" id="c-dialog-title">
          Delete this lick?
        </h2>
        <p className="c-dialog-body">
          This can&apos;t be undone. Anyone with the link will no longer be able to open it.
        </p>
        {error && <p className="c-state">{error}</p>}
        <div className="c-dialog-actions">
          <button
            type="button"
            className="c-like"
            ref={cancelRef}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="c-like c-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
