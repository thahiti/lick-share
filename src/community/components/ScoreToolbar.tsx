/**
 * 악보 툴바 (핸드오프 §5). 프레임 내부 최상단에 붙는다.
 * 좌측 그룹(재생·반복·템포) + spacer + 우측 그룹(오버플로). 데스크톱·모바일 동일 구성.
 * 좌/우 그룹 구조는 나중에 조옮김·다운로드를 다시 넣어도 바뀌지 않도록 유지한다.
 * 재생 상태를 소유하지 않는다 — 오디오 훅의 상태를 받아 표시만 한다.
 */
import type { JSX } from 'react';
import { Icon } from '../../ui/components/common/Icon';
import { TempoControl } from './TempoControl';

interface Props {
  readonly playing: boolean;
  readonly loop: boolean;
  readonly bpm: number;
  readonly onTogglePlay: () => void;
  readonly onToggleLoop: () => void;
  readonly onBpmChange: (bpm: number) => void;
  /** 우측 그룹에 놓일 오버플로 메뉴 (없으면 우측 그룹은 비지만 구조는 유지) */
  readonly overflow?: JSX.Element | null;
}

export const ScoreToolbar = ({
  playing,
  loop,
  bpm,
  onTogglePlay,
  onToggleLoop,
  onBpmChange,
  overflow = null,
}: Props): JSX.Element => (
  <div className="c-toolbar">
    <div className="c-toolbar-left">
      <button
        type="button"
        className="c-tb-btn accent"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={onTogglePlay}
      >
        <Icon name={playing ? 'pause' : 'play'} color="var(--brand-primary-text)" size={16} />
      </button>
      <button
        type="button"
        className={loop ? 'c-tb-btn on' : 'c-tb-btn'}
        aria-label="Loop"
        aria-pressed={loop}
        onClick={onToggleLoop}
      >
        <Icon name="loop" color={loop ? 'var(--brand-primary-text)' : 'var(--ink)'} size={16} />
      </button>
      <TempoControl bpm={bpm} onChange={onBpmChange} />
    </div>
    <div className="c-toolbar-spacer" />
    <div className="c-toolbar-right">{overflow}</div>
  </div>
);
