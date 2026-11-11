import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { boboText, content, renderWithBobo } from '../test/utils';
import { Maze } from './Maze';
import { MagicChest, chestFeedback } from './MagicChest';
import { HiddenObjects, HIT_PAD, hitTarget } from './HiddenObjects';
import { HorseRunner } from './HorseRunner';
import { manualTicker } from './ticker';
import { DevBattle, stageFor } from '../components/DevBattle';
import { SHIELD_BLOCKS } from '../components/battle/ShieldPhase';
import { seededRng } from '../engine/random';
import { dirTo, shortestPath } from '../engine/maze';
import type { ChestContent, HiddenContent, HorseContent, MazeContent } from '../content/schema';
import { MINI_GAMES, GAME_LABEL } from './registry';

const task = (game: string) => content.tasks.find((t) => t.game === game)!;

// onDone aynan bir marta va aynan shu natija bilan chaqirilganini tekshiradi
expect.extend({
  toHaveBeenCalledOnceWithArgs(fn: ReturnType<typeof vi.fn>, ...args: unknown[]) {
    const pass = fn.mock.calls.length === 1 && this.equals(fn.mock.calls[0], args);
    return { pass, message: () => `kutilgan: 1 marta ${JSON.stringify(args)}, bo'ldi: ${JSON.stringify(fn.mock.calls)}` };
  },
});
declare module 'vitest' {
  interface Assertion {
    toHaveBeenCalledOnceWithArgs(...args: unknown[]): void;
  }
}
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;

describe('registry', () => {
  it('4 yangi tur ro\'yxatdan o\'tgan, nomi va belgisi bor', () => {
    for (const g of ['maze', 'hidden', 'horse', 'chest'] as const) {
      expect(MINI_GAMES[g]).toBeTypeOf('function');
      expect(GAME_LABEL[g].name.length).toBeGreaterThan(3);
    }
  });
});

describe('Sirli labirint (UI)', () => {
  const m = task('maze').tiers.kichik as MazeContent;
  const path = [...shortestPath(m, m.start, m.key)!, ...shortestPath(m, m.key, m.exit)!.slice(1)];

  it('klaviatura bilan: kalit -> darvoza -> onDone (aynan bir marta)', () => {
    const onDone = vi.fn();
    renderWithBobo(<Maze content={m} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    for (let i = 1; i < path.length; i++) fireEvent.keyDown(window, { key: KEY[dirTo(path[i - 1]!, path[i]!)!] });
    expect(screen.getByText('Kalit olindi')).toBeInTheDocument();
    return vi.waitFor(() => expect(onDone).toHaveBeenCalledOnceWithArgs({ mistakes: 0, allowance: 1 }));
  });

  it('ekrandagi tugmalar va WASD ham yuradi; devorga urilish xato emas', async () => {
    renderWithBobo(<Maze content={m} tier="kichik" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    const board = document.querySelector<HTMLElement>('.mz-board')!;
    expect(board.dataset.pos).toBe('1,1');
    await userEvent.click(screen.getByRole('button', { name: 'Yuqoriga' })); // devor
    expect(board.dataset.pos).toBe('1,1');
    await userEvent.click(screen.getByRole('button', { name: 'Pastga' }));
    expect(board.dataset.pos).toBe('1,2');
    fireEvent.keyDown(window, { key: 's' });
    expect(board.dataset.pos).toBe('1,3');
  });

  it("kalitsiz darvozaga kelsa — g'alaba emas, bobo eslatadi", () => {
    const onDone = vi.fn();
    const noKey: MazeContent = { ...m, key: [7, 1] }; // kalit boshqa joyda
    renderWithBobo(<Maze content={noKey} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    const toExit = shortestPath(noKey, noKey.start, noKey.exit)!;
    for (let i = 1; i < toExit.length; i++) fireEvent.keyDown(window, { key: KEY[dirTo(toExit[i - 1]!, toExit[i]!)!] });
    expect(boboText()).toMatch(/Darvoza yopiq/);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('maslahat 3 ta katakni yoritadi', async () => {
    renderWithBobo(<Maze content={m} tier="kichik" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Yo'lni ko'rsat/ }));
    expect(document.querySelectorAll('.mz-cell.hint')).toHaveLength(3);
    expect(boboText()).toBe(m.hint);
  });

  it('tuzoq: xato +1 va oxirgi xavfsiz katakka qaytadi', () => {
    const trapMap: MazeContent = { rows: ['#####', '#...#', '#.#.#', '#...#', '#####'], start: [1, 1], key: [3, 3], exit: [3, 1], traps: [[2, 1]], hint: "Pastdan aylanib o't." };
    renderWithBobo(<Maze content={trapMap} tier="karvon" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.querySelector('.mg-hud')!.textContent).toContain('⚠️ 1');
    expect(document.querySelector<HTMLElement>('.mz-board')!.dataset.pos).toBe('1,1');
    expect(boboText()).toMatch(/tuzoq/);
  });
});

describe('Sehrli sandiq (UI)', () => {
  const c = task('chest').tiers.kichik as ChestContent;

  it('noto\'g\'ri kod — iliq maslahat; to\'g\'ri kod — sandiq ochiladi, onDone bir marta', async () => {
    const onDone = vi.fn();
    renderWithBobo(<MagicChest content={c} tier="kichik" onDone={onDone} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Tekshirish/ }));
    expect(boboText()).toBe(chestFeedback(0));
    // 1-raqam: ▲ bilan, qolganlari klaviaturadan
    for (let i = 0; i < c.puzzles[0]!.answer; i++) await userEvent.click(screen.getByRole('button', { name: '1-raqamni oshirish' }));
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: '2-raqam' }), { key: String(c.puzzles[1]!.answer) });
    await userEvent.click(screen.getByRole('button', { name: /Tekshirish/ }));
    expect(boboText()).toBe(chestFeedback(2));
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: '3-raqam' }), { key: String(c.puzzles[2]!.answer) });
    await userEvent.click(screen.getByRole('button', { name: /Tekshirish/ }));
    expect(document.querySelector('.chest.open')).not.toBeNull();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnceWithArgs({ mistakes: 2, allowance: 2 }));
  });

  it("maslahat birinchi noto'g'ri jumboq usulini aytadi, javobni emas", async () => {
    renderWithBobo(<MagicChest content={c} tier="kichik" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(boboText()).toBe(c.puzzles[0]!.hint);
    expect(boboText()).not.toContain(String(c.puzzles[0]!.answer));
  });

  it('▼ 0 dan 9 ga aylanadi; touch tugmalari kamida 44px (CSS)', async () => {
    renderWithBobo(<MagicChest content={c} tier="kichik" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: '1-raqamni kamaytirish' }));
    expect(screen.getByRole('spinbutton', { name: '1-raqam' })).toHaveTextContent('9');
  });
});

describe('Yashirin buyumlar (UI)', () => {
  const c = task('hidden').tiers.kichik as HiddenContent;
  const W = 1600;
  const H = 900;
  const setup = (onDone = vi.fn(), tier: 'kichik' | 'olim' = 'kichik', cc: HiddenContent = c) => {
    renderWithBobo(<HiddenObjects content={cc} tier={tier} onDone={onDone} requestHint={() => true} delayMs={0} />);
    const stage = document.querySelector<HTMLElement>('.ho-stage')!;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const view = document.querySelector<HTMLElement>('.ho-view')!;
    const tapAt = (x: number, y: number) => {
      fireEvent.pointerDown(view, { pointerId: 1, clientX: x * W, clientY: y * H });
      fireEvent.pointerUp(view, { pointerId: 1, clientX: x * W, clientY: y * H });
    };
    return { onDone, tapAt, view };
  };

  it('har nishon markaziga bosish — topiladi; qayta bosish hisoblanmaydi; hammasi topilsa onDone', async () => {
    const { onDone, tapAt } = setup();
    for (const t of c.targets) {
      tapAt(t.x + t.w / 2, t.y + t.h / 2);
      tapAt(t.x + t.w / 2, t.y + t.h / 2);
    }
    expect(screen.getByText(`🔍 ${c.targets.length} / ${c.targets.length}`)).toBeInTheDocument();
    expect(document.querySelectorAll('.ho-list li.got')).toHaveLength(c.targets.length);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnceWithArgs({ mistakes: 0, allowance: 2 }));
  });

  it("kichiklarda noto'g'ri bosish xato emas; olimda har 3 tasi = 1 xato", async () => {
    const o = task('hidden').tiers.olim as HiddenContent;
    const { onDone, tapAt } = setup(vi.fn(), 'olim', o);
    for (let i = 0; i < 6; i++) tapAt(0.5, 0.97); // bo'sh joy (suv)
    for (const t of o.targets) tapAt(t.x + t.w / 2, t.y + t.h / 2);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 2, allowance: 4 }));
  });

  it('sudrash (pan) bosish hisoblanmaydi; zoom tugmalari ishlaydi', async () => {
    const { view } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kattalashtirish' }));
    expect(document.querySelector<HTMLElement>('.ho-stage')!.dataset.zoom).toBe('1.5');
    const t = c.targets[0]!;
    fireEvent.pointerDown(view, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(view, { pointerId: 1, clientX: 60, clientY: 40 });
    fireEvent.pointerUp(view, { pointerId: 1, clientX: (t.x + t.w / 2) * W, clientY: (t.y + t.h / 2) * H });
    expect(document.querySelectorAll('.ho-list li.got')).toHaveLength(0);
  });

  it('hitbox: kichiklarga zaxira, olimga aniq', () => {
    const t = c.targets[0]!;
    expect(hitTarget([t], t.x - 0.02, t.y, HIT_PAD.kichik)).toBe(t);
    expect(hitTarget([t], t.x - 0.02, t.y, HIT_PAD.olim)).toBeUndefined();
  });

  it('maslahat topilmagan buyum atrofini yoritadi', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Qayerda/ }));
    expect(document.querySelector('.ho-glow')).not.toBeNull();
    expect(boboText()).toBe(c.hint);
  });
});

describe("Ot bilan to'siqlar (UI, qo'lda kadr)", () => {
  const run = (tier: 'kichik' | 'olim', jumpWell: boolean) => {
    const c = task('horse').tiers[tier] as HorseContent;
    const clock = manualTicker();
    const onDone = vi.fn();
    renderWithBobo(<HorseRunner content={c} tier={tier} onDone={onDone} requestHint={() => true} delayMs={0} ticker={clock.ticker} />);
    const box = document.querySelector<HTMLElement>('.hr-box')!;
    act(() => void fireEvent.keyDown(window, { key: ' ' })); // Boshlash
    let jumpedFor = '';
    for (let i = 0; i < 6000 && !document.querySelector('.horse.phase-done'); i++) {
      act(() => clock.tick(1 / 60));
      const next = Number(box.dataset.next);
      const key = `${box.dataset.next ? Math.round(next * 0) : ''}`;
      if (jumpWell && box.dataset.next && next <= Number(box.dataset.lead) && box.dataset.y === '0.00' && jumpedFor !== `${i}`) {
        act(() => void fireEvent.keyDown(window, { key: ' ' }));
        jumpedFor = key + i;
      }
      if (!jumpWell && i > 2000) break;
    }
    return { onDone, c };
  };

  it("Space bilan to'g'ri sakrab marraga yetadi (kichik, mashq bilan)", async () => {
    const { onDone } = run('kichik', true);
    expect(document.querySelector('.horse.phase-done')).not.toBeNull();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnceWithArgs({ mistakes: 0, allowance: 2 }));
  });

  it("sakramasa: xatolar ko'payadi, 3 tadan keyin yerda belgi va bobo ko'rsatadi; o'yin to'xtamaydi", () => {
    run('olim', false);
    expect(Number(screen.getByText(/⚠️/).textContent!.replace(/\D/g, ''))).toBeGreaterThanOrEqual(3);
    expect(boboText()).toMatch(/Hechqisi|oltin belgida/);
    expect(document.querySelector('.horse.phase-done')).toBeNull();
  });

  it('pauza: kadrlar o\'tsa ham ot joyida', async () => {
    const c = task('horse').tiers.karvon as HorseContent;
    const clock = manualTicker();
    renderWithBobo(<HorseRunner content={c} tier="karvon" onDone={() => {}} requestHint={() => true} delayMs={0} ticker={clock.ticker} />);
    await userEvent.click(screen.getByRole('button', { name: /Boshlash/ }));
    for (let i = 0; i < 30; i++) act(() => clock.tick(1 / 60));
    await userEvent.click(screen.getByRole('button', { name: 'Pauza' }));
    const box = document.querySelector<HTMLElement>('.hr-box')!;
    const before = box.dataset.next;
    for (let i = 0; i < 60; i++) act(() => clock.tick(1 / 60));
    expect(box.dataset.next).toBe(before);
    expect(clock.active).toBe(0);
    expect(screen.getAllByRole('button', { name: /Davom etish/ }).length).toBeGreaterThan(0);
  });
});

describe('Dev bilan yakuniy jang (3 faza)', () => {
  const qs = content.levels.find((l) => l.id === 'gor')!.obstacle.battle!.kichik.questions;

  it('faza HP dan kelib chiqadi: 5/5/7 saqlanadi', () => {
    expect([5, 4, 3, 2, 1].map(stageFor)).toEqual(['quiz', 'quiz', 'quiz', 'shield', 'runes']);
  });

  it('savollar -> qalqon -> belgilar -> dev kechirim so\'raydi; onDone bir marta', async () => {
    const clock = manualTicker();
    const onDone = vi.fn();
    renderWithBobo(<DevBattle tier="kichik" questions={qs} onDone={onDone} delayMs={0} finale rng={seededRng(3)} ticker={clock.ticker} />);
    expect(screen.getByText('1/3 • Bilim savollari')).toBeInTheDocument();
    // 1-faza: 3 ta to'g'ri javob
    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(document.querySelector('.battle-q .option:not([disabled])')).not.toBeNull());
      const text = document.querySelector('.battle-q .dev-says')!.textContent!.replace("Dev so'raydi: ", '');
      const q = qs.find((x) => x.q === text)!;
      await userEvent.click(screen.getByRole('button', { name: q.options[q.answer] }));
    }
    // 2-faza: qalqon
    await vi.waitFor(() => expect(document.querySelector('.phase-shield')).not.toBeNull(), { timeout: 2000 });
    expect(screen.getByText('2/3 • Qalqon')).toBeInTheDocument();
    for (let blocks = 0; blocks < SHIELD_BLOCKS; ) {
      act(() => clock.tick(1 / 30));
      const el = document.querySelector<HTMLElement>('.phase-shield');
      if (!el) break;
      if (el.dataset.orb && Number(el.dataset.orb) >= Number(el.dataset.zone) + 0.05) {
        act(() => void fireEvent.keyDown(window, { key: ' ' }));
        blocks++;
      }
    }
    // 3-faza: belgilar
    await vi.waitFor(() => expect(document.querySelector('.phase-runes')).not.toBeNull(), { timeout: 2000 });
    const target = document.querySelector<HTMLElement>('.phase-runes')!.dataset.target!;
    await userEvent.click(screen.getByRole('button', { name: `Belgi ${[...target].find((r) => r !== target[0])}` })); // bitta xato
    for (const r of target) await userEvent.click(screen.getByRole('button', { name: `Belgi ${r}` }));
    await vi.waitFor(() => expect(document.querySelector('.battle.phase-won')).not.toBeNull(), { timeout: 2000 });
    expect(screen.getByText(/Kechiring!/)).toBeInTheDocument();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnceWithArgs({ mistakes: 1 }));
  });

  it('olim: 25 soniyali taymer saqlangan va pauzada to\'xtaydi', async () => {
    vi.useFakeTimers();
    const oq = content.levels.find((l) => l.id === 'gor')!.obstacle.battle!.olim.questions;
    renderWithBobo(<DevBattle tier="olim" questions={oq} onDone={() => {}} delayMs={0} finale />);
    expect(screen.getByText('⏳ 25')).toBeInTheDocument();
    for (let i = 0; i < 3; i++) act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText('⏳ 22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pauza' }));
    for (let i = 0; i < 5; i++) act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText('⏳ 22')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
