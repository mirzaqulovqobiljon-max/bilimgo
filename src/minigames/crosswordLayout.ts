/**
 * Krossvord to'rini avtomatik tuzish. Mazmun muallifi faqat savol va javob yozadi,
 * joylashuvni dvigatel hisoblaydi (kesishishlar ko'p, to'r ixcham bo'lishi afzal).
 */

/** O'zbek lotin yozuvi: O' va G' bitta katak. Apostrof turlari bir xillashtiriladi. */
export function tokenize(word: string): string[] {
  const w = word.toLocaleUpperCase('uz').replace(/[ʻ’`‘]/g, "'").replace(/\s+/g, '');
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i]!;
    if ((ch === 'O' || ch === 'G') && w[i + 1] === "'") {
      out.push(ch + "'");
      i++;
    } else if (ch !== "'") out.push(ch);
  }
  return out;
}

export function sameAnswer(input: string, answer: string): boolean {
  return tokenize(input).join('') === tokenize(answer).join('');
}

export type Dir = 'across' | 'down';

export interface Placement {
  index: number; // words[] dagi indeks
  tokens: string[];
  row: number;
  col: number;
  dir: Dir;
  number: number; // to'rdagi raqam
}

export interface CrosswordGrid {
  rows: number;
  cols: number;
  placements: Placement[];
  /** "r,c" -> harf */
  cells: Map<string, string>;
}

const key = (r: number, c: number) => `${r},${c}`;
const step = (dir: Dir): readonly [number, number] => (dir === 'across' ? [0, 1] : [1, 0]);

function canPlace(cells: Map<string, string>, tokens: string[], row: number, col: number, dir: Dir): number {
  const [dr, dc] = step(dir);
  // so'z oldidan va keyin bo'sh katak bo'lishi kerak
  if (cells.has(key(row - dr, col - dc))) return -1;
  if (cells.has(key(row + dr * tokens.length, col + dc * tokens.length))) return -1;
  let crossings = 0;
  for (let i = 0; i < tokens.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = cells.get(key(r, c));
    if (existing !== undefined) {
      if (existing !== tokens[i]) return -1;
      crossings++;
      continue;
    }
    // yon tomonda harf bo'lmasligi kerak (tasodifiy "so'z" hosil bo'lmasin)
    if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) return -1;
  }
  // butunlay ustma-ust tushish (bir xil yo'nalishdagi so'z ichida) taqiqlanadi
  if (crossings === tokens.length) return -1;
  return crossings;
}

function bounds(cells: Map<string, string>) {
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const k of cells.keys()) {
    const [r, c] = k.split(',').map(Number) as [number, number];
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
  }
  return { minR, minC, maxR, maxC };
}

function write(cells: Map<string, string>, tokens: string[], row: number, col: number, dir: Dir) {
  const [dr, dc] = step(dir);
  tokens.forEach((t, i) => cells.set(key(row + dr * i, col + dc * i), t));
}

export function layoutCrossword(answers: readonly string[]): CrosswordGrid {
  const words = answers.map((a, index) => ({ index, tokens: tokenize(a) }));
  const order = [...words].sort((a, b) => b.tokens.length - a.tokens.length || a.index - b.index);
  const cells = new Map<string, string>();
  const placed: Omit<Placement, 'number'>[] = [];

  for (const w of order) {
    if (placed.length === 0) {
      write(cells, w.tokens, 0, 0, 'across');
      placed.push({ ...w, row: 0, col: 0, dir: 'across' });
      continue;
    }
    let best: { row: number; col: number; dir: Dir; score: number } | null = null;
    for (const p of placed) {
      const dir: Dir = p.dir === 'across' ? 'down' : 'across';
      const [pdr, pdc] = step(p.dir);
      const [dr, dc] = step(dir);
      p.tokens.forEach((pt, pi) => {
        w.tokens.forEach((t, ti) => {
          if (pt !== t) return;
          const row = p.row + pdr * pi - dr * ti;
          const col = p.col + pdc * pi - dc * ti;
          const crossings = canPlace(cells, w.tokens, row, col, dir);
          if (crossings < 1) return;
          // ixchamlik: maydon kichik bo'lsa yaxshi
          const trial = new Map(cells);
          write(trial, w.tokens, row, col, dir);
          const b = bounds(trial);
          const area = (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
          const score = crossings * 1000 - area;
          if (!best || score > best.score) best = { row, col, dir, score };
        });
      });
    }
    if (best) {
      const b: { row: number; col: number; dir: Dir } = best;
      write(cells, w.tokens, b.row, b.col, b.dir);
      placed.push({ ...w, row: b.row, col: b.col, dir: b.dir });
    } else {
      // kesishma topilmadi: pastga alohida qatorga qo'yamiz
      const { minC, maxR } = bounds(cells);
      const row = maxR + 2;
      write(cells, w.tokens, row, minC, 'across');
      placed.push({ ...w, row, col: minC, dir: 'across' });
    }
  }

  const { minR, minC, maxR, maxC } = bounds(cells);
  const norm = new Map<string, string>();
  for (const [k, v] of cells) {
    const [r, c] = k.split(',').map(Number) as [number, number];
    norm.set(key(r - minR, c - minC), v);
  }
  const shifted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  // Raqamlash: o'qish tartibida (yuqoridan pastga, chapdan o'ngga); bir katakdan boshlanganlar bitta raqam.
  const starts = [...new Set(shifted.map((p) => key(p.row, p.col)))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number) as [number, number];
    const [br, bc] = b.split(',').map(Number) as [number, number];
    return ar - br || ac - bc;
  });
  const placements = shifted
    .map((p) => ({ ...p, number: starts.indexOf(key(p.row, p.col)) + 1 }))
    .sort((a, b) => a.number - b.number || (a.dir === 'across' ? -1 : 1));
  return { rows: maxR - minR + 1, cols: maxC - minC + 1, placements, cells: norm };
}

export function wordCells(p: Pick<Placement, 'row' | 'col' | 'dir' | 'tokens'>): string[] {
  const [dr, dc] = step(p.dir);
  return p.tokens.map((_, i) => key(p.row + dr * i, p.col + dc * i));
}
