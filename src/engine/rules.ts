import type { Tier } from '../content/schema';

/** Sinf -> yosh darajasi (rejadagi 6-bo'lim). */
export function gradeToTier(grade: number): Tier {
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) throw new RangeError(`Sinf 1-11 oralig'ida: ${grade}`);
  if (grade <= 4) return 'kichik';
  if (grade <= 8) return 'karvon';
  return 'olim';
}

export const TIER_LABEL: Record<Tier, string> = {
  kichik: 'Kichik sayyoh',
  karvon: 'Karvonboshi',
  olim: 'Olim',
};

/** Bobo maslahati: kichik — cheksiz, karvon — 3 ta, olim — 1 ta (har bosqichda). */
export const HINTS_PER_LEVEL: Record<Tier, number> = { kichik: Infinity, karvon: 3, olim: 1 };

/** Bitta savolda shuncha xatodan keyin bobo maslahat taklif qiladi. */
export const MISTAKES_BEFORE_HINT = 2;

export const COINS_PER_TASK = 10;

/** Bola shuncha soniya jim tursa, bobo eslatadi. */
export const IDLE_REMINDER_MS = 30_000;

/**
 * Yulduz 1-3. Hech qachon 0 emas: topshiriq bajarildimi — kamida 1 yulduz.
 * `allowance` — "kechiriladigan" xatolar soni (savollar soni yoki puzzle o'lchamiga qarab).
 */
export function starsFor(mistakes: number, allowance: number): 1 | 2 | 3 {
  if (mistakes <= 0) return 3;
  if (mistakes <= Math.max(1, allowance)) return 2;
  return 1;
}
