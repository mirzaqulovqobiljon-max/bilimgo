import type { Level } from '../../content/schema';
import { levelStatus, type LevelStatus, type Progress } from '../../engine/progress';

export const MAP_W = 360;
export const MAP_H = 640;

/** Yo'l pastdan (ona qishloq) yuqoriga (dev qal'asi) ilonizi bo'lib ko'tariladi. */
const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [90, 575],
  [265, 505],
  [100, 425],
  [260, 345],
  [95, 262],
  [262, 182],
  [180, 82],
];

export const OBSTACLE_ICON: Record<string, string> = {
  gate: '🏡',
  dark: '🌲',
  river: '🌊',
  desert: '🏜️',
  cliff: '⛰️',
  cave: '🕳️',
  castle: '🏰',
};

export interface MapNode {
  id: string;
  order: number;
  title: string;
  icon: string;
  status: LevelStatus;
  x: number;
  y: number;
  /** Karvon hozir turgan nuqta (oxirgi ochiq bosqich). */
  current: boolean;
}

export function buildMapNodes(levels: readonly Level[], progress: Progress): MapNode[] {
  const sorted = [...levels].sort((a, b) => a.order - b.order);
  const nodes = sorted.map((level, i) => {
    const [x, y] = POSITIONS[i] ?? [MAP_W / 2, Math.max(40, MAP_H - 80 * (i + 1))];
    return {
      id: level.id,
      order: level.order,
      title: level.title,
      icon: OBSTACLE_ICON[level.obstacle.type] ?? '❔',
      status: levelStatus(progress, sorted, level),
      x,
      y,
      current: false,
    };
  });
  const lastOpen = [...nodes].reverse().find((n) => n.status !== 'locked');
  if (lastOpen) lastOpen.current = true;
  return nodes;
}

export const STATUS_LABEL: Record<LevelStatus, string> = {
  open: 'ochiq',
  done: "o'tildi",
  locked: 'qulflangan',
  soon: 'tez orada',
};
