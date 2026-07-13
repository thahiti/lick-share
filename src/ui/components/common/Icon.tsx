/**
 * 아이콘 (DESIGN §5). 24 viewBox, stroke 1.5, butt/miter. play만 fill.
 */
import type { JSX } from 'react';

const PATHS: Readonly<Record<string, readonly string[]>> = {
  prev: ['M15 5 L8 12 L15 19'],
  next: ['M9 5 L16 12 L9 19'],
  play: ['M8 5.5 L18 12 L8 18.5 Z'],
  pause: ['M8.5 5 V19', 'M15.5 5 V19'],
  plus: ['M12 5 V19', 'M5 12 H19'],
  up: ['M6 15 L12 8.5 L18 15'],
  down: ['M6 9 L12 15.5 L18 9'],
  undo: ['M8.5 13.5 L4 9 L8.5 4.5', 'M4 9 H14.5 a4.7 4.7 0 0 1 0 9.4 H11'],
  redo: ['M15.5 13.5 L20 9 L15.5 4.5', 'M20 9 H9.5 a4.7 4.7 0 0 0 0 9.4 H13'],
  del: [
    'M5 7 H19',
    'M9.5 7 V4.5 H14.5 V7',
    'M6.5 7 L7.6 19.5 H16.4 L17.5 7',
    'M10.3 10.5 V16',
    'M13.7 10.5 V16',
  ],
  share: ['M12 14.5 V3.5', 'M8 7.5 L12 3.5 L16 7.5', 'M5.5 11.5 V20 H18.5 V11.5'],
  metro: ['M9 4 H15 L18.5 20 H5.5 Z', 'M12 16 L16 7', 'M8 12.5 H16'],
  chord: [
    'M4.5 17 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0',
    'M9.7 11.8 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0',
    'M14.9 6.6 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0',
  ],
  // 커뮤니티 데스크톱 셸용 라인 아이콘 (stroke 전용)
  search: ['M11 4 a7 7 0 1 0 0.01 0', 'M16.2 16.2 L20 20'],
  trophy: [
    'M7 4 H17 V9 a5 5 0 0 1 -10 0 Z',
    'M7 5 H4 V6.5 a3 3 0 0 0 3 3',
    'M17 5 H20 V6.5 a3 3 0 0 1 -3 3',
    'M12 14 V17',
    'M9 20 H15',
    'M10 17 H14 V20 H10 Z',
  ],
  fire: ['M12 3 C 14.5 7 17 8.5 17 13 a5 5 0 0 1 -10 0 C 7 10.5 8.5 9.5 8.5 6.5 C 9.8 8 11 8 12 3 Z'],
  folder: ['M4 7 H10 L12 9 H20 V18.5 H4 Z'],
  upload: ['M12 15.5 V4.5', 'M8 8.5 L12 4.5 L16 8.5', 'M5.5 13 V20 H18.5 V13'],
  note: [
    'M9.5 17.5 V5.5 L18 3.5 V15',
    'M6.5 20 a3 2 0 1 0 3 -1.8',
    'M15 17.5 a3 2 0 1 0 3 -1.8',
    'M9.5 8.5 L18 6.5',
  ],
};

export type IconName = keyof typeof PATHS & string;

export interface IconProps {
  readonly name: IconName;
  readonly color?: string;
  readonly size?: number;
}

export const Icon = ({ name, color = 'var(--ink)', size = 14 }: IconProps): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-icon={name}>
    {(PATHS[name] ?? []).map((d) => (
      <path
        key={d}
        d={d}
        fill={name === 'play' ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    ))}
  </svg>
);
