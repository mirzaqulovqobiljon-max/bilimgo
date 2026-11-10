import { z } from 'zod';

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
export const LevelSchema = z.object({
  id,
  order: z.number().int().positive(),
  title: z.string().min(1),
  subject: z.string().min(1),
  obstacle: z.object({ type: z.string().min(1), title: z.string().min(1), requires: id }),
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

/** Every game type registers its content schema here; the engine never hardcodes content. */
export const GAME_CONTENT_SCHEMAS = {
  riddle: RiddleContentSchema,
  puzzle: PuzzleContentSchema,
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
    rewardPart: id.optional(), // bonus tasks give only stars/coins
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
