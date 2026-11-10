import { z } from 'zod';
import type { Item, Level, Task, Tier } from '../content/schema';
import { tasksForTier } from '../content/validate';
import { COINS_PER_TASK, HINTS_PER_LEVEL, gradeToTier } from './rules';

export const PROGRESS_VERSION = 1;

/** Faqat ism va sinf (maktab va sinf kodi 4-bosqichda backend bilan qo'shiladi). */
export const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(30),
  grade: z.number().int().min(1).max(11),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const TaskResultSchema = z.object({
  stars: z.number().int().min(1).max(3),
  plays: z.number().int().min(1),
  bestMistakes: z.number().int().min(0),
  bestTimeMs: z.number().int().min(0).optional(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

export const ProgressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  profile: ProfileSchema.nullable(),
  coins: z.number().int().min(0),
  /** itemId -> yig'ilgan qismlar */
  inventory: z.record(z.array(z.string())),
  /** to'siqni yengib o'tilgan bosqichlar */
  completedLevels: z.array(z.string()),
  tasks: z.record(TaskResultSchema),
  hintsUsed: z.record(z.number().int().min(0)),
  /** Moslashuvchan qiyinlik: -1 osonroq, 0 o'z darajasi, +1 qiyinroq. */
  adaptive: z
    .object({ shift: z.number().int().min(-1).max(1), streak: z.number().int().min(0) })
    .default({ shift: 0, streak: 0 }),
});
export type Progress = z.infer<typeof ProgressSchema>;

export function initialProgress(): Progress {
  return {
    version: PROGRESS_VERSION,
    profile: null,
    coins: 0,
    inventory: {},
    completedLevels: [],
    tasks: {},
    hintsUsed: {},
    adaptive: { shift: 0, streak: 0 },
  };
}

export function setProfile(p: Progress, profile: Profile): Progress {
  return { ...p, profile: ProfileSchema.parse(profile) };
}

export function tierOf(p: Progress): Tier {
  if (!p.profile) throw new Error('Profil yo\'q');
  return gradeToTier(p.profile.grade);
}

export interface TaskOutcome {
  progress: Progress;
  firstTime: boolean;
  starsImproved: boolean;
  newPart: string | null;
  coinsEarned: number;
}

/**
 * Topshiriq natijasini yozadi. Qoidalar:
 * - buyum qismi, tanga va yulduz hech qachon olib qo'yilmaydi (yulduz — eng yaxshisi saqlanadi);
 * - tanga faqat birinchi bajarishda beriladi (qayta o'ynab tanga "dehqonchilik" qilinmasin).
 */
export function recordTask(
  p: Progress,
  task: Task,
  level: Level,
  stars: 1 | 2 | 3,
  mistakes: number,
  timeMs?: number,
): TaskOutcome {
  const prev = p.tasks[task.id];
  const firstTime = !prev;
  const bestTimeMs =
    timeMs === undefined ? prev?.bestTimeMs : prev?.bestTimeMs === undefined ? Math.round(timeMs) : Math.min(prev.bestTimeMs, Math.round(timeMs));
  const result: TaskResult = prev
    ? { stars: Math.max(prev.stars, stars), plays: prev.plays + 1, bestMistakes: Math.min(prev.bestMistakes, mistakes) }
    : { stars, plays: 1, bestMistakes: mistakes };
  if (bestTimeMs !== undefined) result.bestTimeMs = bestTimeMs;

  let inventory = p.inventory;
  let newPart: string | null = null;
  if (task.rewardPart) {
    const have = p.inventory[level.reward] ?? [];
    if (!have.includes(task.rewardPart)) {
      inventory = { ...p.inventory, [level.reward]: [...have, task.rewardPart] };
      newPart = task.rewardPart;
    }
  }
  const coinsEarned = firstTime ? COINS_PER_TASK : 0;
  return {
    progress: {
      ...p,
      inventory,
      tasks: { ...p.tasks, [task.id]: result },
      coins: p.coins + coinsEarned,
      adaptive: nextAdaptive(p.adaptive, mistakes),
    },
    firstTime,
    starsImproved: !!prev && stars > prev.stars,
    newPart,
    coinsEarned,
  };
}

export function partsCollected(p: Progress, item: Item): number {
  const have = p.inventory[item.id] ?? [];
  return item.parts.filter((part) => have.includes(part.id)).length;
}

export function isItemComplete(p: Progress, item: Item): boolean {
  return partsCollected(p, item) === item.parts.length;
}

export type LevelStatus = 'locked' | 'open' | 'soon' | 'done';

export function levelStatus(p: Progress, levels: readonly Level[], level: Level): LevelStatus {
  if (p.completedLevels.includes(level.id)) return 'done';
  const prev = levels.find((l) => l.order === level.order - 1);
  const unlocked = !prev || p.completedLevels.includes(prev.id);
  if (!unlocked) return 'locked';
  return level.tasks.length === 0 ? 'soon' : 'open';
}

/** To'siqni yengish: faqat kerakli buyum to'liq yig'ilgan bo'lsa. */
export function completeLevel(p: Progress, level: Level, items: readonly Item[]): Progress {
  const item = items.find((i) => i.id === level.obstacle.requires);
  if (!item || !isItemComplete(p, item)) throw new Error(`"${level.obstacle.requires}" hali yig'ilmagan`);
  if (p.completedLevels.includes(level.id)) return p;
  return { ...p, completedLevels: [...p.completedLevels, level.id] };
}

export function hintsLeft(p: Progress, levelId: string, tier: Tier): number {
  return Math.max(0, HINTS_PER_LEVEL[tier] - (p.hintsUsed[levelId] ?? 0));
}

/** Maslahat ishlatadi; qolmagan bo'lsa null qaytaradi. */
export function spendHint(p: Progress, levelId: string, tier: Tier): Progress | null {
  if (hintsLeft(p, levelId, tier) <= 0) return null;
  return { ...p, hintsUsed: { ...p.hintsUsed, [levelId]: (p.hintsUsed[levelId] ?? 0) + 1 } };
}

export function totalStars(p: Progress): number {
  return Object.values(p.tasks).reduce((s, t) => s + t.stars, 0);
}

/** Navbatdagi bajarilmagan topshiriq (tavsiya sifatida yoritiladi; bola istalganini tanlashi mumkin). */
export function nextTask(p: Progress, level: Level, tasks: readonly Task[], tier: Tier): Task | null {
  return tasksForTier(level, tasks, tier).find((t) => !p.tasks[t.id]) ?? null;
}

// ---------- Moslashuvchan qiyinlik (rejadagi 6-bo'lim) ----------
export const EASIER_AFTER_MISTAKES = 3;
export const HARDER_AFTER_FLAWLESS = 5;
const TIER_ORDER: Tier[] = ['kichik', 'karvon', 'olim'];

/**
 * 3+ xato -> keyingi topshiriqlar osonroq variantda; xatosiz topshiriq -> o'z darajasiga qaytadi;
 * ketma-ket 5 ta xatosiz -> biroz qiyinroq. Bola bu haqda hech narsa ko'rmaydi (tamg'a yo'q).
 */
export function nextAdaptive(a: Progress['adaptive'], mistakes: number): Progress['adaptive'] {
  if (mistakes >= EASIER_AFTER_MISTAKES) return { shift: Math.max(-1, a.shift - 1), streak: 0 };
  if (mistakes > 0) return { shift: a.shift, streak: 0 };
  if (a.shift < 0) return { shift: 0, streak: 1 };
  const streak = a.streak + 1;
  if (streak >= HARDER_AFTER_FLAWLESS) return { shift: Math.min(1, a.shift + 1), streak: 0 };
  return { shift: a.shift, streak };
}

/** Topshiriq qaysi darajadagi mazmun bilan o'ynalishi kerak (mavjud bo'lmasa — o'z darajasi). */
export function effectiveTier(task: Task, base: Tier, shift: number): Tier {
  const i = Math.min(2, Math.max(0, TIER_ORDER.indexOf(base) + shift));
  const t = TIER_ORDER[i]!;
  return task.tiers[t] !== undefined ? t : base;
}
