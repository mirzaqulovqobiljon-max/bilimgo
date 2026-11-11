import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '../content';
import {
  completeLevel,
  hintsLeft,
  initialProgress,
  isItemComplete,
  levelStatus,
  nextTask,
  partsCollected,
  recordTask,
  setProfile,
  spendHint,
  totalStars,
  type Progress,
} from './progress';
import { gradeToTier, starsFor } from './rules';
import { STORAGE_KEY, createLocalStore } from './storage';
import { pickIndex, scramble, seededRng, shuffle } from './random';

const c = loadContent();
const village = c.levels.find((l) => l.id === 'ona-qishloq')!;
const forest = c.levels.find((l) => l.id === 'ormon')!;
const river = c.levels.find((l) => l.id === 'daryo')!;
const key = c.items.find((i) => i.id === 'kalit')!;
const task = (id: string) => c.tasks.find((t) => t.id === id)!;
const withKid = (grade = 2) => setProfile(initialProgress(), { name: 'Aziza', grade });

function collectKey(p: Progress): Progress {
  for (const id of ['ona-qishloq-01', 'ona-qishloq-02', 'ona-qishloq-03']) p = recordTask(p, task(id), village, 3, 0).progress;
  return p;
}

describe('gradeToTier', () => {
  it.each([
    [1, 'kichik'], [4, 'kichik'], [5, 'karvon'], [8, 'karvon'], [9, 'olim'], [11, 'olim'],
  ] as const)('grade %i -> %s', (g, t) => expect(gradeToTier(g)).toBe(t));
  it('rejects impossible grades', () => {
    expect(() => gradeToTier(0)).toThrow();
    expect(() => gradeToTier(12)).toThrow();
    expect(() => gradeToTier(2.5)).toThrow();
  });
});

describe('starsFor', () => {
  it('3 stars without mistakes, never below 1', () => {
    expect(starsFor(0, 3)).toBe(3);
    expect(starsFor(2, 3)).toBe(2);
    expect(starsFor(4, 3)).toBe(1);
    expect(starsFor(100, 3)).toBe(1);
    expect(starsFor(1, 0)).toBe(2); // allowance at least 1
  });
});

describe('recordTask — nothing is ever taken away', () => {
  it('gives the part and 10 coins the first time', () => {
    const o = recordTask(withKid(), task('ona-qishloq-01'), village, 2, 1);
    expect(o.newParts).toEqual(['dasta']);
    expect(o.coinsEarned).toBe(10);
    expect(o.progress.inventory.kalit).toEqual(['dasta']);
    expect(o.progress.tasks['ona-qishloq-01']).toEqual({ stars: 2, plays: 1, bestMistakes: 1 });
  });

  it('replay keeps best stars, gives no extra coins and no duplicate parts', () => {
    let p = recordTask(withKid(), task('ona-qishloq-01'), village, 3, 0).progress;
    const worse = recordTask(p, task('ona-qishloq-01'), village, 1, 5);
    p = worse.progress;
    expect(p.tasks['ona-qishloq-01']).toEqual({ stars: 3, plays: 2, bestMistakes: 0 });
    expect(p.coins).toBe(10);
    expect(p.inventory.kalit).toEqual(['dasta']);
    expect(worse.newParts).toEqual([]);
    expect(worse.starsImproved).toBe(false);
  });

  it('reports improvement on replay', () => {
    const p = recordTask(withKid(), task('ona-qishloq-02'), village, 1, 9).progress;
    expect(recordTask(p, task('ona-qishloq-02'), village, 3, 0).starsImproved).toBe(true);
  });

  it('bonus tasks give coins/stars but no part', () => {
    const o = recordTask(withKid(6), task('ona-qishloq-04'), village, 3, 0);
    expect(o.newParts).toEqual([]);
    expect(o.coinsEarned).toBe(10);
    expect(o.progress.inventory).toEqual({});
  });

  it('does not mutate the previous state', () => {
    const p = withKid();
    const snapshot = JSON.stringify(p);
    recordTask(p, task('ona-qishloq-01'), village, 3, 0);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('item and level flow', () => {
  it('key is complete only with all 3 parts', () => {
    let p = withKid();
    p = recordTask(p, task('ona-qishloq-01'), village, 3, 0).progress;
    p = recordTask(p, task('ona-qishloq-02'), village, 3, 0).progress;
    expect(partsCollected(p, key)).toBe(2);
    expect(isItemComplete(p, key)).toBe(false);
    expect(() => completeLevel(p, village, c.items)).toThrow(/yig'ilmagan/);
    p = recordTask(p, task('ona-qishloq-03'), village, 3, 0).progress;
    expect(isItemComplete(p, key)).toBe(true);
  });

  it('map: only the first point is open at start; next opens after the gate', () => {
    let p = withKid();
    expect(c.levels.map((l) => levelStatus(p, c.levels, l))).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    p = completeLevel(collectKey(p), village, c.items);
    expect(levelStatus(p, c.levels, village)).toBe('done');
    expect(levelStatus(p, c.levels, forest)).toBe('open');
    expect(levelStatus(p, c.levels, river)).toBe('locked');
  });

  it('completing twice is idempotent', () => {
    const p = completeLevel(collectKey(withKid()), village, c.items);
    expect(completeLevel(p, village, c.items)).toBe(p);
  });

  it('nextTask follows the tier order and returns null when all done', () => {
    let p = withKid(10);
    expect(nextTask(p, village, c.tasks, 'olim')?.id).toBe('ona-qishloq-01');
    for (const id of village.tasks) p = recordTask(p, task(id), village, 2, 1).progress;
    expect(nextTask(p, village, c.tasks, 'olim')).toBeNull();
    expect(totalStars(p)).toBe(village.tasks.length * 2); // 5 asosiy + 1 qo'shimcha (labirint)
  });
});

describe('hints budget', () => {
  it('kichik: unlimited, karvon: 3, olim: 1 per level', () => {
    let p = withKid();
    for (let i = 0; i < 50; i++) p = spendHint(p, village.id, 'kichik')!;
    expect(p).not.toBeNull();
    let k: Progress | null = withKid(6);
    for (let i = 0; i < 3; i++) k = spendHint(k!, village.id, 'karvon');
    expect(hintsLeft(k!, village.id, 'karvon')).toBe(0);
    expect(spendHint(k!, village.id, 'karvon')).toBeNull();
    const o = spendHint(withKid(10), village.id, 'olim')!;
    expect(spendHint(o, village.id, 'olim')).toBeNull();
    expect(hintsLeft(o, forest.id, 'olim')).toBe(1); // har bosqichda alohida
  });
});

describe('storage', () => {
  it('round-trips progress', () => {
    const s = createLocalStore();
    const p = collectKey(withKid());
    s.save(p);
    expect(s.load()).toEqual(p);
  });

  it('starts fresh but backs up corrupted data', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":1, "coins": "ko\'p"');
    const p = createLocalStore().load();
    expect(p).toEqual(initialProgress());
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}:corrupt:`));
    expect(backups).toHaveLength(1);
  });

  it('survives a throwing storage (private mode / quota)', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    } as unknown as Storage;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = createLocalStore(broken);
    expect(s.load()).toEqual(initialProgress());
    expect(() => s.save(withKid())).not.toThrow();
    expect(() => s.reset()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('random helpers', () => {
  it('seeded rng is deterministic', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });

  it.each([4, 9, 16, 25])('scramble(%i) is a permutation that is never solved', (n) => {
    for (let seed = 0; seed < 200; seed++) {
      const o = scramble(n, seededRng(seed));
      expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(o.some((p, i) => p !== i)).toBe(true);
      expect(o.filter((p, i) => p === i).length).toBeLessThanOrEqual(n / 2);
    }
  });

  it('scramble falls back when rng is degenerate', () => {
    expect(scramble(4, () => 0.9999)).not.toEqual([0, 1, 2, 3]);
  });

  it('pickIndex avoids repeating the previous line', () => {
    const rng = seededRng(1);
    let last = -1;
    for (let i = 0; i < 100; i++) {
      const n = pickIndex(4, rng, last);
      expect(n).not.toBe(last);
      last = n;
    }
    expect(pickIndex(1, rng, 0)).toBe(0);
  });
});

describe('moslashuvchan qiyinlik', () => {
  it('3 mistakes -> easier, flawless -> back, 5 flawless -> harder', async () => {
    const { nextAdaptive } = await import('./progress');
    let a = { shift: 0, streak: 0 };
    a = nextAdaptive(a, 3);
    expect(a).toEqual({ shift: -1, streak: 0 });
    a = nextAdaptive(a, 1);
    expect(a.shift).toBe(-1);
    a = nextAdaptive(a, 0);
    expect(a).toEqual({ shift: 0, streak: 1 });
    for (let i = 0; i < 4; i++) a = nextAdaptive(a, 0);
    expect(a).toEqual({ shift: 1, streak: 0 });
    for (let i = 0; i < 10; i++) a = nextAdaptive(a, 0);
    expect(a.shift).toBe(1); // never above +1
    a = nextAdaptive(a, 5);
    expect(a.shift).toBe(0);
  });

  it('effectiveTier falls back to own tier when content is missing', async () => {
    const { effectiveTier } = await import('./progress');
    const t01 = task('ona-qishloq-01'); // all tiers
    const t04 = task('ona-qishloq-04'); // karvon + olim
    expect(effectiveTier(t01, 'karvon', -1)).toBe('kichik');
    expect(effectiveTier(t01, 'karvon', 1)).toBe('olim');
    expect(effectiveTier(t01, 'olim', 1)).toBe('olim');
    expect(effectiveTier(t04, 'karvon', -1)).toBe('karvon');
    expect(effectiveTier(t01, 'kichik', -1)).toBe('kichik');
    expect(effectiveTier(t01, 'kichik', 1)).toBe('kichik'); // kichiklar uchun matn qoidasi
  });

  it('recordTask updates adaptive state and best time', () => {
    let p = withKid(6);
    p = recordTask(p, task('ona-qishloq-01'), village, 1, 4, 30_000).progress;
    expect(p.adaptive.shift).toBe(-1);
    expect(p.tasks['ona-qishloq-01']!.bestTimeMs).toBe(30_000);
    p = recordTask(p, task('ona-qishloq-01'), village, 3, 0, 12_345).progress;
    expect(p.adaptive.shift).toBe(0);
    expect(p.tasks['ona-qishloq-01']!.bestTimeMs).toBe(12_345);
    p = recordTask(p, task('ona-qishloq-01'), village, 3, 0, 50_000).progress;
    expect(p.tasks['ona-qishloq-01']!.bestTimeMs).toBe(12_345);
  });

  it('old saved progress without "adaptive" still loads', () => {
    const old = { version: 1, profile: { name: 'A', grade: 3 }, coins: 10, inventory: {}, completedLevels: [], tasks: {}, hintsUsed: {} };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(createLocalStore().load().adaptive).toEqual({ shift: 0, streak: 0 });
  });
});

describe('soon status', () => {
  it('a level without tasks shows as "soon" once unlocked', () => {
    const p = completeLevel(collectKey(withKid()), village, c.items);
    expect(levelStatus(p, c.levels, { ...forest, tasks: [] })).toBe('soon');
  });
});
