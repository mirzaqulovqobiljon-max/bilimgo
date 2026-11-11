import { describe, expect, it } from 'vitest';
import { content } from '../test/utils';
import { dirTo, hintSteps, initialMaze, mazeProblems, moveMaze, shortestPath, type Cell, type MazeMap } from './maze';
import { chestProblems, correctDigits, evalArithmetic, spin } from './chest';
import {
  HORSE_X,
  TUNING,
  idealLead,
  initialRunner,
  jump,
  nextObstacle,
  stepRunner,
  type ObstacleKind,
  type RunnerState,
  type RunnerTier,
} from './runner';
import type { ChestContent, HorseContent, MazeContent } from '../content/schema';

const TIERS = ['kichik', 'karvon', 'olim'] as const;
const task = (game: string) => content.tasks.find((t) => t.game === game)!;

// ---------------- Sirli labirint ----------------
function walk(m: MazeMap, path: Cell[]) {
  let s = initialMaze(m);
  const events: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const r = moveMaze(m, s, dirTo(path[i - 1]!, path[i]!)!);
    s = r.state;
    events.push(r.event);
  }
  return { s, events };
}

describe('Sirli labirint', () => {
  it.each(TIERS)('%s: xarita (texnik topshiriq JSON) boshidan oxirigacha o\'tiladi: avval kalit, keyin chiqish', (tier) => {
    const m = task('maze').tiers[tier] as MazeContent;
    expect(mazeProblems(m)).toEqual([]);
    const toKey = shortestPath(m, m.start, m.key)!;
    const toExit = shortestPath(m, m.key, m.exit)!;
    const { s, events } = walk(m, [...toKey, ...toExit.slice(1)]);
    expect(events).toContain('key');
    expect(events.at(-1)).toBe('win');
    expect(s).toMatchObject({ done: true, hasKey: true, mistakes: 0 });
  });

  it('o\'lchamlar va tuzoqlar darajaga mos: 9/13/17, 0/2/4', () => {
    const t = task('maze');
    expect(TIERS.map((k) => (t.tiers[k] as MazeContent).rows.length)).toEqual([9, 13, 17]);
    expect(TIERS.map((k) => (t.tiers[k] as MazeContent).traps.length)).toEqual([0, 2, 4]);
  });

  const mini: MazeMap = { rows: ['#####', '#...#', '#.#.#', '#...#', '#####'], start: [1, 1], key: [3, 3], exit: [3, 1], traps: [[2, 1]] };

  it('kalitsiz chiqish g\'alaba emas; devor xato emas; tuzoq +1 va xavfsiz katakka qaytaradi', () => {
    let s = initialMaze(mini);
    let r = moveMaze(mini, s, 'up');
    expect(r.event).toBe('wall');
    expect(r.state.mistakes).toBe(0);
    r = moveMaze(mini, s, 'right'); // tuzoq
    expect(r.event).toBe('trap');
    expect(r.state).toMatchObject({ pos: [1, 1], mistakes: 1 });
    // pastdan aylanib, kalitsiz chiqishga
    s = walk(mini, [[1, 1], [1, 2], [1, 3], [2, 3], [3, 3]]).s;
    expect(s.hasKey).toBe(true);
    const noKey = { ...initialMaze(mini), pos: [3, 2] as Cell };
    expect(moveMaze(mini, noKey, 'up')).toMatchObject({ event: 'locked', state: { done: false } });
    expect(moveMaze(mini, { ...s }, 'up').state.done).toBe(false);
    const fin = moveMaze(mini, moveMaze(mini, s, 'up').state, 'up');
    expect(fin.event).toBe('win');
  });

  it('maslahat keyingi 3 xavfsiz qadamni ko\'rsatadi (tuzoqdan aylanib)', () => {
    const steps = hintSteps(mini, initialMaze(mini), 3);
    expect(steps).toEqual([[1, 2], [1, 3], [2, 3]]);
    expect(steps.some((c) => c[0] === 2 && c[1] === 1)).toBe(false);
  });

  it('yechimsiz yoki noto\'g\'ri xarita sxemadan o\'tmaydi', () => {
    expect(mazeProblems({ ...mini, rows: ['#####', '#.#.#', '#####', '#...#', '#####'] }).length).toBeGreaterThan(0);
    expect(mazeProblems({ ...mini, start: [0, 0] })).toContain('start devor ichida yoki xaritadan tashqarida');
    expect(mazeProblems({ ...mini, traps: [[1, 2], [2, 1]] })).toContain("boshlanishdan kalitgacha tuzoqsiz yo'l yo'q");
  });
});

// ---------------- Sehrli sandiq ----------------
describe('Sehrli sandiq', () => {
  it('arifmetikani to\'g\'ri hisoblaydi (ko\'paytirish ustuvor)', () => {
    expect(evalArithmetic('4 + 3 = ?')).toBe(7);
    expect(evalArithmetic('15 − 7 = ?')).toBe(8);
    expect(evalArithmetic('6 × 7 − 40 = ?')).toBe(2);
    expect(evalArithmetic('2 + 2 × 3 = ?')).toBe(8);
    expect(evalArithmetic('45 : 9 = ?')).toBe(5);
    expect(evalArithmetic('Uchburchakning nechta burchagi bor?')).toBeNull();
  });

  it.each(TIERS)('%s: kod uzunligi darajaga mos (3/4/5), har jumboq yagona raqam', (tier) => {
    const c = task('chest').tiers[tier] as ChestContent;
    expect(c.puzzles).toHaveLength({ kichik: 3, karvon: 4, olim: 5 }[tier]);
    expect(chestProblems(c.puzzles)).toEqual([]);
    expect(correctDigits(c.puzzles.map((p) => p.answer), c.puzzles)).toBe(c.puzzles.length);
  });

  it('0 bilan boshlanuvchi kod ham to\'g\'ri ishlaydi (olim: 0 _ _ _ _)', () => {
    const c = task('chest').tiers.olim as ChestContent;
    expect(c.puzzles[0]!.answer).toBe(0);
    const code = c.puzzles.map((p) => p.answer);
    expect(correctDigits(code, c.puzzles)).toBe(5);
    expect(correctDigits([1, ...code.slice(1)], c.puzzles)).toBe(4);
  });

  it('noto\'g\'ri javob va diapazondan tashqari raqam aniqlanadi', () => {
    expect(chestProblems([{ q: '3 + 3 = ?', answer: 5, hint: 'sana' }])[0]).toMatch(/natijasi 6/);
    expect(chestProblems([{ q: 'Savol', answer: 12, hint: 'x' }])[0]).toMatch(/0–9/);
    expect(chestProblems([{ q: '2 + 2 = ?', answer: 4, hint: '2 + 2 = 4' }])[0]).toMatch(/oshkor/);
  });

  it('g\'ildirak 9 dan 0 ga va 0 dan 9 ga aylanadi', () => {
    expect(spin(9, 1)).toBe(0);
    expect(spin(0, -1)).toBe(9);
  });
});

// ---------------- Ot bilan to'siqlar ----------------
function autoRun(tier: RunnerTier, track: ObstacleKind[], opts: { dt?: number; offset?: number; practice?: boolean; jumpAt?: (s: RunnerState) => boolean } = {}) {
  const dt = opts.dt ?? 1 / 60;
  const lead = idealLead(tier) + (opts.offset ?? 0);
  let s = initialRunner(track, tier, opts.practice ?? false);
  let jumped = -1;
  const events: string[] = [];
  for (let i = 0; i < 20000 && !s.done; i++) {
    const o = nextObstacle(s);
    const should = opts.jumpAt ? opts.jumpAt(s) : o && o.id !== jumped && o.x - HORSE_X <= lead;
    if (s.practiceWaiting || (should && s.y === 0 && s.t >= s.stunUntil)) {
      const r = jump(s);
      s = r.state;
      if (r.event) {
        events.push(r.event);
        if (o) jumped = o.id;
      }
    }
    const r = stepRunner(s, dt, tier);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

describe("Ot bilan to'siqlar", () => {
  it.each(TIERS)('%s: to\'g\'ri vaqtda sakrasa — xatosiz marraga yetadi', (tier) => {
    const c = task('horse').tiers[tier] as HorseContent;
    const { s, events } = autoRun(tier, c.track);
    expect(s.done).toBe(true);
    expect(s.mistakes).toBe(0);
    expect(events.filter((e) => e === 'pass')).toHaveLength(s.obstacles.length);
  });

  it("to'siqlar soni darajaga mos: 5 / 8 / 12", () => {
    const t = task('horse');
    expect(TIERS.map((k) => initialRunner((t.tiers[k] as HorseContent).track, k, false).obstacles.length)).toEqual([5, 8, 12]);
  });

  it.each(TIERS)('%s: natija kadr tezligiga bog\'liq emas (30 va 60 FPS)', (tier) => {
    const c = task('horse').tiers[tier] as HorseContent;
    expect(autoRun(tier, c.track, { dt: 1 / 30 }).s.mistakes).toBe(0);
    expect(autoRun(tier, c.track, { dt: 1 / 60 }).s.mistakes).toBe(0);
  });

  it('sakrash oynasi: kichiklarda eng keng (vaqt bo\'yicha, soniya)', () => {
    const window = (tier: RunnerTier, kind: 'past' | 'baland') => {
      const ok: number[] = [];
      for (let off = -3; off <= 3; off += 0.05) if (autoRun(tier, [kind], { offset: off }).s.mistakes === 0) ok.push(off);
      return (Math.max(...ok) - Math.min(...ok)) / TUNING[tier].speed;
    };
    const k = window('kichik', 'past');
    expect(k).toBeGreaterThan(0.35); // o'lchangan ~0.39 s; karvon/olim baland ~0.25-0.3 s
    expect(window('karvon', 'baland')).toBeGreaterThan(0.2);
    expect(window('olim', 'baland')).toBeGreaterThan(0.2);
  });

  it("sakramasa: +1 xato, chekpoint — o'sha to'siq yana oldinda, ot yerda", () => {
    let s = initialRunner(['past', 'past'], 'karvon', false);
    let hit = false;
    for (let i = 0; i < 2000 && !hit; i++) {
      const r = stepRunner(s, 1 / 60, 'karvon');
      s = r.state;
      hit = r.events.includes('hit');
    }
    expect(hit).toBe(true);
    expect(s.mistakes).toBe(1);
    expect(nextObstacle(s)!.x).toBeCloseTo(HORSE_X + 7, 5);
    expect(s.y).toBe(0);
  });

  it('mashq: birinchi to\'siq oldida to\'xtab, sakrashni kutadi', () => {
    let s = initialRunner(['past'], 'kichik', true);
    for (let i = 0; i < 2000 && !s.practiceWaiting; i++) s = stepRunner(s, 1 / 60, 'kichik').state;
    expect(s.practiceWaiting).toBe(true);
    const frozen = stepRunner(s, 1, 'kichik').state;
    expect(frozen).toBe(s);
    const r = jump(s);
    expect(r.event).toBe('jump');
    expect(r.state.practiceWaiting).toBe(false);
  });

  it("havoda bosilgan sakrash yerga tushishi bilan bajariladi (ketma-ket to'siqlar uchun)", () => {
    let s = jump(initialRunner(['past'], 'olim', false)).state;
    for (let i = 0; i < 40; i++) s = stepRunner(s, 1 / 60, 'olim').state; // havoda
    expect(s.y).toBeGreaterThan(0);
    s = jump(s).state;
    let again = false;
    for (let i = 0; i < 60 && !again; i++) {
      const r = stepRunner(s, 1 / 60, 'olim');
      s = r.state;
      again = r.events.includes('jump');
    }
    expect(again).toBe(true);
  });
});
