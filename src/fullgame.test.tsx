import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { content } from './test/utils';
import { playLevel } from './test/autoplay';
import { createLocalStore } from './engine/storage';
import { seededRng } from './engine/random';
import { maxStarsFor } from './screens/LevelScreen';
import { gradeToTier } from './engine/rules';

vi.mock('./components/map/phaserMap', () => ({ createMap: vi.fn(() => ({ destroy: vi.fn() })) }));

async function start(name: string, grade: number) {
  const u = userEvent.setup({ delay: null });
  render(<App content={content} store={createLocalStore()} rng={seededRng(7)} delayMs={0} />);
  await u.type(screen.getByLabelText('Isming'), name);
  await u.click(screen.getByRole('button', { name: new RegExp(`^${grade}$`) }));
  await u.click(screen.getByRole('button', { name: 'Sayohatni boshlash' }));
  return u;
}

const titles = [...content.levels].sort((a, b) => a.order - b.order).map((l) => l.title);

describe.each([
  ['Kichik sayyoh', 'Aziza', 2, false],
  ['Karvonboshi', 'Jasur', 6, true],
  ['Olim', 'Dilnoza', 10, false],
] as const)('to\'liq sarguzasht: %s', (_label, name, grade, mistakes) => {
  it(`7 bosqich, barcha buyumlar, dev jangi, final va sertifikat${mistakes ? ' (xatolar bilan)' : ''}`, async () => {
    const u = await start(name, grade);
    for (const [i, title] of titles.entries()) {
      await playLevel(u, content, title, { makeMistakes: mistakes });
      if (i < titles.length - 1) {
        expect(screen.getByText(`${title} — o'tildi!`)).toBeInTheDocument();
        await u.click(screen.getByRole('button', { name: 'Xaritaga qaytish' }));
      }
    }
    // Final
    expect(screen.getByText('Bilim kitobi qaytarildi!')).toBeInTheDocument();
    const cert = screen.getByRole('region', { name: 'Sertifikat' });
    expect(within(cert).getByText(name)).toBeInTheDocument();
    const tier = gradeToTier(grade);
    const max = maxStarsFor(content, tier);
    expect(within(cert).getByText(new RegExp(`/ ${max}`))).toBeInTheDocument();
    if (!mistakes) expect(within(cert).getByText('Oltin daraja')).toBeInTheDocument();

    // Sumka: barcha 7 buyum to'liq
    await u.click(screen.getByRole('button', { name: /Sumka/ }));
    for (const item of content.items) {
      expect(screen.getByTestId(`bag-${item.id}`)).toHaveTextContent(`${item.parts.length}/${item.parts.length}`);
    }
    // Tangalar: har topshiriq uchun 10
    expect(screen.getByLabelText(`Jami tanga: ${(max / 3) * 10}`)).toBeInTheDocument();

    // Xaritada hamma bosqich o'tilgan
    await u.click(screen.getByRole('button', { name: 'Yopish' }));
    await u.click(screen.getByRole('button', { name: 'Xaritaga qaytish' }));
    const nav = screen.getByRole('navigation', { name: 'Bosqichlar' });
    expect(within(nav).getAllByRole('button', { name: /o'tildi/ })).toHaveLength(7);
    // Hech qayerda "yutqazding" yo'q
    expect(document.body.textContent).not.toMatch(/yutqazding|o'yin tugadi/i);
  }, 120_000);
});
