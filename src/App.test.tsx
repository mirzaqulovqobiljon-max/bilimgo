import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { content, skipStory } from './test/utils';
import { createLocalStore } from './engine/storage';
import { seededRng } from './engine/random';

// Phaser canvas jsdom'da ishlamaydi — xarita uchun accessible ro'yxat (sr-only) orqali o'ynaymiz.
vi.mock('./components/map/phaserMap', () => ({
  createMap: vi.fn(() => ({ destroy: vi.fn() })),
}));

const bubble = () => document.querySelector('.bobo-bubble')?.textContent ?? '';
const user = () => userEvent.setup();

function renderApp() {
  return render(<App content={content} store={createLocalStore()} rng={seededRng(42)} delayMs={0} />);
}

async function register(u: ReturnType<typeof user>, name: string, grade: number) {
  await u.type(screen.getByLabelText('Isming'), name);
  await u.click(screen.getByRole('button', { name: new RegExp(`^${grade}$`) }));
  await u.click(screen.getByRole('button', { name: 'Sayohatni boshlash' }));
  await skipStory(u);
}

async function solvePuzzle(u: ReturnType<typeof user>) {
  for (;;) {
    const cells = [...document.querySelectorAll<HTMLButtonElement>('[data-cell]')];
    const wrong = cells.find((c) => c.dataset.cell !== c.dataset.piece);
    if (!wrong) return;
    const holder = cells.find((c) => c.dataset.piece === wrong.dataset.cell)!;
    await u.click(wrong);
    await u.click(holder);
  }
}

async function answer(u: ReturnType<typeof user>, ...opts: string[]) {
  for (const o of opts) await u.click(await screen.findByRole('button', { name: o }));
}

describe('1-bosqich: Ona qishloq — to\'liq o\'yin (Kichik sayyoh)', () => {
  it('register -> map -> 3 tasks -> key -> gate -> next level unlocked, progress saved', async () => {
    const u = user();
    const { unmount } = renderApp();

    // Ro'yxatdan o'tish: faqat ism va sinf
    expect(screen.queryByLabelText(/telefon|manzil/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sayohatni boshlash' })).toBeDisabled();
    await register(u, 'Aziza', 2);
    expect(screen.getByText('Kichik sayyoh')).toBeInTheDocument();

    // Xarita: 7 nuqta, faqat birinchisi ochiq
    const nav = screen.getByRole('navigation', { name: 'Bosqichlar' });
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
    expect(bubble()).toMatch(/Bilim kitobini o'g'irladi/);
    await u.click(within(nav).getByRole('button', { name: /2\. Qorong'i o'rmon — qulflangan/ }));
    expect(bubble()).toMatch(/oldingi to'siqni/);
    await u.click(within(nav).getByRole('button', { name: /1\. Ona qishloq — ochiq/ }));

    // Bosqich: bobo hikoyasi, 3 ta topshiriq (kichik)
    expect(bubble()).toMatch(/darvozasi qulflangan/);
    const cards = screen.getAllByRole('button', { name: /Bosh qotirma|Puzzle/ });
    expect(cards).toHaveLength(3);
    expect(screen.getByText('Kalit: 0/3')).toBeInTheDocument();

    // 1) Harflardan so'z — xatosiz
    await u.click(screen.getByRole('button', { name: /Harflardan so'z/ }));
    expect(bubble()).toMatch(/Harflardan so'z tuzamiz/);
    await answer(u, 'KALIT', 'OT', 'UY');
    expect(await screen.findByText(/Kalit dastasi sumkaga tushdi!/)).toBeInTheDocument();
    expect(screen.getByLabelText('3 yulduz')).toBeInTheDocument();
    expect(screen.getByText('+10 🪙')).toBeInTheDocument();
    expect(screen.queryByText(/Yana o'ynash/)).toBeNull(); // 3 yulduz — qayta o'ynash taklif qilinmaydi
    await u.click(screen.getByRole('button', { name: 'Davom etamiz' }));
    expect(screen.getByText('Kalit: 1/3')).toBeInTheDocument();

    // 2) Puzzle (4 bo'lak)
    await u.click(screen.getByRole('button', { name: /Qishloq darvozasi rasmi/ }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(4);
    await solvePuzzle(u);
    expect(await screen.findByText(/Kalit tishlari sumkaga tushdi!/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Davom etamiz' }));

    // 3) Topishmoqlar — bitta xato bilan (2 yulduz, dalda, "yutqazding" yo'q)
    await u.click(screen.getByRole('button', { name: /Topishmoqlar/ }));
    await answer(u, 'Olma');
    expect(bubble()).toMatch(/Hechqisi|yoningdaman|Shoshilma|Sabr/);
    await answer(u, 'Tuxum', 'Oy', 'Kitob');
    expect(await screen.findByText(/Kalit halqasi sumkaga tushdi!/)).toBeInTheDocument();
    expect(screen.getByText("Kalit to'liq yig'ildi!")).toBeInTheDocument();
    expect(screen.getByLabelText('2 yulduz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yana o'ynash/ })).toBeInTheDocument();
    expect(bubble()).toMatch(/kaliting tayyor/);
    expect(document.body.textContent).not.toMatch(/yutqazding|o'yin tugadi/i);

    // Sumka: Kalit 3/3
    await u.click(screen.getByRole('button', { name: /Sumka/ }));
    expect(screen.getByTestId('bag-kalit')).toHaveTextContent('Kalit 3/3');
    await u.click(screen.getByRole('button', { name: 'Yopish' }));

    // Darvoza: kalitni sumkadan olib, qulfga
    await u.click(screen.getByRole('button', { name: "To'siqni yengamiz!" }));
    expect(bubble()).toMatch(/darvoza qulfiga olib bor/);
    await u.click(screen.getByRole('button', { name: 'Kalitni olish' }));
    await u.click(screen.getByRole('button', { name: /Qulflangan darvoza: kalitni/ }));
    expect(await screen.findByText("Ona qishloq — o'tildi!")).toBeInTheDocument();
    expect(bubble()).toMatch(/Darvoza ochildi/);

    // Hisob: 3+3+2 yulduz, 30 tanga
    expect(screen.getByLabelText('Jami yulduz: 8')).toBeInTheDocument();
    expect(screen.getByLabelText('Jami tanga: 30')).toBeInTheDocument();

    // Xarita: 2-nuqta endi ochiq
    await u.click(screen.getByRole('button', { name: 'Xaritaga qaytish' }));
    const nav2 = screen.getByRole('navigation', { name: 'Bosqichlar' });
    within(nav2).getByRole('button', { name: /1\. Ona qishloq — o'tildi/ });
    within(nav2).getByRole('button', { name: /3\. Katta daryo — qulflangan/ });
    await u.click(within(nav2).getByRole('button', { name: /2\. Qorong'i o'rmon — ochiq/ }));
    expect(bubble()).toMatch(/Mash'al yasaymiz/);
    await u.click(screen.getByRole('button', { name: '← Xarita' }));

    // Sahifani yangilash: progress saqlangan
    unmount();
    renderApp();
    expect(screen.getByText('Aziza')).toBeInTheDocument();
    expect(screen.getByLabelText('Jami tanga: 30')).toBeInTheDocument();
    within(screen.getByRole('navigation', { name: 'Bosqichlar' })).getByRole('button', { name: /Ona qishloq — o'tildi/ });
  });

  it('replaying for the 3rd star keeps the item and gives no extra coins', async () => {
    const u = user();
    renderApp();
    await register(u, 'Bek', 3);
    await u.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Ona qishloq/ }));
    await u.click(screen.getByRole('button', { name: /Topishmoqlar/ }));
    await answer(u, 'Olma', 'Tuxum', 'Oy', 'Kitob');
    await u.click(await screen.findByRole('button', { name: /Yana o'ynash/ }));
    await answer(u, 'Tuxum', 'Oy', 'Kitob');
    expect(await screen.findByLabelText('3 yulduz')).toBeInTheDocument(); // natija kartasi
    expect(screen.queryByText(/\+10/)).toBeNull();
    expect(screen.getByLabelText('Jami yulduz: 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Jami tanga: 10')).toBeInTheDocument();
  });
});

describe('yosh darajalari', () => {
  it('Karvonboshi (6-sinf): 4 topshiriq, 16 bo\'lakli puzzle, maslahat 3 ta', async () => {
    const u = user();
    renderApp();
    await register(u, 'Jasur', 6);
    expect(screen.getByText('Karvonboshi')).toBeInTheDocument();
    await u.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Ona qishloq/ }));
    expect(screen.getAllByRole('button', { name: /Bosh qotirma|Puzzle/ })).toHaveLength(4);
    expect(screen.getByText(/qo'shimcha sinov/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Qishloq darvozasi rasmi/ }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
    expect(screen.getByLabelText('Qolgan maslahatlar')).toHaveTextContent('3');
  });

  it('Olim (10-sinf): 5 topshiriq, 1 maslahat, 2-maslahat berilmaydi', async () => {
    const u = user();
    renderApp();
    await register(u, 'Dilnoza', 10);
    await u.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Ona qishloq/ }));
    expect(screen.getAllByRole('button', { name: /Bosh qotirma|Puzzle/ })).toHaveLength(5);
    await u.click(screen.getByRole('button', { name: /Harflardan so'z/ }));
    await answer(u, "mo'giza", 'mujiza');
    await u.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(bubble()).toMatch(/Lug'atga qara/);
    expect(screen.getByLabelText('Qolgan maslahatlar')).toHaveTextContent('0');
    await answer(u, "mo'jiza", 'OILA', 'TOLA');
    await u.click(screen.getByRole('button', { name: /Maslahat/ }));
    expect(bubble()).toMatch(/Maslahatlar tugadi/);
  });
});

describe('o\'yinchini almashtirish', () => {
  it('needs a second confirmation, then returns to registration', async () => {
    const u = user();
    renderApp();
    await register(u, 'Ali', 1);
    await u.click(screen.getByRole('button', { name: "O'yinchini almashtirish" }));
    await u.click(screen.getByRole('button', { name: "Yo'q" }));
    expect(screen.getByText('Ali')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: "O'yinchini almashtirish" }));
    await u.click(screen.getByRole('button', { name: "Ha, yangi o'yinchi" }));
    expect(screen.getByLabelText('Isming')).toBeInTheDocument();
  });
});
