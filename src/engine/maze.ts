/**
 * Sirli labirint mantiqi (sof funksiyalar — UI'siz sinaladi).
 * Xarita satrlari: '#' — devor (buta), '.' — yo'l. Koordinata [x, y], (0,0) — chap yuqori.
 */
export type Cell = readonly [number, number];
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface MazeMap {
  rows: readonly string[];
  start: Cell;
  key: Cell;
  exit: Cell;
  traps: readonly Cell[];
}

export const DIRS: Record<Dir, Cell> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const k = (c: Cell) => `${c[0]},${c[1]}`;

export function isWall(m: Pick<MazeMap, 'rows'>, [x, y]: Cell): boolean {
  const row = m.rows[y];
  return row === undefined || x < 0 || x >= row.length || row[x] !== '.';
}

export function isTrap(m: Pick<MazeMap, 'traps'>, c: Cell): boolean {
  return m.traps.some((t) => same(t, c));
}

/** Eng qisqa yo'l (BFS). avoidTraps — tuzoqlardan aylanib o'tadi. Yo'l bo'lmasa null. */
export function shortestPath(m: MazeMap, from: Cell, to: Cell, avoidTraps = true): Cell[] | null {
  const prev = new Map<string, Cell | null>([[k(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (same(cur, to)) {
      const path: Cell[] = [];
      for (let c: Cell | null = cur; c; c = prev.get(k(c)) ?? null) path.unshift(c);
      return path;
    }
    for (const d of Object.values(DIRS)) {
      const n: Cell = [cur[0] + d[0], cur[1] + d[1]];
      if (prev.has(k(n)) || isWall(m, n) || (avoidTraps && isTrap(m, n) && !same(n, to))) continue;
      prev.set(k(n), cur);
      queue.push(n);
    }
  }
  return null;
}

/** Xarita xatolari (sxema tekshiruvi uchun): bo'sh ro'yxat — xarita to'g'ri va yechimli. */
export function mazeProblems(m: MazeMap): string[] {
  const out: string[] = [];
  const w = m.rows[0]?.length ?? 0;
  if (m.rows.some((r) => r.length !== w)) out.push("labirint satrlari bir xil uzunlikda bo'lishi kerak");
  for (const [name, c] of [['start', m.start], ['key', m.key], ['exit', m.exit]] as const) {
    if (isWall(m, c)) out.push(`${name} devor ichida yoki xaritadan tashqarida`);
    if (isTrap(m, c)) out.push(`${name} tuzoq ustida`);
  }
  m.traps.forEach((t, i) => isWall(m, t) && out.push(`tuzoq ${i + 1} devor ichida`));
  if (out.length) return out;
  if (!shortestPath(m, m.start, m.key)) out.push("boshlanishdan kalitgacha tuzoqsiz yo'l yo'q");
  if (!shortestPath(m, m.key, m.exit)) out.push("kalitdan chiqishgacha tuzoqsiz yo'l yo'q");
  return out;
}

export interface MazeState {
  pos: Cell;
  /** Oxirgi xavfsiz katak — tuzoqqa tushsa shu yerga qaytadi. */
  safe: Cell;
  hasKey: boolean;
  done: boolean;
  mistakes: number;
  steps: number;
}

export type MoveEvent = 'move' | 'wall' | 'key' | 'trap' | 'locked' | 'win' | 'none';

export function initialMaze(m: MazeMap): MazeState {
  return { pos: m.start, safe: m.start, hasKey: false, done: false, mistakes: 0, steps: 0 };
}

/**
 * Bitta qadam. Devorga urilish xato emas (bola shunchaki o'sha tomonga yura olmaydi).
 * Tuzoq: +1 xato, oxirgi xavfsiz katakka qaytadi. Kalitsiz chiqish g'alaba emas.
 */
export function moveMaze(m: MazeMap, s: MazeState, dir: Dir): { state: MazeState; event: MoveEvent } {
  if (s.done) return { state: s, event: 'none' };
  const d = DIRS[dir];
  const n: Cell = [s.pos[0] + d[0], s.pos[1] + d[1]];
  if (isWall(m, n)) return { state: s, event: 'wall' };
  if (isTrap(m, n)) return { state: { ...s, pos: s.safe, mistakes: s.mistakes + 1, steps: s.steps + 1 }, event: 'trap' };
  const base = { ...s, pos: n, safe: n, steps: s.steps + 1 };
  if (!s.hasKey && same(n, m.key)) return { state: { ...base, hasKey: true }, event: 'key' };
  if (same(n, m.exit)) return s.hasKey ? { state: { ...base, done: true }, event: 'win' } : { state: base, event: 'locked' };
  return { state: base, event: 'move' };
}

/** Maslahat: joriy maqsadga (kalit yoki chiqish) tuzoqsiz eng qisqa yo'lning keyingi n qadami. */
export function hintSteps(m: MazeMap, s: MazeState, n = 3): Cell[] {
  const target = s.hasKey ? m.exit : m.key;
  const path = shortestPath(m, s.pos, target);
  return path ? path.slice(1, n + 1) : [];
}

/** Qo'shni katakka bosilsa — qaysi yo'nalish (telefonda katakka tegib yurish uchun). */
export function dirTo(from: Cell, to: Cell): Dir | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
}
