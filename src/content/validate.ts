import { z } from 'zod';
import {
  BoboDictSchema,
  ItemSchema,
  LevelSchema,
  REST_GAMES,
  TIERS,
  TaskSchema,
  partsOf,
  type BoboDict,
  type Item,
  type Level,
  type Task,
  type Tier,
} from './schema';

export interface ContentBundle {
  levels: Level[];
  items: Item[];
  tasks: Task[];
  bobo: BoboDict;
}

/** Rejadagi jadval: bir bosqichdagi topshiriqlar soni (6-bo'lim). */
export const TASKS_PER_TIER: Record<Tier, number> = { kichik: 3, karvon: 4, olim: 5 };
/** Kichiklar uchun bitta gapda 10 tadan kam so'z (2-bo'lim). */
export const MAX_WORDS_KICHIK = 9;
/** Krossvord so'zlari soni (6-bo'lim jadvali). */
export const CROSSWORD_WORDS: Record<Tier, [number, number]> = { kichik: [4, 5], karvon: [8, 10], olim: [12, 15] };
/** Bir xil mini-o'yin ketma-ket 2 martadan ortiq kelmaydi (5-bo'lim). */
export const MAX_SAME_GAME_IN_ROW = 2;

export function sentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function longestSentenceWords(text: string): number {
  return Math.max(0, ...sentences(text).map(wordCount));
}

/** Tier uchun mavjud topshiriqlar, level.tasks tartibida. */
export function tasksForTier(level: Level, tasks: readonly Task[], tier: Tier): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return level.tasks
    .map((id) => byId.get(id))
    .filter((t): t is Task => t !== undefined && t.tiers[tier] !== undefined);
}

/** Dev jangi: zarbalar soni (jon chizig'i). Rejada: 5 zarba; olim — 7 savol. */
export const BATTLE_HP: Record<Tier, number> = { kichik: 5, karvon: 5, olim: 7 };

type Question = { q: string; options: string[]; answer: number; hint: string };

function checkQuestions(qs: Question[], w: string, tier: Tier): string[] {
  const errors: string[] = [];
  qs.forEach((q, i) => {
    const answer = q.options[q.answer] ?? '';
    // Bobo javobni hech qachon to'g'ridan-to'g'ri aytmaydi.
    const a = normalize(answer);
    // 1-2 belgili javoblar (A, 7, 12) har qanday matnda uchraydi — ularni alohida so'z sifatida qidiramiz.
    const leaks =
      a.length > 2
        ? normalize(q.hint).includes(a)
        : a.length > 0 && q.hint.split(/[\s,.;:!?()"'«»—-]+/).some((t) => normalize(t) === a);
    if (leaks) {
      errors.push(`${w} [${tier}] savol ${i + 1}: maslahat javobni oshkor qilyapti ("${answer}")`);
    }
    if (tier === 'kichik') {
      for (const [field, text] of [['q', q.q], ['hint', q.hint]] as const) {
        if (longestSentenceWords(text) > MAX_WORDS_KICHIK) errors.push(`${w} [kichik] savol ${i + 1}.${field}: gap juda uzun`);
      }
    }
  });
  return errors;
}

const normalize = (s: string) => s.toLocaleLowerCase('uz').replace(/[^\p{L}\p{N}]/gu, '');

/** Parse raw JSON and run every cross-reference and pedagogical rule. Returns a list of human-readable errors. */
export function parseContent(raw: {
  levels: unknown;
  items: unknown;
  tasks: unknown;
  bobo: unknown;
}, knownPictures: readonly string[]): { bundle: ContentBundle | null; errors: string[] } {
  const errors: string[] = [];
  const fmt = (where: string, e: z.ZodError) =>
    e.issues.forEach((i) => errors.push(`${where}${i.path.length ? '.' + i.path.join('.') : ''}: ${i.message}`));

  const levels = z.array(LevelSchema).safeParse(raw.levels);
  const items = z.array(ItemSchema).safeParse(raw.items);
  const tasks = z.array(TaskSchema).safeParse(raw.tasks);
  const bobo = BoboDictSchema.safeParse(raw.bobo);
  if (!levels.success) fmt('levels', levels.error);
  if (!items.success) fmt('items', items.error);
  if (!tasks.success) fmt('tasks', tasks.error);
  if (!bobo.success) fmt('bobo', bobo.error);
  if (!levels.success || !items.success || !tasks.success || !bobo.success) return { bundle: null, errors };

  const bundle: ContentBundle = { levels: levels.data, items: items.data, tasks: tasks.data, bobo: bobo.data };
  errors.push(...checkRules(bundle, knownPictures));
  return { bundle: errors.length ? null : bundle, errors };
}

export function checkRules(b: ContentBundle, knownPictures: readonly string[]): string[] {
  const errors: string[] = [];
  const itemById = new Map(b.items.map((i) => [i.id, i]));
  const taskById = new Map(b.tasks.map((t) => [t.id, t]));

  const dup = <T>(arr: T[]) => arr.filter((v, i) => arr.indexOf(v) !== i);
  dup(b.levels.map((l) => l.id)).forEach((d) => errors.push(`level id takrorlangan: ${d}`));
  dup(b.items.map((l) => l.id)).forEach((d) => errors.push(`item id takrorlangan: ${d}`));
  dup(b.tasks.map((l) => l.id)).forEach((d) => errors.push(`task id takrorlangan: ${d}`));
  for (const it of b.items) dup(it.parts.map((p) => p.id)).forEach((d) => errors.push(`${it.id}: qism takrorlangan ${d}`));

  const orders = b.levels.map((l) => l.order).sort((a, c) => a - c);
  orders.forEach((o, i) => {
    if (o !== i + 1) errors.push(`level order 1..${orders.length} ketma-ket bo'lishi kerak (topildi: ${orders.join(',')})`);
  });

  const boboKey = (key: string, where: string) => {
    if (!(key in b.bobo)) errors.push(`${where}: bobo gapi topilmadi "${key}"`);
  };

  for (const level of b.levels) {
    const w = `level ${level.id}`;
    const reward = itemById.get(level.reward);
    if (!reward) errors.push(`${w}: reward buyumi yo'q "${level.reward}"`);
    if (!itemById.has(level.obstacle.requires)) errors.push(`${w}: obstacle.requires buyumi yo'q "${level.obstacle.requires}"`);
    boboKey(level.intro, w);
    if (level.outro) boboKey(level.outro, w);

    for (const tid of level.tasks) {
      const t = taskById.get(tid);
      if (!t) errors.push(`${w}: topshiriq topilmadi "${tid}"`);
      else if (t.level !== level.id) errors.push(`${w}: ${tid}.level = "${t.level}"`);
    }
    if (level.tasks.length > 0) {
      boboKey(`bobo.${level.id}.obstacle`, w);
      boboKey(`bobo.${level.reward}.won`, w);
    }
    if (level.obstacle.battle) {
      for (const tier of TIERS) {
        const qs = level.obstacle.battle[tier].questions;
        if (qs.length < BATTLE_HP[tier]) errors.push(`${w} [${tier}]: dev jangi uchun kamida ${BATTLE_HP[tier]} savol kerak`);
        errors.push(...checkQuestions(qs, `${w} jang`, tier));
      }
    }
    if (level.tasks.length === 0 || !reward) continue;

    for (const tier of TIERS) {
      const seq = tasksForTier(level, b.tasks, tier);
      const tw = `${w} [${tier}]`;
      if (seq.length !== TASKS_PER_TIER[tier]) {
        errors.push(`${tw}: ${TASKS_PER_TIER[tier]} ta topshiriq kerak, ${seq.length} ta bor`);
      }
      // Every tier must be able to assemble the full item — a weak pupil must be able to finish.
      const given = seq.flatMap(partsOf);
      for (const part of reward.parts) {
        if (!given.includes(part.id)) errors.push(`${tw}: "${part.id}" qismini beradigan topshiriq yo'q`);
      }
      dup(given).forEach((d) => errors.push(`${tw}: "${d}" qismi ikki marta beriladi`));
      // Mixing rule.
      let run = 1;
      for (let i = 1; i < seq.length; i++) {
        run = seq[i]!.game === seq[i - 1]!.game ? run + 1 : 1;
        if (run > MAX_SAME_GAME_IN_ROW) {
          errors.push(`${tw}: "${seq[i]!.game}" ketma-ket ${run} marta keldi (max ${MAX_SAME_GAME_IN_ROW})`);
        }
      }
      if (!seq.some((t) => REST_GAMES.includes(t.game))) errors.push(`${tw}: "dam olish" o'yini yo'q`);
    }
  }

  for (const task of b.tasks) {
    const w = `task ${task.id}`;
    boboKey(task.bobo, w);
    const level = b.levels.find((l) => l.id === task.level);
    if (!level) errors.push(`${w}: level topilmadi "${task.level}"`);
    if (level) {
      const item = itemById.get(level.reward);
      for (const part of partsOf(task)) {
        if (item && !item.parts.some((p) => p.id === part)) {
          errors.push(`${w}: rewardPart "${part}" ${item.id} qismlari ichida yo'q`);
        }
      }
    }
    for (const tier of TIERS) {
      const c = task.tiers[tier] as Record<string, unknown> | undefined;
      if (!c) continue;
      if (task.game === 'riddle') {
        errors.push(...checkQuestions((c as { questions: Question[] }).questions, w, tier));
      }
      if (task.game === 'crossword') {
        const words = (c as { words: { q: string; a: string }[] }).words;
        const [min, max] = CROSSWORD_WORDS[tier];
        if (words.length < min || words.length > max) {
          errors.push(`${w} [${tier}]: krossvordda ${min}-${max} so'z bo'lishi kerak (${words.length} ta)`);
        }
        const answers = words.map((x) => normalize(x.a));
        if (new Set(answers).size !== answers.length) errors.push(`${w} [${tier}]: krossvord javoblari takrorlangan`);
        words.forEach((x, i) => {
          if (normalize(x.q).includes(normalize(x.a))) errors.push(`${w} [${tier}] so'z ${i + 1}: savol javobni o'z ichiga olgan`);
          if (tier === 'kichik' && longestSentenceWords(x.q) > MAX_WORDS_KICHIK) errors.push(`${w} [kichik] so'z ${i + 1}: gap juda uzun`);
        });
      }
      if (tier === 'kichik' && (task.game === 'memory' || task.game === 'sorting')) {
        for (const field of ['hint', 'prompt'] as const) {
          const text = (c as Record<string, unknown>)[field];
          if (typeof text === 'string' && longestSentenceWords(text) > MAX_WORDS_KICHIK) {
            errors.push(`${w} [kichik].${field}: gap juda uzun`);
          }
        }
      }
      if (task.game === 'puzzle') {
        const img = (c as { image: string }).image;
        if (!knownPictures.includes(img)) errors.push(`${w} [${tier}]: rasm topilmadi "${img}"`);
        const pieces = (c as { pieces: number }).pieces;
        if (tier === 'kichik' && pieces > 9) errors.push(`${w} [kichik]: puzzle 4-9 bo'lak bo'lishi kerak`);
      }
    }
  }

  // Bobo gaplari kichiklar ham eshitadi — har bir gap 10 so'zdan kam.
  for (const [key, phrase] of Object.entries(b.bobo)) {
    const lines = Array.isArray(phrase) ? phrase : [phrase];
    for (const line of lines) {
      if (longestSentenceWords(line.text) > MAX_WORDS_KICHIK) errors.push(`bobo ${key}: gap juda uzun "${line.text}"`);
    }
  }
  for (const pool of ['bobo.praise', 'bobo.encourage']) {
    const p = b.bobo[pool];
    if (!Array.isArray(p) || p.length < 3) errors.push(`bobo ${pool}: kamida 3 xil variant kerak`);
  }
  return errors;
}
