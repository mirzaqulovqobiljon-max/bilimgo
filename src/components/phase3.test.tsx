import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevBattle, OLIM_SECONDS_PER_QUESTION } from './DevBattle';
import { Certificate, certificateLevel } from './Certificate';
import { ObstacleScene } from './ObstacleScene';
import { boboText, content, renderWithBobo } from '../test/utils';
import { initialProgress, setProfile } from '../engine/progress';
import type { RiddleQuestion } from '../content/schema';

const battle = content.levels.find((l) => l.id === 'gor')!.obstacle.battle!;
const devQ = () => document.querySelector('.battle-q .dev-says')!.textContent!.replace("Dev so'raydi: ", '');
const answerOf = (qs: RiddleQuestion[], text: string) => {
  const q = qs.find((x) => x.q === text)!;
  return { right: q.options[q.answer]!, wrong: q.options.find((_, i) => i !== q.answer)! };
};
const hp = () => Number(screen.getByRole('meter').getAttribute('aria-valuenow'));

describe('Dev jangi', () => {
  it('kichik: 5 correct answers -> dev magic breaks and he runs away (not killed)', async () => {
    const onDone = vi.fn();
    const qs = battle.kichik.questions;
    renderWithBobo(<DevBattle tier="kichik" questions={qs} onDone={onDone} delayMs={0} />);
    expect(hp()).toBe(5);
    for (let i = 0; i < 5; i++) {
      await userEvent.click(await screen.findByRole('button', { name: answerOf(qs, devQ()).right }));
      if (i < 4) await vi.waitFor(() => expect(screen.getAllByRole('button').some((b) => !b.hasAttribute('disabled') && b.className === 'option')).toBe(true));
    }
    expect(await screen.findByText(/Kechiring! Kitobni qaytaraman/)).toBeInTheDocument();
    expect(boboText()).toMatch(/sehri sindi/);
    expect(document.body.textContent).not.toMatch(/o'ldi|qon/i);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 0 }));
  });

  it('wrong answer: the shield blocks, child never loses, question comes back later', async () => {
    const onDone = vi.fn();
    const qs = battle.karvon.questions;
    renderWithBobo(<DevBattle tier="karvon" questions={qs} onDone={onDone} delayMs={0} />);
    const first = devQ();
    await userEvent.click(screen.getByRole('button', { name: answerOf(qs, first).wrong }));
    expect(boboText()).toMatch(/Qalqon seni himoya qildi/);
    expect(hp()).toBe(5);
    let seenAgain = false;
    while (!screen.queryByText(/tutunga aylanib/)) {
      await vi.waitFor(() => expect(document.querySelector('.battle-q .option:not([disabled])')).not.toBeNull());
      const t = devQ();
      if (t === first) seenAgain = true;
      await userEvent.click(screen.getByRole('button', { name: answerOf(qs, t).right }));
    }
    expect(seenAgain).toBe(true);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith({ mistakes: 1 }));
  });

  it('olim: 7 hits needed and a timer; timeout is blocked by the shield', () => {
    vi.useFakeTimers();
    const qs = battle.olim.questions;
    renderWithBobo(<DevBattle tier="olim" questions={qs} onDone={() => {}} delayMs={100} />);
    expect(hp()).toBe(7);
    expect(screen.getByLabelText(`Qolgan vaqt ${OLIM_SECONDS_PER_QUESTION} soniya`)).toBeInTheDocument();
    for (let i = 0; i < OLIM_SECONDS_PER_QUESTION; i++) act(() => vi.advanceTimersByTime(1000));
    expect(boboText()).toMatch(/Qalqon/);
    expect(hp()).toBe(7);
    vi.useRealTimers();
  });
});

describe('Sertifikat', () => {
  it('level by share of stars', () => {
    expect(certificateLevel(90, 100)).toBe('oltin');
    expect(certificateLevel(60, 100)).toBe('kumush');
    expect(certificateLevel(10, 100)).toBe('bronza');
    expect(certificateLevel(0, 0)).toBe('bronza');
  });

  it('shows only name, grade, tier — no personal data — and a teacher signature line', () => {
    const p = setProfile(initialProgress(), { name: 'Aziza', grade: 3 });
    renderWithBobo(<Certificate progress={p} maxStars={63} date={new Date(2026, 4, 25)} />);
    expect(screen.getByText('Aziza')).toBeInTheDocument();
    expect(screen.getByText(/3-sinf, Kichik sayyoh/)).toBeInTheDocument();
    expect(screen.getByText(/O'qituvchi imzosi/)).toBeInTheDocument();
    expect(screen.getByText('Bronza daraja')).toBeInTheDocument();
  });
});

describe('Barcha to\'siqlar', () => {
  it.each(['ormon', 'daryo', 'qizilqum', 'tog', 'qala'])('%s: item can be used by tap-tap', async (id) => {
    const level = content.levels.find((l) => l.id === id)!;
    const item = content.items.find((i) => i.id === level.obstacle.requires)!;
    const onDone = vi.fn();
    renderWithBobo(<ObstacleScene level={level} item={item} onDone={onDone} animationMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: `${item.name}ni olish` }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`${level.obstacle.title}:`) }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });
});
