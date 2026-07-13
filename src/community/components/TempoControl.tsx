/**
 * 템포 컨트롤 (핸드오프 §5, §9). 툴바 안 bpm 표시 + 40~240 조절 팝오버.
 * bpm은 세션 한정이라 저장하지 않는다 — 값 소유는 호출부(LickDetail).
 */
import { useEffect, useRef, useState, type JSX } from 'react';

interface Props {
  readonly bpm: number;
  readonly onChange: (bpm: number) => void;
}

const MIN = 40;
const MAX = 240;
const clamp = (n: number): number => Math.min(MAX, Math.max(MIN, Math.round(n)));

export const TempoControl = ({ bpm, onChange }: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="c-tb-tempo" ref={wrapRef}>
      <button
        type="button"
        className="c-tb-btn c-tb-tempo-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Tempo ${bpm} bpm`}
        onClick={() => setOpen((v) => !v)}
      >
        {bpm} bpm
      </button>
      {open && (
        <div className="c-tb-pop" role="dialog" aria-label="Tempo">
          <button
            type="button"
            className="c-tb-btn"
            aria-label="Slower"
            onClick={() => onChange(clamp(bpm - 5))}
          >
            −
          </button>
          <input
            className="c-tb-range"
            type="range"
            min={MIN}
            max={MAX}
            value={bpm}
            aria-label="Tempo bpm"
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
          />
          <button
            type="button"
            className="c-tb-btn"
            aria-label="Faster"
            onClick={() => onChange(clamp(bpm + 5))}
          >
            +
          </button>
          <span className="c-tb-pop-val">{bpm}</span>
        </div>
      )}
    </div>
  );
};
