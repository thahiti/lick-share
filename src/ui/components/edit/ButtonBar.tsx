/**
 * 6버튼줄 (SPEC §3.8). 양끝 선택 버튼은 끝에 도달하면 레드 ＋추가로 전환.
 */
import type { JSX } from 'react';
import type { Song } from '../../../core/types';
import { Icon } from '../common/Icon';

export interface ButtonBarProps {
  readonly song: Song;
  readonly sel: number | null;
  readonly onSelectDir: (dir: 1 | -1) => void;
  readonly onPlayMeasure: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
}

export const ButtonBar = ({
  song,
  sel,
  onSelectDir,
  onPlayMeasure,
  onUndo,
  onRedo,
  onDelete,
}: ButtonBarProps): JSX.Element => {
  const sorted = [...song.notes].sort((a, b) => a.s - b.s);
  const i = sorted.findIndex((n) => n.id === sel);
  const atEnd = sorted.length === 0 || i === sorted.length - 1;
  const atStart = sorted.length > 0 && i === 0 && (sorted[0]?.s ?? 0) > 0;

  return (
    <div className="button-bar">
      <button
        type="button"
        data-btn="prev"
        className={`bb nav${atStart ? ' add' : ''}`}
        onClick={() => onSelectDir(-1)}
      >
        <Icon name={atStart ? 'plus' : 'prev'} color={atStart ? 'var(--red)' : 'var(--ink)'} />
        <span>{atStart ? '추가' : '선택'}</span>
      </button>
      <button type="button" data-btn="play" className="bb pri" onClick={onPlayMeasure}>
        <Icon name="play" color="#fff" />
        <span>마디</span>
      </button>
      <button type="button" data-btn="undo" className="bb" onClick={onUndo}>
        <Icon name="undo" />
        <span>취소</span>
      </button>
      <button type="button" data-btn="redo" className="bb" onClick={onRedo}>
        <Icon name="redo" />
        <span>실행</span>
      </button>
      <button type="button" data-btn="del" className="bb warn" onClick={onDelete}>
        <Icon name="del" color="var(--red)" />
        <span>삭제</span>
      </button>
      <button
        type="button"
        data-btn="next"
        className={`bb nav${atEnd ? ' add' : ''}`}
        onClick={() => onSelectDir(1)}
      >
        <Icon name={atEnd ? 'plus' : 'next'} color={atEnd ? 'var(--red)' : 'var(--ink)'} />
        <span>{atEnd ? '추가' : '선택'}</span>
      </button>
    </div>
  );
};
