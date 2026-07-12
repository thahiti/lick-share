/**
 * 토스트 (DESIGN §4). 하단 중앙, 1.5초 뒤 onDone.
 */
import { useEffect, type JSX } from 'react';

export interface ToastProps {
  readonly msg: string | null;
  readonly onDone: () => void;
}

export const Toast = ({ msg, onDone }: ToastProps): JSX.Element | null => {
  useEffect(() => {
    if (msg === null) return;
    const id = setTimeout(onDone, 1500);
    return () => clearTimeout(id);
  }, [msg, onDone]);

  if (msg === null) return null;
  return <div className="toast">{msg}</div>;
};
