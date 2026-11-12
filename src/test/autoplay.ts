/**
 * "Robot o'yinchi": butun o'yinni DOM orqali, xuddi bola kabi bosib o'ynaydi.
 * Javoblarni kontentdan oladi (javob kaliti), shuning uchun mazmun o'zgarsa ham ishlayveradi.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { ContentBundle } from '../content/validate';
import type { RiddleQuestion } from '../content/schema';
import { sameAnswer } from '../minigames/crosswordLayout';
import type { ChestContent, HiddenContent, MazeContent } from '../content/schema';
import { dirTo, shortestPath } from '../engine/maze';

type User = ReturnType<typeof userEvent.setup>;

export interface AutoplayOptions {
  /** Har bir bosh qotirma savolida avval bitta xato javob beradi (dalda va maslahat oqimini tekshirish uchun). */
  makeMistakes?: boolean;
  /** Vaqtga bog'liq o'yinlar (ot, qalqon) uchun qo'lda kadr — TickerContext orqali ulangan. */
  tick?: (dt: number) => void;
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

const tiersOf = <T>(c: ContentBundle, game: string) => c.tasks.filter((t) => t.game === game).flatMap((t) => Object.values(t.tiers) as T[]);
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;

function playMaze(c: ContentBundle) {
  const board = document.querySelector<HTMLElement>('.mz-board')!;
  const cols = board.style.gridTemplateColumns.match(/repeat\((\d+)/)![1];
  const m = tiersOf<MazeContent>(c, 'maze').find((x) => String(x.rows[0]!.length) === cols)!;
  const path = [...shortestPath(m, m.start, m.key)!, ...shortestPath(m, m.key, m.exit)!.slice(1)];
  for (let i = 1; i < path.length; i++) fireEvent.keyDown(window, { key: ARROWS[dirTo(path[i - 1]!, path[i]!)!] });
}

async function playChest(u: User, c: ContentBundle) {
  const qs = [...document.querySelectorAll('.chest-q')].map((e) => e.textContent);
  const chest = tiersOf<ChestContent>(c, 'chest').find((x) => x.puzzles.every((p, i) => p.q === qs[i]))!;
  chest.puzzles.forEach((p, i) => fireEvent.keyDown(screen.getByRole('spinbutton', { name: `${i + 1}-raqam` }), { key: String(p.answer) }));
  await u.click(screen.getByRole('button', { name: /Tekshirish/ }));
}

function playHidden(c: ContentBundle) {
  const labels = [...document.querySelectorAll('.ho-list li')].map((e) => e.getAttribute('data-target'));
  const h = tiersOf<HiddenContent>(c, 'hidden').find((x) => x.targets.length === labels.length && x.targets.every((t, i) => t.id === labels[i]))!;
  const stage = document.querySelector<HTMLElement>('.ho-stage')!;
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const view = document.querySelector<HTMLElement>('.ho-view')!;
  for (const t of h.targets) {
    const at = { pointerId: 1, clientX: (t.x + t.w / 2) * 1600, clientY: (t.y + t.h / 2) * 900 };
    fireEvent.pointerDown(view, at);
    fireEvent.pointerUp(view, at);
  }
}

async function playHorse(opts: AutoplayOptions) {
  if (!opts.tick) throw new Error("autoplay: ot o'yini uchun qo'lda kadr (tick) kerak");
  act(() => void fireEvent.keyDown(window, { key: ' ' })); // Boshlash
  const box = document.querySelector<HTMLElement>('.hr-box')!;
  for (let i = 0; i < 20000 && !document.querySelector('.horse.phase-done'); i++) {
    act(() => opts.tick!(1 / 60));
    if (box.dataset.next && Number(box.dataset.next) <= Number(box.dataset.lead) && box.dataset.y === '0.00') {
      act(() => void fireEvent.keyDown(window, { key: ' ' }));
    }
  }
}

async function playFinale(u: User, opts: AutoplayOptions) {
  if (!opts.tick) throw new Error("autoplay: jang uchun qo'lda kadr (tick) kerak");
  await waitFor(() => !!document.querySelector('.phase-shield'), 'qalqon fazasi');
  for (let i = 0; i < 5000 && document.querySelector('.phase-shield'); i++) {
    act(() => opts.tick!(1 / 30));
    const el = document.querySelector<HTMLElement>('.phase-shield');
    if (el?.dataset.orb && Number(el.dataset.orb) >= Number(el.dataset.zone) + 0.05) act(() => void fireEvent.keyDown(window, { key: ' ' }));
    await new Promise((r) => setTimeout(r, 0));
  }
  await waitFor(() => !!document.querySelector('.phase-runes'), 'belgilar fazasi');
  const target = document.querySelector<HTMLElement>('.phase-runes')!.dataset.target!;
  for (const r of target) await u.click(screen.getByRole('button', { name: `Belgi ${r}` }));
}

async function playCurrentGame(u: User, c: ContentBundle, opts: AutoplayOptions) {
  await waitFor(() => !!document.querySelector('.riddle, .puzzle, .crossword, .memory, .sorting, .maze, .chest, .hidden-game, .horse'), "mini-o'yin");
  if (document.querySelector('.maze')) playMaze(c);
  else if (document.querySelector('.chest')) await playChest(u, c);
  else if (document.querySelector('.hidden-game')) playHidden(c);
  else if (document.querySelector('.horse')) await playHorse(opts);
  else if (document.querySelector('.riddle')) await playRiddle(u, c, opts);
  else if (document.querySelector('.puzzle')) await playPuzzle(u);
  else if (document.querySelector('.crossword')) await playCrossword(u, c);
  else if (document.querySelector('.memory')) await playMemory(u);
  else if (document.querySelector('.sorting')) await playSorting(u);
  await waitFor(() => !!document.querySelector('.result'), 'natija ekrani');
}

/** Xaritadan bosqichga kirib, hamma topshiriqni bajaradi va to'siqni yengadi. */
/** Yo'l-yo'lakay chiqqan ertaklar (testlar tekshiradi). */
export const storiesSeen: string[] = [];

export async function playLevel(u: User, c: ContentBundle, title: string, opts: AutoplayOptions = {}) {
  const nav = screen.getByRole('navigation', { name: 'Bosqichlar' });
  await u.click(within(nav).getByRole('button', { name: new RegExp(`\\. ${title} — ochiq`) }));
  // Avval qo'shimcha (bonus) topshiriqlar, keyin buyum qismlarini beradiganlari — shunda oxirgisi to'siqqa olib boradi.
  for (;;) {
    await waitFor(() => !!document.querySelector('.hub'), 'bosqich sahifasi');
    const cards = all<HTMLButtonElement>('.task-card:not(.done)');
    if (cards.length === 0) break;
    const bonus = cards.find((b) => b.textContent!.includes("qo'shimcha sinov") || b.classList.contains('extra'));
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
  if (document.querySelector('.battle')) {
    await playBattle(u, c);
    if (document.querySelector('.battle.finale')) await playFinale(u, opts);
  }
  else {
    const take = screen.getByRole('button', { name: /ni olish$/ });
    await u.click(take);
    await u.click(document.querySelector<HTMLButtonElement>('.obstacle-target')!);
  }
  // oxirgi bosqich: avval yakuniy ertak chiqadi
  await waitFor(() => !!document.querySelector('.done, .story'), 'bosqich yakuni', 6000);
  const story = document.querySelector('.story');
  if (story) storiesSeen.push(story.getAttribute('aria-label') ?? '');
  const skip = [...document.querySelectorAll<HTMLButtonElement>('.story .story-btn')].find((b) => /O'tkazib/.test(b.textContent ?? ''));
  if (skip) await u.click(skip);
  await waitFor(() => !!document.querySelector('.done'), 'bosqich yakuni', 6000);
}
