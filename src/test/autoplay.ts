/**
 * "Robot o'yinchi": butun o'yinni DOM orqali, xuddi bola kabi bosib o'ynaydi.
 * Javoblarni kontentdan oladi (javob kaliti), shuning uchun mazmun o'zgarsa ham ishlayveradi.
 */
import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { ContentBundle } from '../content/validate';
import type { RiddleQuestion } from '../content/schema';
import { sameAnswer } from '../minigames/crosswordLayout';

type User = ReturnType<typeof userEvent.setup>;

export interface AutoplayOptions {
  /** Har bir bosh qotirma savolida avval bitta xato javob beradi (dalda va maslahat oqimini tekshirish uchun). */
  makeMistakes?: boolean;
}

const all = <T extends Element>(sel: string) => [...document.querySelectorAll<T>(sel)];

function allRiddleQuestions(c: ContentBundle): RiddleQuestion[] {
  const fromTasks = c.tasks.flatMap((t) =>
    Object.values(t.tiers).flatMap((v) => ((v as { questions?: RiddleQuestion[] }).questions ?? [])),
  );
  const fromBattles = c.levels.flatMap((l) =>
    l.obstacle.battle ? Object.values(l.obstacle.battle).flatMap((b) => b.questions) : [],
  );
  return [...fromTasks, ...fromBattles];
}

async function waitFor(cond: () => boolean, label: string, ms = 4000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`autoplay: kutish tugadi — ${label}\n${document.body.textContent?.slice(0, 600)}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function playRiddle(u: User, c: ContentBundle, opts: AutoplayOptions) {
  const qs = allRiddleQuestions(c);
  while (document.querySelector('.riddle')) {
    const text = document.querySelector('.riddle-q')?.textContent;
    const enabled = all<HTMLButtonElement>('.riddle .option:not([disabled])');
    if (!text || enabled.length === 0) {
      await new Promise((r) => setTimeout(r, 5));
      continue;
    }
    const shown = all<HTMLButtonElement>('.riddle .option').map((b) => b.textContent);
    const q = qs.find((x) => x.q === text && x.options.length === shown.length && x.options.every((o, i) => o === shown[i]));
    if (!q) throw new Error(`autoplay: savol topilmadi: ${text}`);
    if (opts.makeMistakes) {
      const wrong = enabled.find((b) => b.textContent !== q.options[q.answer]);
      if (wrong && enabled.length === q.options.length) await u.click(wrong);
    }
    const right = all<HTMLButtonElement>('.riddle .option').find((b) => b.textContent === q.options[q.answer])!;
    await u.click(right);
    await waitFor(() => !document.querySelector('.riddle') || document.querySelector('.riddle-q')?.textContent !== text, 'keyingi savol');
  }
}

async function playPuzzle(u: User) {
  for (;;) {
    const cells = all<HTMLButtonElement>('[data-cell]');
    if (cells.length === 0) return;
    const wrong = cells.find((x) => x.dataset.cell !== x.dataset.piece);
    if (!wrong) return;
    const holder = cells.find((x) => x.dataset.piece === wrong.dataset.cell)!;
    await u.click(wrong);
    await u.click(holder);
  }
}

async function playCrossword(u: User, c: ContentBundle) {
  const words = c.tasks.flatMap((t) =>
    Object.values(t.tiers).flatMap((v) => ((v as { words?: { q: string; a: string }[] }).words ?? [])),
  );
  while (document.querySelector('.cw-answer')) {
    const clue = document.querySelector('.cw-clue')!.textContent!;
    const w = words.find((x) => clue.includes(x.q));
    if (!w) throw new Error(`autoplay: krossvord savoli topilmadi: ${clue}`);
    const input = screen.getByLabelText('Javob') as HTMLInputElement;
    await u.clear(input);
    await u.type(input, w.a);
    await u.click(screen.getByRole('button', { name: 'Tekshirish' }));
    if (!sameAnswer(w.a, w.a)) throw new Error('unreachable');
  }
}

async function playMemory(u: User) {
  const pairs = new Map<string, HTMLButtonElement[]>();
  all<HTMLButtonElement>('.mcard').forEach((b) => pairs.set(b.dataset.pair!, [...(pairs.get(b.dataset.pair!) ?? []), b]));
  for (const [a, b] of pairs.values()) {
    await u.click(a!);
    await u.click(b!);
  }
}

async function playSorting(u: User) {
  const order = () => all<HTMLButtonElement>('.sort-main').map((b) => Number(b.dataset.item));
  for (;;) {
    const o = order();
    const pos = o.findIndex((item, i) => item !== i);
    if (pos < 0) break;
    const btns = all<HTMLButtonElement>('.sort-main');
    await u.click(btns[o.indexOf(pos)]!);
    await u.click(btns[pos]!);
  }
  await u.click(screen.getByRole('button', { name: 'Tekshirish' }));
}

async function playBattle(u: User, c: ContentBundle) {
  const qs = allRiddleQuestions(c);
  while (document.querySelector('.battle-q')) {
    const enabled = all<HTMLButtonElement>('.battle-q .option:not([disabled])');
    if (enabled.length === 0) {
      await new Promise((r) => setTimeout(r, 5));
      continue;
    }
    const text = document.querySelector('.battle-q .dev-says')!.textContent!.replace("Dev so'raydi: ", '');
    const q = qs.find((x) => x.q === text)!;
    await u.click(enabled.find((b) => b.textContent === q.options[q.answer])!);
  }
}

async function playCurrentGame(u: User, c: ContentBundle, opts: AutoplayOptions) {
  await waitFor(() => !!document.querySelector('.riddle, .puzzle, .crossword, .memory, .sorting'), "mini-o'yin");
  if (document.querySelector('.riddle')) await playRiddle(u, c, opts);
  else if (document.querySelector('.puzzle')) await playPuzzle(u);
  else if (document.querySelector('.crossword')) await playCrossword(u, c);
  else if (document.querySelector('.memory')) await playMemory(u);
  else if (document.querySelector('.sorting')) await playSorting(u);
  await waitFor(() => !!document.querySelector('.result'), 'natija ekrani');
}

/** Xaritadan bosqichga kirib, hamma topshiriqni bajaradi va to'siqni yengadi. */
export async function playLevel(u: User, c: ContentBundle, title: string, opts: AutoplayOptions = {}) {
  const nav = screen.getByRole('navigation', { name: 'Bosqichlar' });
  await u.click(within(nav).getByRole('button', { name: new RegExp(`\\. ${title} — ochiq`) }));
  // Avval qo'shimcha (bonus) topshiriqlar, keyin buyum qismlarini beradiganlari — shunda oxirgisi to'siqqa olib boradi.
  for (;;) {
    await waitFor(() => !!document.querySelector('.hub'), 'bosqich sahifasi');
    const cards = all<HTMLButtonElement>('.task-card:not(.done)');
    if (cards.length === 0) break;
    const bonus = cards.find((b) => b.textContent!.includes("qo'shimcha sinov"));
    await u.click(bonus ?? cards[0]!);
    await playCurrentGame(u, c, opts);
    const go = screen.queryByRole('button', { name: "To'siqni yengamiz!" });
    if (go) {
      await u.click(go);
      break;
    }
    await u.click(screen.getByRole('button', { name: 'Davom etamiz' }));
  }
  if (document.querySelector('.hub')) {
    await u.click(screen.getByRole('button', { name: /To'siqni yengamiz!|Dev bilan jangga!/ }));
  }
  await waitFor(() => !!document.querySelector('.obstacle, .battle'), "to'siq");
  if (document.querySelector('.battle')) await playBattle(u, c);
  else {
    const take = screen.getByRole('button', { name: /ni olish$/ });
    await u.click(take);
    await u.click(document.querySelector<HTMLButtonElement>('.obstacle-target')!);
  }
  await waitFor(() => !!document.querySelector('.done'), 'bosqich yakuni', 6000);
}
