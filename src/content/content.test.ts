import { describe, expect, it } from 'vitest';
import { RAW_CONTENT, loadContent } from './index';
import { PICTURE_KEYS, pictureUrl } from './pictures';
import { longestSentenceWords, parseContent, tasksForTier } from './validate';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
type AnyRec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const raw = () => clone(RAW_CONTENT) as { levels: AnyRec[]; items: AnyRec[]; tasks: AnyRec[]; bobo: AnyRec };
const errorsOf = (r: ReturnType<typeof raw>) => parseContent(r, PICTURE_KEYS).errors;

describe('real content', () => {
  it('passes every schema, cross-reference and pedagogical rule', () => {
    expect(errorsOf(raw())).toEqual([]);
    expect(() => loadContent()).not.toThrow();
  });

  it('has 7 levels and only the first one has content in the prototype', () => {
    const c = loadContent();
    expect(c.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(c.levels.filter((l) => l.tasks.length > 0).map((l) => l.id)).toEqual(['ona-qishloq']);
  });

  it('gives 3 / 4 / 5 tasks to kichik / karvon / olim on Ona qishloq', () => {
    const c = loadContent();
    const lvl = c.levels[0]!;
    expect(tasksForTier(lvl, c.tasks, 'kichik')).toHaveLength(3);
    expect(tasksForTier(lvl, c.tasks, 'karvon')).toHaveLength(4);
    expect(tasksForTier(lvl, c.tasks, 'olim')).toHaveLength(5);
  });

  it('renders puzzle pictures as data URLs', () => {
    expect(pictureUrl('qishloq-darvoza')).toMatch(/^data:image\/svg\+xml/);
    expect(() => pictureUrl('yoq')).toThrow();
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
    r.tasks[0]!.tiers.kichik.questions[0].hint = 'Javob — kalit.';
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
    const q = r.tasks[0]!.tiers.karvon.questions[0];
    q.answer = 9;
    r.tasks[0]!.tiers.karvon.questions[1].options = ['A', 'A'];
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
    r.tasks[0]!.bobo = 'bobo.yoq';
    r.tasks[0]!.rewardPart = 'eshkak';
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
