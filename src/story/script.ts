import { z } from 'zod';
import raw from '../content/story.uz.json';
import { longestSentenceWords, MAX_WORDS_KICHIK } from '../content/validate';

/**
 * Ertak videolari ssenariysi (src/content/story.uz.json): o'yin boshi (intro) va oxiri (outro).
 * Matn, ovoz va sahna tartibi JSON'da — dvigatel (StoryVideo) faqat effektlarni biladi.
 */
export const INTRO_FX = ['sunny', 'book-glow', 'dev-steals', 'gloomy', 'bobo-calls', 'dev-sorry', 'celebrate'] as const;
export type IntroFx = (typeof INTRO_FX)[number];

export const IntroLineSchema = z.object({
  voice: z.enum(['bobo', 'dev']),
  text: z.string().trim().min(1).max(120),
});
export const IntroSceneSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  bg: z.string().regex(/^img\/[\w/-]+\.webp$/),
  fx: z.enum(INTRO_FX),
  sfx: z.enum(['magic', 'thunder', 'fanfare']).optional(),
  /** Birinchi gapdan oldin kutish (animatsiya boshlanib olsin). */
  leadMs: z.number().int().min(0).max(10000).optional(),
  /** Sahna kamida shuncha davom etadi (animatsiya ulgursin). */
  minMs: z.number().int().min(0).max(15000).optional(),
  lines: z.array(IntroLineSchema).min(1).max(4),
});
export const IntroScriptSchema = z
  .object({ scenes: z.array(IntroSceneSchema).min(2).max(10) })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.scenes.forEach((sc, i) => {
      if (ids.has(sc.id)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'id'], message: `takroriy sahna "${sc.id}"` });
      ids.add(sc.id);
      sc.lines.forEach((l, j) => {
        // video hamma yoshga bir xil — kichiklar qoidasi (gapda 10 tadan kam so'z) hammaga
        if (longestSentenceWords(l.text) > MAX_WORDS_KICHIK)
          ctx.addIssue({ code: 'custom', path: ['scenes', i, 'lines', j], message: `gap juda uzun: "${l.text}"` });
      });
    });
  });
export type IntroLine = z.infer<typeof IntroLineSchema>;
export type IntroScene = z.infer<typeof IntroSceneSchema>;
export type IntroScript = z.infer<typeof IntroScriptSchema>;

export const StoryFileSchema = z.object({ intro: IntroScriptSchema, outro: IntroScriptSchema });
const STORY = StoryFileSchema.parse(raw);
/** O'yin boshidagi ertak: dev kitobni olib ketadi, bobo yordam so'raydi. */
export const INTRO: IntroScript = STORY.intro;
/** O'yin oxiridagi yakun: dev kechirim so'raydi, qishloq bayram qiladi. */
export const OUTRO: IntroScript = STORY.outro;

/** Ovozsiz (yoki fayl yo'q) holatda gap ekranda qancha turadi: o'qishga ulgurilsin. */
export function readingMs(text: string): number {
  return 1100 + text.length * 65;
}

/** Ovoz chiqqanda ham "ended" kelmasa — shuncha kutib keyingisiga o'tiladi (video qotib qolmasin). */
export function safetyMs(text: string): number {
  return readingMs(text) * 2 + 3000;
}

/** Ovoz oldinroq tugasa ham (yoki brauzer ovozni bloklasa) gap kamida shuncha ko'rinadi. */
export function minShowMs(text: string): number {
  return 1000 + text.length * 35;
}

/** Gaplar orasidagi nafas va sahna oxiridagi pauza. */
export const LINE_GAP_MS = 450;
export const SCENE_TAIL_MS = 700;

/** Videoning taxminiy davomiyligi (ovozsiz rejimda) — UI va testlar uchun. */
export function estimateTotalMs(script: IntroScript = INTRO): number {
  return script.scenes.reduce((sum, sc) => {
    const speech = sc.lines.reduce((s, l) => s + readingMs(l.text) + LINE_GAP_MS, 0);
    return sum + Math.max((sc.leadMs ?? 0) + speech, sc.minMs ?? 0) + SCENE_TAIL_MS;
  }, 0);
}
