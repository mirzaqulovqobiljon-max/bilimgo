import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Riddle } from './Riddle';
import { Puzzle, solvedCount } from './Puzzle';
import { boboText, renderWithBobo } from '../test/utils';
import { seededRng } from '../engine/random';
import type { RiddleContent } from '../content/schema';

const riddle: RiddleContent = {
  questions: [
    { q: 'Birinchi savol?', options: ['A', 'B', 'C'], answer: 1, hint: 'Ikkinchi harf.' },
    { q: 'Ikkinchi savol?', options: ['X', 'Y'], answer: 0, hint: 'Oxiridan uchinchi.' },
  ],
};

describe('Bosh qotirma (Riddle)', () => {
  it('perfect run -> 0 mistakes', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Riddle content={riddle} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(boboText()).toMatch(/Barakalla|Ofarin|zo'r|Qoyil/);
    await userEvent.click(await screen.findByRole('button', { name: 'X' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0, allowance: 2 }));
  });

  it('wrong answer: kind words, option disabled, no "you lost"', async () => {
    const onDone = vi.fn();
    renderWithBobo(<Riddle content={riddle} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled();
    expect(boboText()).toMatch(/Hechqisi|yoningdaman|Shoshilma|Sabr/);
    expect(document.body.textContent).not.toMatch(/yutqazding|o'yin tugadi/i);
    expect(screen.queryByRole('button', { name: /Maslahat/ })).toBeNull();
  });

  it('after 2 mistakes bobo offers a hint, hint never contains the answer', async () => {
    const requestHint = vi.fn(() => true);
    const onDone = vi.fn();
    const three: RiddleContent = { questions: [{ q: 'S?', options: ['Olma', 'Nok', 'Uzum'], answer: 2, hint: 'Shingil-shingil bo\'ladi.' }] };
    renderWithBobo(<Riddle content={three} tier="kichik" onDone={onDone} requestHint={requestHint} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Olma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nok' }));
    expect(boboText()).toMatch(/Bir maslahat beraymi/);
    await userEvent.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(requestHint).toHaveBeenCalledTimes(1);
    expect(boboText()).toBe("Shingil-shingil bo'ladi.");
    await userEvent.click(screen.getByRole('button', { name: 'Uzum' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 2, allowance: 1 }));
  });

  it('hint budget exhausted -> encouraging message instead', async () => {
    const three: RiddleContent = { questions: [{ q: 'S?', options: ['a', 'b', 'c'], answer: 2, hint: 'Yordam.' }] };
    renderWithBobo(<Riddle content={three} tier="olim" onDone={() => {}} requestHint={() => false} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'a' }));
    await userEvent.click(screen.getByRole('button', { name: 'b' }));
    await userEvent.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(boboText()).toMatch(/Maslahatlar tugadi/);
  });
});

/** Read the board from the DOM and solve it with taps. */
async function solveByTaps() {
  for (;;) {
    const cells = [...document.querySelectorAll<HTMLButtonElement>('[data-cell]')];
    const wrong = cells.find((c) => c.dataset.cell !== c.dataset.piece);
    if (!wrong) return;
    const want = Number(wrong.dataset.cell);
    const holder = cells.find((c) => Number(c.dataset.piece) === want)!;
    await userEvent.click(wrong);
    await userEvent.click(holder);
  }
}

describe('Puzzle', () => {
  it.each([4, 9, 16] as const)('%i pieces: solvable by taps, perfect play = 0 mistakes', async (pieces) => {
    const onDone = vi.fn();
    renderWithBobo(
      <Puzzle content={{ image: 'qishloq-darvoza', pieces, caption: 'Darvoza' }} tier="karvon" onDone={onDone} requestHint={() => true} rng={seededRng(pieces)} delayMs={0} />,
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(pieces);
    const initial = [...document.querySelectorAll<HTMLElement>('[data-cell]')].map((c) => Number(c.dataset.piece));
    expect(solvedCount(initial)).toBeLessThan(pieces);
    await solveByTaps();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0, allowance: Math.ceil(pieces / 4) }));
  });

  it('locked (correct) pieces cannot be moved; useless swaps count as mistakes', async () => {
    const onDone = vi.fn();
    renderWithBobo(
      <Puzzle content={{ image: 'qishloq-darvoza', pieces: 9, caption: 'D' }} tier="karvon" onDone={onDone} requestHint={() => true} rng={seededRng(3)} delayMs={0} />,
    );
    const cells = () => [...document.querySelectorAll<HTMLButtonElement>('[data-cell]')];
    const locked = cells().find((c) => c.dataset.cell === c.dataset.piece);
    if (locked) {
      await userEvent.click(locked);
      expect(locked).toHaveAttribute('aria-pressed', 'false');
    }
    // find a swap where neither piece lands correctly
    const wrong = cells().filter((c) => c.dataset.cell !== c.dataset.piece);
    let pair: [HTMLButtonElement, HTMLButtonElement] | null = null;
    for (const a of wrong) for (const b of wrong) {
      if (a !== b && a.dataset.piece !== b.dataset.cell && b.dataset.piece !== a.dataset.cell) pair ??= [a, b];
    }
    if (pair) {
      await userEvent.click(pair[0]);
      await userEvent.click(pair[1]);
    }
    await solveByTaps();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0]![0].mistakes).toBe(pair ? 1 : 0);
  });

  it('drag one piece onto another swaps them', () => {
    renderWithBobo(
      <Puzzle content={{ image: 'qishloq-darvoza', pieces: 4, caption: 'D' }} tier="kichik" onDone={() => {}} requestHint={() => true} rng={seededRng(5)} delayMs={0} />,
    );
    const cells = [...document.querySelectorAll<HTMLButtonElement>('[data-cell]')];
    const a = cells.find((c) => c.dataset.cell !== c.dataset.piece)!;
    const b = cells.find((c) => c !== a && c.dataset.cell !== c.dataset.piece)!;
    const [pa, pb] = [a.dataset.piece, b.dataset.piece];
    document.elementFromPoint = () => b;
    fireEvent.pointerDown(a, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(a, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(a, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(a.dataset.piece).toBe(pb);
    expect(b.dataset.piece).toBe(pa);
  });

  it('kichik sees the sample picture by default', () => {
    renderWithBobo(
      <Puzzle content={{ image: 'qishloq-darvoza', pieces: 4, caption: 'D' }} tier="kichik" onDone={() => {}} requestHint={() => true} rng={seededRng(1)} />,
    );
    expect(screen.getByAltText('Namuna rasm')).toBeInTheDocument();
  });
});
