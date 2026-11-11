import type { Level } from '../../content/schema';
import { levelStatus, type LevelStatus, type Progress } from '../../engine/progress';

export const MAP_W = 360;
export const MAP_H = 640;

/**
 * Nuqtalar xarita rasmidagi (public/img/xarita.webp) joylarga mos:
 * qishloq (pastda), o'rmon, daryo, cho'l (tuyaning yonida), tog'lar, g'or (o'ng tepada), qal'a (tepada).
 * Xarita rasmi almashtirilsa — shu koordinatalarni yangilang (360x640 tizimida).
 */
const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [230, 580],
  [115, 495],
  [265, 395],
  [200, 265],
  [275, 165],
  [295, 52],
  [165, 62],
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
