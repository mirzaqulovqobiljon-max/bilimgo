import { z } from 'zod';
import { mazeProblems } from '../engine/maze';
import { chestProblems } from '../engine/chest';

/** Yosh darajalari: Kichik sayyoh (1-4 sinf), Karvonboshi (5-8), Olim (9-11). */
export const TIERS = ['kichik', 'karvon', 'olim'] as const;
export const TierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof TierSchema>;

const id = z.string().regex(/^[a-z0-9-]+$/, 'id faqat kichik lotin harf, raqam va "-"');
const boboKey = z.string().regex(/^bobo\.[a-z0-9.-]+$/, 'bobo kaliti "bobo." bilan boshlanadi');

// ---------- Items ----------
export const ItemSchema = z.object({
  id,
  name: z.string().min(1),
  icon: z.string().min(1), // emoji in prototype; later a path like "items/kalit.png"
  parts: z
    .array(z.object({ id, name: z.string().min(1), icon: z.string().min(1) }))
    .min(1),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------- Levels ----------
// (RiddleQuestionSchema pastda e'lon qilingan — dev jangi savollari uchun lazy)
const BattleSchema = z.lazy(() =>
  z.object({
    kichik: z.object({ questions: z.array(RiddleQuestionSchema).min(1) }),
    karvon: z.object({ questions: z.array(RiddleQuestionSchema).min(1) }),
    olim: z.object({ questions: z.array(RiddleQuestionSchema).min(1) }),
  }),
);
export const LevelSchema = z.object({
  id,
  order: z.number().int().positive(),
  title: z.string().min(1),
  subject: z.string().min(1),
  obstacle: z.object({
    type: z.string().min(1),
    title: z.string().min(1),
    requires: id,
    /** Bo'lsa — to'siq buyumni sudrash emas, dev bilan savol-javob jangi. */
    battle: BattleSchema.optional(),
  }),
  reward: id,
  intro: boboKey,
  outro: boboKey.optional(),
  tasks: z.array(id), // empty = "tez orada" (content not written yet)
});
export type Level = z.infer<typeof LevelSchema>;

// ---------- Mini-game content (per game type) ----------
export const RiddleQuestionSchema = z
  .object({
    q: z.string().min(1),
    picture: z.string().optional(), // emoji or image path, important for readers aged 7
    options: z.array(z.string().min(1)).min(2).max(4),
    answer: z.number().int().nonnegative(),
    hint: z.string().min(1),
  })
  .refine((v) => v.answer < v.options.length, { message: 'answer variantlar ichida emas' })
  .refine((v) => new Set(v.options).size === v.options.length, { message: 'variantlar takrorlangan' });
export type RiddleQuestion = z.infer<typeof RiddleQuestionSchema>;

export const RiddleContentSchema = z.object({ questions: z.array(RiddleQuestionSchema).min(1) });
export type RiddleContent = z.infer<typeof RiddleContentSchema>;

export const PUZZLE_SIZES = [4, 9, 16, 25] as const;
export const PuzzleContentSchema = z.object({
  image: z.string().min(1), // key in the picture registry
  pieces: z.union([z.literal(4), z.literal(9), z.literal(16), z.literal(25)]),
  caption: z.string().min(1),
});
export type PuzzleContent = z.infer<typeof PuzzleContentSchema>;

// Krossvord: javob bitta so'z (bo'shliqsiz). O' va G' bitta katak.
export const CrosswordContentSchema = z.object({
  words: z
    .array(
      z.object({
        q: z.string().min(1),
        a: z.string().regex(/^[A-Za-zʻ'’`]+$/u, "javob bitta so'z bo'lishi kerak (lotin harflari)").min(2),
        picture: z.string().optional(),
      }),
    )
    .min(2)
    .max(15),
});
export type CrosswordContent = z.infer<typeof CrosswordContentSchema>;

// Xotira kartalari: a <-> b juftlar (masalan hayvon <-> uyi, so'z <-> tarjima).
export const MemoryContentSchema = z
  .object({
    pairs: z.array(z.object({ a: z.string().min(1), b: z.string().min(1) })).min(2).max(10),
    hint: z.string().min(1),
  })
  .refine((v) => new Set(v.pairs.flatMap((p) => [p.a, p.b])).size === v.pairs.length * 2, {
    message: 'kartalar takrorlanmasligi kerak',
  });
export type MemoryContent = z.infer<typeof MemoryContentSchema>;

// Tartiblash: items to'g'ri tartibda yoziladi, o'yin ularni aralashtiradi.
export const SortingContentSchema = z
  .object({
    prompt: z.string().min(1),
    items: z.array(z.string().min(1)).min(3).max(8),
    topLabel: z.string().min(1),
    bottomLabel: z.string().min(1),
    hint: z.string().min(1),
  })
  .refine((v) => new Set(v.items).size === v.items.length, { message: 'elementlar takrorlangan' });
export type SortingContent = z.infer<typeof SortingContentSchema>;

// ---------- 5 ta yangi mini-o'yin (texnik topshiriq v1.0, 11.11.2026) ----------
const CellSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

/** Sirli labirint: '#' — devor, '.' — yo'l; koordinata [x, y]. Yechimsiz xarita sxemadan o'tmaydi. */
export const MazeContentSchema = z
  .object({
    rows: z.array(z.string().regex(/^[#.]+$/, "faqat '#' va '.'")).min(5).max(25),
    start: CellSchema,
    key: CellSchema,
    exit: CellSchema,
    traps: z.array(CellSchema).max(8).default([]),
    hint: z.string().min(1),
  })
  .superRefine((m, ctx) => {
    for (const message of mazeProblems(m)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });
export type MazeContent = z.infer<typeof MazeContentSchema>;

/** Yashirin buyumlar: koordinatalar rasmga nisbatan 0..1 (ekran o'lchamidan mustaqil). */
const HiddenTargetSchema = z
  .object({
    id,
    label: z.string().min(1),
    icon: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .refine((t) => t.x + t.w <= 1.0001 && t.y + t.h <= 1.0001, { message: 'nishon rasmdan chiqib ketgan' });
export const HiddenContentSchema = z
  .object({
    scene: z.string().regex(/^minigames\/[a-z0-9/-]+\.webp$/),
    targets: z.array(HiddenTargetSchema).min(3).max(12),
    hint: z.string().min(1),
  })
  .refine((c) => new Set(c.targets.map((t) => t.id)).size === c.targets.length, { message: 'nishon id takrorlangan' });
export type HiddenContent = z.infer<typeof HiddenContentSchema>;

/** Ot bilan to'siqlar: trek — to'siqlar ketma-ketligi ("ikki" — ketma-ket ikki to'siq). */
export const HorseContentSchema = z.object({
  track: z.array(z.enum(['past', 'baland', 'ikki'])).min(3).max(15),
  hint: z.string().min(1),
});
export type HorseContent = z.infer<typeof HorseContentSchema>;

/** Sehrli sandiq: har jumboq kodning bitta raqamini beradi; arifmetik misollar avtomatik tekshiriladi. */
export const ChestContentSchema = z
  .object({
    puzzles: z
      .array(z.object({ q: z.string().min(1), answer: z.number().int().min(0).max(9), hint: z.string().min(1) }))
      .min(3)
      .max(5),
  })
  .superRefine((c, ctx) => {
    for (const message of chestProblems(c.puzzles)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });
export type ChestContent = z.infer<typeof ChestContentSchema>;

/** Every game type registers its content schema here; the engine never hardcodes content. */
export const GAME_CONTENT_SCHEMAS = {
  riddle: RiddleContentSchema,
  puzzle: PuzzleContentSchema,
  crossword: CrosswordContentSchema,
  memory: MemoryContentSchema,
  sorting: SortingContentSchema,
  maze: MazeContentSchema,
  hidden: HiddenContentSchema,
  horse: HorseContentSchema,
  chest: ChestContentSchema,
} as const;
export type GameType = keyof typeof GAME_CONTENT_SCHEMAS;
export const GAME_TYPES = Object.keys(GAME_CONTENT_SCHEMAS) as GameType[];

/** "Dam olish" o'yinlari — rejaga ko'ra har bosqichda kamida bittasi bo'lishi shart. */
export const REST_GAMES: readonly GameType[] = ['puzzle'];

// ---------- Tasks ----------
const TierMapSchema = z
  .object({ kichik: z.unknown(), karvon: z.unknown(), olim: z.unknown() })
  .partial();

export const TaskSchema = z
  .object({
    id,
    level: id,
    game: z.enum(GAME_TYPES as [GameType, ...GameType[]]),
    title: z.string().min(1),
    // bitta qism yoki bir nechta (qilich-qalqon 6 qism, kichiklarda 3 topshiriq); yo'q — bonus topshiriq
    rewardPart: z.union([id, z.array(id).min(1)]).optional(),
    /**
     * Qo'shimcha sarguzasht o'yini (5 ta yangi mini-o'yin): asosiy 3/4/5 topshiriq hisobiga kirmaydi,
     * qism bermaydi — faqat yulduz va birinchi g'alabadagi tanga (mavjud recordTask orqali).
     */
    extra: z.boolean().optional(),
    bobo: boboKey,
    tiers: TierMapSchema,
  })
  .superRefine((task, ctx) => {
    const schema = GAME_CONTENT_SCHEMAS[task.game];
    const tiersPresent = TIERS.filter((t) => task.tiers[t] !== undefined);
    if (tiersPresent.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'kamida bitta tier kerak', path: ['tiers'] });
    }
    for (const t of tiersPresent) {
      const r = schema.safeParse(task.tiers[t]);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['tiers', t, ...issue.path] });
        }
      }
    }
  });
export type Task = z.infer<typeof TaskSchema>;

// ---------- Bobo phrases ----------
const LineSchema = z.object({ text: z.string().min(1), audio: z.string().optional() });
export type BoboLine = z.infer<typeof LineSchema>;
/** One fixed line, or a pool of variants (praise/encouragement must not repeat — rejaga ko'ra 3-4 xil). */
export const BoboPhraseSchema = z.union([LineSchema, z.array(LineSchema).min(1)]);
export const BoboDictSchema = z.record(boboKey, BoboPhraseSchema);
export type BoboDict = z.infer<typeof BoboDictSchema>;

// ---------- Typed content bundle ----------
export type RiddleTask = Task & { game: 'riddle' };
export type PuzzleTask = Task & { game: 'puzzle' };
export type GameContent<G extends GameType> = z.infer<(typeof GAME_CONTENT_SCHEMAS)[G]>;

/** Topshiriq beradigan qismlar ro'yxati. */
export function partsOf(task: Pick<Task, 'rewardPart'>): string[] {
  if (!task.rewardPart) return [];
  return Array.isArray(task.rewardPart) ? task.rewardPart : [task.rewardPart];
}
