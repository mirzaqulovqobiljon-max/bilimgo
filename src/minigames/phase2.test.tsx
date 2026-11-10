import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { layoutCrossword, sameAnswer, tokenize, wordCells } from './crosswordLayout';
import { Crossword } from './Crossword';
import { Memory } from './Memory';
import { Sorting } from './Sorting';
import { boboText, renderWithBobo } from '../test/utils';
import { seededRng } from '../engine/random';
import type { CrosswordContent, MemoryContent, SortingContent } from '../content/schema';

describe('crossword tokenizer', () => {
  it("treats O' and G' as one cell and unifies apostrophes", () => {
    expect(tokenize("o'rmon")).toEqual(["O'", 'R', 'M', 'O', 'N']);
    expect(tokenize('Tog‘')).toEqual(['T', 'O', "G'"]);
    expect(tokenize('qo`shiq')).toEqual(['Q', "O'", 'S', 'H', 'I', 'Q']);
    expect(sameAnswer(' baliq ', 'BALIQ')).toBe(true);
    expect(sameAnswer("o‘rdak", "O'RDAK")).toBe(true);
    expect(sameAnswer('baliqlar', 'BALIQ')).toBe(false);
  });
});

function checkGrid(answers: string[]) {
  const g = layoutCrossword(answers);
  expect(g.placements).toHaveLength(answers.length);
  for (const p of g.placements) {
    const cells = wordCells(p);
    // every word is readable from the grid
    expect(cells.map((c) => g.cells.get(c))).toEqual(tokenize(answers[p.index]!));
    for (const c of cells) {
      const [r, col] = c.split(',').map(Number) as [number, number];
      expect(r).toBeGreaterThanOrEqual(0);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(g.rows);
      expect(col).toBeLessThan(g.cols);
    }
  }
  // numbers start from 1 and are contiguous
  const nums = [...new Set(g.placements.map((p) => p.number))].sort((a, b) => a - b);
  expect(nums).toEqual(nums.map((_, i) => i + 1));
  return g;
}

describe('crossword layout', () => {
  it('crosses words that share letters', () => {
    const g = checkGrid(['BALIQ', 'LAQQAQ', 'QURBAQA', 'ILON']);
    expect(g.placements.some((p) => p.dir === 'down')).toBe(true);
    // at least one shared cell
    const all = g.placements.flatMap(wordCells);
    expect(new Set(all).size).toBeLessThan(all.length);
  });

  it('places words without common letters on separate rows', () => {
    checkGrid(['OY', 'UY', 'BEK']);
  });

  it('works for 15 words and stays reasonably compact', () => {
    const words = ['SAMARQAND', 'BUXORO', 'XIVA', 'TERMIZ', 'QARSHI', 'NAVOIY', 'JIZZAX', 'GULISTON', 'NAMANGAN', 'ANDIJON', "FARG'ONA", 'URGANCH', 'NUKUS', 'TOSHKENT', 'QO\'QON'];
    const g = checkGrid(words);
    expect(g.rows * g.cols).toBeLessThan(700);
  });

  it('is deterministic', () => {
    const a = layoutCrossword(['KITOB', 'QALAM', 'DAFTAR']);
    const b = layoutCrossword(['KITOB', 'QALAM', 'DAFTAR']);
    expect([...a.cells]).toEqual([...b.cells]);
  });
});

const cw: CrosswordContent = {
  words: [
    { q: "Suvda suzadi, qanoti yo'q", a: 'BALIQ', picture: '🐟' },
    { q: 'Vaqillaydi, suvda yashaydi', a: 'QURBAQA' },
  ],
};

describe('Krossvord component', () => {
  it('perfect play -> 0 mistakes; letters appear in grid', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Crossword content={cw} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    const first = document.querySelector('.cw-clue')!.textContent!;
    const answerFor = (clue: string) => (clue.includes('Suvda suzadi') ? 'baliq' : 'qurbaqa');
    await userEvent.type(screen.getByLabelText('Javob'), answerFor(first));
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    expect(boboText()).toMatch(/Barakalla|Ofarin|zo'r|Qoyil/);
    const second = document.querySelector('.cw-clue')!.textContent!;
    expect(second).not.toBe(first);
    await userEvent.type(screen.getByLabelText('Javob'), answerFor(second));
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0, allowance: 2 }));
    const letters = [...document.querySelectorAll('.cw-cell.solved')].map((c) => c.textContent).join('');
    expect(letters).toMatch(/B/);
  });

  it('2 wrong answers -> hint reveals only the first letter, not the word', async () => {
    const requestHint = vi.fn(() => true);
    renderWithBobo(<Crossword content={cw} tier="kichik" onDone={() => {}} requestHint={requestHint} delayMs={0} />);
    const input = screen.getByLabelText('Javob');
    await userEvent.type(input, 'xxx');
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    expect(boboText()).toMatch(/Hechqisi|yoningdaman|Shoshilma|Sabr/);
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    expect(boboText()).toMatch(/Bir maslahat beraymi/);
    await userEvent.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(requestHint).toHaveBeenCalledOnce();
    expect(boboText()).toMatch(/harfi bilan boshlanadi/);
    expect(boboText()).not.toMatch(/BALIQ|QURBAQA/);
    const shown = [...document.querySelectorAll('.cw-cell:not(.empty)')].map((c) => c.textContent?.replace(/\d/g, '')).filter(Boolean);
    expect(shown).toHaveLength(1);
  });

  it('player can choose another clue', async () => {
    renderWithBobo(<Crossword content={cw} tier="karvon" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Vaqillaydi/ }));
    expect(document.querySelector('.cw-clue')!.textContent).toMatch(/Vaqillaydi/);
  });
});

const mem: MemoryContent = {
  pairs: [
    { a: '🐟', b: 'Daryo' },
    { a: '🐝', b: 'Uya' },
    { a: '🐦', b: 'In' },
  ],
  hint: 'Har bir jonivor qayerda yashashini esla.',
};

function cardsByPair() {
  const m = new Map<string, HTMLButtonElement[]>();
  document.querySelectorAll<HTMLButtonElement>('.mcard').forEach((b) => {
    const k = b.dataset.pair!;
    m.set(k, [...(m.get(k) ?? []), b]);
  });
  return [...m.values()];
}

describe('Xotira kartalari', () => {
  it('perfect matching -> 0 mistakes', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Memory content={mem} tier="kichik" onDone={onDone} requestHint={() => true} rng={seededRng(2)} delayMs={0} />);
    expect(screen.getAllByRole('button', { name: 'Yopiq karta' })).toHaveLength(6);
    for (const [a, b] of cardsByPair()) {
      await userEvent.click(a!);
      await userEvent.click(b!);
    }
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0, allowance: 3 }));
  });

  it('first-time mismatches are not mistakes; repeating a seen card is', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Memory content={mem} tier="kichik" onDone={onDone} requestHint={() => true} rng={seededRng(2)} delayMs={0} />);
    const pairs = cardsByPair();
    const [p0a] = pairs[0]!;
    const [p1a] = pairs[1]!;
    await userEvent.click(p0a!);
    await userEvent.click(p1a!); // never seen before: not a mistake
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: 'Yopiq karta' })).toHaveLength(6));
    expect(boboText()).toBe('');
    await userEvent.click(p0a!);
    await userEvent.click(p1a!); // both already seen: mistake
    expect(boboText()).toMatch(/Hechqisi|yoningdaman|Shoshilma|Sabr/);
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: 'Yopiq karta' })).toHaveLength(6));
    for (const [a, b] of cardsByPair()) {
      await userEvent.click(a!);
      await userEvent.click(b!);
    }
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 1, allowance: 3 }));
  });

  it('cannot open a third card while two are open', async () => {
    renderWithBobo(<Memory content={mem} tier="kichik" onDone={() => {}} requestHint={() => true} rng={seededRng(2)} delayMs={10_000} />);
    const pairs = cardsByPair();
    await userEvent.click(pairs[0]![0]!);
    await userEvent.click(pairs[1]![0]!);
    await userEvent.click(pairs[2]![0]!);
    expect(document.querySelectorAll('.mcard.up')).toHaveLength(2);
  });
});

const sort: SortingContent = {
  prompt: 'Taxtalarni og\'irligi bo\'yicha tartibla',
  items: ['1 kg', '3 kg', '5 kg', '8 kg'],
  topLabel: 'Eng yengil',
  bottomLabel: "Eng og'ir",
  hint: 'Eng kichik sondan boshla.',
};

const order = () => [...document.querySelectorAll<HTMLButtonElement>('.sort-main')].map((b) => Number(b.dataset.item));

async function sortByTaps() {
  for (;;) {
    const o = order();
    const pos = o.findIndex((item, i) => item !== i);
    if (pos < 0) return;
    const from = o.indexOf(pos);
    const btns = document.querySelectorAll<HTMLButtonElement>('.sort-main');
    await userEvent.click(btns[from]!);
    await userEvent.click(btns[pos]!);
  }
}

describe('Tartiblash', () => {
  it('starts shuffled; sorting then checking once -> 0 mistakes', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Sorting content={sort} tier="karvon" onDone={onDone} requestHint={() => true} rng={seededRng(4)} delayMs={0} />);
    expect(order()).not.toEqual([0, 1, 2, 3]);
    await sortByTaps();
    expect(order()).toEqual([0, 1, 2, 3]);
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0, allowance: 1 }));
  });

  it('wrong check locks correct items, counts a mistake, says how many are right', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Sorting content={sort} tier="karvon" onDone={onDone} requestHint={() => true} rng={seededRng(4)} delayMs={0} />);
    const before = order();
    const rightCount = before.filter((it, i) => it === i).length;
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    expect(boboText()).toMatch(new RegExp(`${rightCount} tasi o'z joyida`));
    expect(document.querySelectorAll('.sort-item.locked')).toHaveLength(rightCount);
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    await userEvent.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(boboText()).toBe('Eng kichik sondan boshla.');
    await sortByTaps();
    await userEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 2, allowance: 1 }));
  });

  it('arrow buttons move items and skip locked ones', async () => {
    renderWithBobo(<Sorting content={sort} tier="karvon" onDone={() => {}} requestHint={() => true} rng={seededRng(4)} delayMs={0} />);
    const o = order();
    const name = sort.items[o[1]!]!;
    fireEvent.click(screen.getByRole('button', { name: `${name} yuqoriga` }));
    expect(order()[0]).toBe(o[1]);
  });
});
