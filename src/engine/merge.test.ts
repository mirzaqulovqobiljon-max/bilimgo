import { describe, expect, it } from 'vitest';
import { mergeProgress, progressKey } from './merge';
import { completeLevel, initialProgress, recordTask, setProfile, totalStars, type Progress } from './progress';
import { loadContent } from '../content';
import { seededRng } from './random';

const c = loadContent();
const village = c.levels[0]!;
const t = (id: string) => c.tasks.find((x) => x.id === id)!;
const kid = () => setProfile(initialProgress(), { name: 'Ali', grade: 3 });

/** Tasodifiy progress: istalgan topshiriqlar, istalgan natijalar. */
function randomProgress(seed: number): Progress {
  const rng = seededRng(seed);
  let p = kid();
  for (let i = 0; i < 12; i++) {
    const task = c.tasks[Math.floor(rng() * c.tasks.length)]!;
    const level = c.levels.find((l) => l.id === task.level)!;
    p = recordTask(p, task, level, (1 + Math.floor(rng() * 3)) as 1 | 2 | 3, Math.floor(rng() * 5), Math.floor(rng() * 90_000)).progress;
  }
  if (rng() > 0.5) p = { ...p, completedLevels: ['ona-qishloq'], hintsUsed: { 'ona-qishloq': Math.floor(rng() * 4) } };
  return p;
}

describe('mergeProgress', () => {
  it('offline device + server: nothing is lost', () => {
    let phone = recordTask(kid(), t('ona-qishloq-01'), village, 2, 1).progress;
    let school = recordTask(kid(), t('ona-qishloq-02'), village, 3, 0).progress;
    school = recordTask(school, t('ona-qishloq-01'), village, 3, 0).progress;
    phone = recordTask(phone, t('ona-qishloq-03'), village, 1, 6).progress;
    const m = mergeProgress(school, phone);
    expect(m.inventory.kalit).toEqual(['dasta', 'halqa', 'tishlar']);
    expect(m.tasks['ona-qishloq-01']!.stars).toBe(3);
    expect(Object.keys(m.tasks)).toHaveLength(3);
    expect(m.coins).toBe(Math.max(phone.coins, school.coins));
    expect(() => completeLevel(m, village, c.items)).not.toThrow(); // kalit to'liq
  });

  it.each(Array.from({ length: 30 }, (_, i) => i))('properties hold for random pair %i', (seed) => {
    const a = randomProgress(seed);
    const b = randomProgress(seed + 1000);
    const ab = mergeProgress(a, b);
    // commutative (adaptive aside), idempotent, associative-ish, monotone
    const strip = (p: Progress) => progressKey({ ...p, adaptive: { shift: 0, streak: 0 } });
    expect(strip(ab)).toBe(strip(mergeProgress(b, a)));
    expect(progressKey(mergeProgress(ab, b))).toBe(progressKey(ab));
    expect(progressKey(mergeProgress(ab, ab))).toBe(progressKey(ab));
    expect(totalStars(ab)).toBeGreaterThanOrEqual(Math.max(totalStars(a), totalStars(b)));
    for (const [id, parts] of Object.entries(a.inventory)) for (const part of parts) expect(ab.inventory[id]).toContain(part);
    for (const id of Object.keys(b.tasks)) expect(ab.tasks[id]!.stars).toBeGreaterThanOrEqual(b.tasks[id]!.stars);
    const c3 = randomProgress(seed + 2000);
    expect(strip(mergeProgress(mergeProgress(a, b), c3))).toBe(strip(mergeProgress(a, mergeProgress(b, c3))));
  });
});
