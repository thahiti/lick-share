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
