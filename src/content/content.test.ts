/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT, loadContent } from './index';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PICTURE_KEYS, pictureUrl } from './pictures';
import { BOBO_MOODS, OBSTACLE_SCENE, img } from '../assets';
import { isImagePath } from '../components/Icon';
import { EXTRA_GAMES, longestSentenceWords, mainTasksForTier, parseContent, tasksForTier } from './validate';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
type AnyRec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (r: { tasks: AnyRec[] }, id: string) => r.tasks.find((t) => t.id === id)!;
const raw = () => clone(RAW_CONTENT) as { levels: AnyRec[]; items: AnyRec[]; tasks: AnyRec[]; bobo: AnyRec };
const errorsOf = (r: ReturnType<typeof raw>) => parseContent(r, PICTURE_KEYS).errors;

describe('real content', () => {
  it('passes every schema, cross-reference and pedagogical rule', () => {
    expect(errorsOf(raw())).toEqual([]);
    expect(() => loadContent()).not.toThrow();
  });

  it('has 7 levels, all with content, every tier 3/4/5 main tasks (35 asosiy topshiriq saqlangan)', () => {
    const c = loadContent();
    expect(c.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const l of c.levels) {
      expect(mainTasksForTier(l, c.tasks, 'kichik')).toHaveLength(3);
      expect(mainTasksForTier(l, c.tasks, 'karvon')).toHaveLength(4);
      expect(mainTasksForTier(l, c.tasks, 'olim')).toHaveLength(5);
    }
    expect(c.tasks.filter((t) => !t.extra)).toHaveLength(35);
  });

  it('uses all 5 first-version mini-games; dev battle only in the cave', () => {
    const c = loadContent();
    const main = c.tasks.filter((t) => !t.extra);
    expect(new Set(main.map((t) => t.game))).toEqual(new Set(['riddle', 'puzzle', 'crossword', 'memory', 'sorting']));
    expect(c.levels.filter((l) => l.obstacle.battle).map((l) => l.id)).toEqual(['gor']);
  });

  it('adds the 4 new mini-games as extra adventure tasks on the planned levels, for every tier, without parts', () => {
    const c = loadContent();
    const extra = c.tasks.filter((t) => t.extra);
    expect(Object.fromEntries(extra.map((t) => [t.game, t.level]))).toEqual({
      maze: 'ona-qishloq',
      hidden: 'ormon',
      horse: 'qizilqum',
      chest: 'tog',
    });
    expect(extra.map((t) => t.game).sort()).toEqual([...EXTRA_GAMES].sort());
    for (const t of extra) {
      expect(t.rewardPart).toBeUndefined();
      expect(Object.keys(t.tiers).sort()).toEqual(['karvon', 'kichik', 'olim']);
      const lvl = c.levels.find((l) => l.id === t.level)!;
      for (const tier of ['kichik', 'karvon', 'olim'] as const) expect(tasksForTier(lvl, c.tasks, tier).at(-1)!.id).toBe(t.id);
    }
  });

  it('gives 3 / 4 / 5 tasks to kichik / karvon / olim on Ona qishloq (+ labirint)', () => {
    const c = loadContent();
    const lvl = c.levels[0]!;
    expect(mainTasksForTier(lvl, c.tasks, 'kichik')).toHaveLength(3);
    expect(mainTasksForTier(lvl, c.tasks, 'karvon')).toHaveLength(4);
    expect(mainTasksForTier(lvl, c.tasks, 'olim')).toHaveLength(5);
    expect(tasksForTier(lvl, c.tasks, 'kichik')).toHaveLength(4);
  });

  it('every image the game references exists in public/ (items, parts, puzzles, scenes, bobo, dev, map)', () => {
    const c = loadContent();
    const pub = (p: string) => existsSync(join(process.cwd(), 'public', p));
    const refs: string[] = [
      ...c.items.flatMap((i) => [i.icon, ...i.parts.map((p) => p.icon)]).filter(isImagePath),
      ...PICTURE_KEYS.map(pictureUrl),
      ...c.levels.filter((l) => OBSTACLE_SCENE[l.obstacle.type]).flatMap((l) => [true, false].map((o) => img.obstacle(OBSTACLE_SCENE[l.obstacle.type]!, o))),
      ...BOBO_MOODS.map(img.bobo),
      ...(['oddiy', 'zarba', 'kechirim', 'tutun'] as const).map(img.dev),
      img.map, img.caravan, img.cardBack, img.certificate,
    ];
    expect(refs.length).toBeGreaterThan(60);
    expect(refs.filter((r) => !pub(r))).toEqual([]);
    expect(() => pictureUrl('yoq')).toThrow();
  });

  it('all items and parts use images, every obstacle type except battle has a scene', () => {
    const c = loadContent();
    expect(c.items.flatMap((i) => [i.icon, ...i.parts.map((p) => p.icon)]).every(isImagePath)).toBe(true);
    for (const l of c.levels) if (!l.obstacle.battle) expect(OBSTACLE_SCENE[l.obstacle.type]).toBeDefined();
  });
});

describe('validator catches broken content', () => {
  it('unknown task referenced by a level', () => {
    const r = raw();
    r.levels[0]!.tasks.push('ona-qishloq-99');
    expect(errorsOf(r).join('\n')).toMatch(/topshiriq topilmadi "ona-qishloq-99"/);
  });

  it('a tier that cannot assemble the whole key', () => {
    const r = raw();
    delete r.tasks.find((t) => t.id === 'ona-qishloq-03')!.tiers.kichik;
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/\[kichik\]: "halqa" qismini beradigan topshiriq yo'q/);
  });

  it('same mini-game more than twice in a row', () => {
    const r = raw();
    r.levels[0]!.tasks = ['ona-qishloq-01', 'ona-qishloq-02', 'ona-qishloq-03', 'ona-qishloq-04', 'ona-qishloq-05'];
    expect(errorsOf(r).join('\n')).toMatch(/\[olim\]: "riddle" ketma-ket 3 marta/);
  });

  it('missing rest game (puzzle) in a tier', () => {
    const r = raw();
    const p = r.tasks.find((t) => t.id === 'ona-qishloq-02')!;
    p.game = 'riddle';
    p.tiers = { kichik: { questions: [{ q: 'Savol?', options: ['a', 'b'], answer: 0, hint: 'Yordam.' }] } };
    expect(errorsOf(r).join('\n')).toMatch(/\[kichik\]: "dam olish" o'yini yo'q/);
  });

  it('hint that gives away the answer', () => {
    const r = raw();
    T(r, 'ona-qishloq-01').tiers.kichik.questions[0].hint = 'Javob — kalit.';
    expect(errorsOf(r).join('\n')).toMatch(/maslahat javobni oshkor/);
  });

  it('too long sentence for 7-10 year olds', () => {
    const r = raw();
    r.bobo['bobo.welcome'] = { text: 'Bir ikki uch tort besh olti yetti sakkiz toqqiz on.' };
    expect(errorsOf(r).join('\n')).toMatch(/bobo bobo\.welcome: gap juda uzun/);
  });

  it('praise pool with fewer than 3 variants', () => {
    const r = raw();
    r.bobo['bobo.praise'] = [{ text: 'Barakalla!' }];
    expect(errorsOf(r).join('\n')).toMatch(/bobo\.praise: kamida 3 xil/);
  });

  it('answer index outside options and duplicate options', () => {
    const r = raw();
    const q = T(r, 'ona-qishloq-01').tiers.karvon.questions[0];
    q.answer = 9;
    T(r, 'ona-qishloq-01').tiers.karvon.questions[1].options = ['A', 'A'];
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/answer variantlar ichida emas/);
    expect(e).toMatch(/variantlar takrorlangan/);
  });

  it('puzzle with unknown picture', () => {
    const r = raw();
    r.tasks.find((t) => t.id === 'ona-qishloq-02')!.tiers.karvon.image = 'yoq-rasm';
    expect(errorsOf(r).join('\n')).toMatch(/rasm topilmadi "yoq-rasm"/);
  });

  it('puzzle with a non-square piece count (schema error, rules are skipped)', () => {
    const r = raw();
    r.tasks.find((t) => t.id === 'ona-qishloq-02')!.tiers.olim.pieces = 7;
    expect(errorsOf(r).join('\n')).toMatch(/tasks\.\d+\.tiers\.olim\.pieces/);
  });

  it('kichik puzzle bigger than 9 pieces', () => {
    const r = raw();
    r.tasks.find((t) => t.id === 'ona-qishloq-02')!.tiers.kichik.pieces = 16;
    expect(errorsOf(r).join('\n')).toMatch(/\[kichik\]: puzzle 4-9/);
  });

  it('unknown bobo key and unknown reward part', () => {
    const r = raw();
    T(r, 'ona-qishloq-01').bobo = 'bobo.yoq';
    T(r, 'ona-qishloq-01').rewardPart = 'eshkak';
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/bobo gapi topilmadi "bobo.yoq"/);
    expect(e).toMatch(/rewardPart "eshkak"/);
  });
});

describe('sentence length helper', () => {
  it('counts words per sentence, ignoring dashes', () => {
    expect(longestSentenceWords('Sabr tagi — sariq oltin. Yana urin!')).toBe(4);
    expect(longestSentenceWords('')).toBe(0);
  });
});

describe('phase 3 rules', () => {
  it('multi-part rewards: every part must exist; dev battle needs enough questions', () => {
    const r = raw();
    T(r, 'gor-01').rewardPart = ['tig', 'yoq-qism'];
    r.levels.find((l) => l.id === 'gor')!.obstacle.battle.olim.questions.splice(3);
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/rewardPart "yoq-qism"/);
    expect(e).toMatch(/level gor \[olim\]: dev jangi uchun kamida 7 savol/);
  });

  it('short answers are checked as whole words in hints', () => {
    const r = raw();
    const qs = r.levels.find((l) => l.id === 'gor')!.obstacle.battle.kichik.questions;
    qs[0].hint = 'Javob 7 ga teng.';
    expect(errorsOf(r).join('\n')).toMatch(/jang \[kichik\] savol 1: maslahat javobni oshkor/);
  });

  it('each content level needs obstacle and item-won phrases', () => {
    const r = raw();
    delete r.bobo['bobo.tog.obstacle'];
    expect(errorsOf(r).join('\n')).toMatch(/level tog: bobo gapi topilmadi "bobo.tog.obstacle"/);
  });
});

describe('phase 2 game rules', () => {
  const crosswordTask = (tiers: AnyRec) => ({ id: 'ona-qishloq-06', level: 'ona-qishloq', game: 'crossword', title: 'K', bobo: 'bobo.praise', tiers });
  const w = (n: number) => Array.from({ length: n }, (_, i) => ({ q: `Savol ${i}?`, a: 'ABCDEFGHIJKLMNOP'.slice(0, 2) + 'XYZWVUTSRQPONMLK'[i] }));

  it('crossword word count per tier follows the plan table', () => {
    const r = raw();
    r.tasks.push(crosswordTask({ kichik: { words: w(7) }, karvon: { words: w(8) } }));
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/ona-qishloq-06 \[kichik\]: krossvordda 4-5 so'z/);
    expect(e).not.toMatch(/ona-qishloq-06 \[karvon\]: krossvordda/);
  });

  it('crossword clue must not contain its answer', () => {
    const r = raw();
    r.tasks.push(crosswordTask({ kichik: { words: [{ q: 'Bu baliq', a: 'BALIQ' }, ...w(3)] } }));
    expect(errorsOf(r).join('\n')).toMatch(/savol javobni o'z ichiga olgan/);
  });

  it('memory cards must be unique, sorting items unique', () => {
    const r = raw();
    r.tasks.push({ id: 'ona-qishloq-07', level: 'ona-qishloq', game: 'memory', title: 'M', bobo: 'bobo.praise',
      tiers: { kichik: { pairs: [{ a: 'X', b: 'Y' }, { a: 'X', b: 'Z' }], hint: 'Yordam.' } } });
    r.tasks.push({ id: 'ona-qishloq-08', level: 'ona-qishloq', game: 'sorting', title: 'S', bobo: 'bobo.praise',
      tiers: { karvon: { prompt: 'P', items: ['a', 'a', 'b'], topLabel: 't', bottomLabel: 'b', hint: 'h' } } });
    const e = errorsOf(r).join('\n');
    expect(e).toMatch(/kartalar takrorlanmasligi kerak/);
    expect(e).toMatch(/elementlar takrorlangan/);
  });
});

describe("5 ta yangi mini-o'yin rasmlari", () => {
  it("sahnalar va ot yugurishi spraytlari public/img/minigames ichida bor (PWA keshiga kiradi)", () => {
    const files = [
      'labirint/sahna.webp',
      'yashirin/sahna.webp',
      'sandiq/sahna.webp',
      'jang/sahna.webp',
      'ot/ot.webp',
      'ot/xoda.webp',
      'ot/yulduz.webp',
      'ot/fon.webp',
      'ot/yer.webp',
    ];
    for (const f of files) expect(existsSync(join(process.cwd(), 'public/img/minigames', f)), f).toBe(true);
    const c = loadContent();
    for (const t of c.tasks.filter((x) => x.game === 'hidden'))
      for (const v of Object.values(t.tiers)) expect(existsSync(join(process.cwd(), 'public/img', (v as { scene: string }).scene))).toBe(true);
  });
});
