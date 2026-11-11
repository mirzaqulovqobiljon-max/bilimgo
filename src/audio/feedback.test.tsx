import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceChannel, audioFor, type Clip } from './voice';
import { sfx, type SfxName } from './sfx';
import { BoboProvider, isReaction } from '../components/BoboProvider';
import { Bobo } from '../components/Bobo';
import { Memory } from '../minigames/Memory';
import { Riddle } from '../minigames/Riddle';
import { ObstacleScene, leafStyle, openKindFor } from '../components/ObstacleScene';
import { content } from '../test/utils';
import { seededRng } from '../engine/random';

function fakeChannel() {
  const log: string[] = [];
  const live: { url: string; end: () => void; stopped: boolean }[] = [];
  const ch = new VoiceChannel(
    (url): Clip => {
      const c = { url, end: () => {}, stopped: false };
      live.push(c);
      return {
        play: async () => void log.push(url),
        stop: () => void (c.stopped = true),
        onEnd: (fn) => void (c.end = fn),
      };
    },
    '',
    0,
  );
  const finish = () => live.filter((c) => !c.stopped).at(-1)?.end();
  return { ch, log, live, finish };
}

function recordSfx() {
  const played: SfxName[] = [];
  const off = sfx.onPlay((n) => played.push(n));
  return { played, off };
}

describe('Bobo reaksiyalari bo\'linmaydi (xato: "Barakalla" yarmida keyingi gap boshlanardi)', () => {
  it('protected praise finishes; the next stage line waits for it', () => {
    const { ch, log, live, finish } = fakeChannel();
    ch.say('barakalla.mp3', { protect: true });
    ch.say('kalit-tayyor.mp3', { protect: true });
    ch.say('bosqich-kirish.mp3');
    expect(live[0]!.stopped).toBe(false);
    expect(log).toEqual(['barakalla.mp3']);
    finish();
    finish();
    expect(log).toEqual(['barakalla.mp3', 'kalit-tayyor.mp3', 'bosqich-kirish.mp3']);
  });

  it('only the latest waiting reaction is kept (fast taps do not pile up)', () => {
    const { ch, log, finish } = fakeChannel();
    ch.say('p1.mp3', { protect: true });
    ch.say('p2.mp3', { protect: true });
    ch.say('p3.mp3', { protect: true });
    ch.say('p4.mp3', { protect: true });
    finish();
    finish();
    expect(log).toEqual(['p1.mp3', 'p4.mp3']);
  });

  it('a long intro or question can still be interrupted by a reaction', () => {
    const { ch, log, live } = fakeChannel();
    ch.say('uzun-kirish.mp3');
    ch.say('barakalla.mp3', { protect: true });
    expect(live[0]!.stopped).toBe(true);
    expect(log).toEqual(['uzun-kirish.mp3', 'barakalla.mp3']);
  });

  it('ifIdle lines are dropped while Bobo is talking', () => {
    const { ch, log, finish } = fakeChannel();
    ch.say('a.mp3', { protect: true });
    ch.say('b.mp3', { protect: true, ifIdle: true });
    finish();
    expect(log).toEqual(['a.mp3']);
    ch.say('c.mp3', { ifIdle: true });
    expect(log).toEqual(['a.mp3', 'c.mp3']);
  });

  it('reaction keys are recognised', () => {
    for (const k of ['bobo.praise', 'bobo.encourage', 'bobo.retry', 'bobo.part.won', 'bobo.kalit.won', 'bobo.ot-mesh.won', 'bobo.battle.won.kichik'])
      expect(isReaction(k), k).toBe(true);
    for (const k of ['bobo.ona-qishloq.intro', 'bobo.hint.offer', 'bobo.map.intro', 'bobo.idle']) expect(isReaction(k), k).toBe(false);
    expect(isReaction({ text: 'Savol' })).toBe(false);
  });
});

function setup(ui: React.ReactNode) {
  const f = fakeChannel();
  render(
    <BoboProvider dict={content.bobo} rng={seededRng(1)} idleReminder={false} channel={f.ch}>
      {ui}
      <Bobo />
    </BoboProvider>,
  );
  return f;
}

const mem = {
  pairs: [
    { a: '🐟', b: 'Suv' },
    { a: '🐦', b: 'Osmon' },
    { a: '🐻', b: "O'rmon" },
  ],
  hint: 'Har bir jonivor qayerda yashashini esla.',
};

describe('Tovush effektlari', () => {
  let rec: ReturnType<typeof recordSfx>;
  beforeEach(() => (rec = recordSfx()));
  afterEach(() => rec.off());

  it('memory: every tap clicks, a pair chimes, a mismatch gives a soft "hmm" — and Bobo does not pile up', async () => {
    const f = setup(<Memory content={mem} tier="kichik" onDone={() => {}} requestHint={() => true} rng={seededRng(2)} delayMs={0} />);
    const byPair = new Map<string, HTMLButtonElement[]>();
    document.querySelectorAll<HTMLButtonElement>('.mcard').forEach((b) => byPair.set(b.dataset.pair!, [...(byPair.get(b.dataset.pair!) ?? []), b]));
    const pairs = [...byPair.values()];
    await userEvent.click(pairs[0]![0]!);
    await userEvent.click(pairs[1]![0]!);
    await vi.waitFor(() => expect(document.querySelectorAll('.mcard.up, .mcard[aria-pressed="true"]').length).toBe(0));
    for (const [a, b] of pairs) {
      await userEvent.click(a!);
      await userEvent.click(b!);
    }
    expect(rec.played.filter((n) => n === 'tap')).toHaveLength(8);
    expect(rec.played.filter((n) => n === 'correct')).toHaveLength(3);
    expect(rec.played.filter((n) => n === 'wrong')).toHaveLength(1);
    // 3 ta juft tez topildi, lekin birinchi "barakalla" tugamagan — qolganlari ovozsiz (matnda ko'rinadi)
    expect(f.log).toHaveLength(1);
  });

  it('riddle: wrong then right answer', async () => {
    setup(
      <Riddle
        content={{ questions: [{ q: 'Savol?', options: ['ha', "yo'q"], answer: 1, hint: 'O\'yla.' }] }}
        tier="karvon"
        onDone={() => {}}
        requestHint={() => true}
        delayMs={0}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'ha' }));
    await userEvent.click(screen.getByRole('button', { name: "yo'q" }));
    expect(rec.played).toEqual(['wrong', 'correct']);
  });

  it('muted means silent effects too', async () => {
    sfx.setMuted(true);
    sfx.play('correct');
    sfx.setMuted(false);
    expect(rec.played).toEqual([]);
  });
});

describe('To\'siq ochilish animatsiyalari', () => {
  let rec: ReturnType<typeof recordSfx>;
  beforeEach(() => (rec = recordSfx()));
  afterEach(() => rec.off());

  it('gate → door, river → boat, the rest → magic', () => {
    const kinds = Object.fromEntries(content.levels.map((l) => [l.obstacle.type, openKindFor(l.obstacle.type)]));
    expect(kinds.gate).toBe('door');
    expect(kinds.river).toBe('boat');
    for (const t of ['dark', 'desert', 'cliff', 'castle']) if (kinds[t]) expect(kinds[t]).toBe('magic');
  });

  it.each([
    ['ona-qishloq', 'unlock', '.door-leaf'],
    ['daryo', 'water', '.anim-boat'],
    ['qizilqum', 'magic', '.spark'],
  ])('%s: plays %s and shows its animation', async (id, sound, selector) => {
    const level = content.levels.find((l) => l.id === id)!;
    const item = content.items.find((i) => i.id === level.obstacle.requires)!;
    const onDone = vi.fn();
    setup(<ObstacleScene level={level} item={item} onDone={onDone} animationMs={10_000} />);
    await userEvent.click(screen.getByRole('button', { name: `${item.name}ni olish` }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`${level.obstacle.title}:`) }));
    expect(rec.played).toEqual([sound]);
    expect(document.querySelector(selector)).not.toBeNull();
    if (selector === '.door-leaf') expect(document.querySelectorAll('.door-leaf')).toHaveLength(2);
  });

  it('door leaves show exactly their part of the gate picture', () => {
    // chap tabaqa: rasmning 22.5% dan boshlanadi, eni 34.5% -> o'lcham 289.86%, pozitsiya 22.5/65.5
    const l = leafStyle('x.webp', 'left');
    expect(parseFloat(l.backgroundSize)).toBeCloseTo((100 / 34.5) * 100, 1);
    expect(parseFloat(l.backgroundPosition)).toBeCloseTo((22.5 / 65.5) * 100, 1);
    const r = leafStyle('x.webp', 'right');
    expect(parseFloat(r.backgroundPosition)).toBeCloseTo((57 / 65.5) * 100, 1);
  });
});

describe('Ovozlar hali ham joyida', () => {
  it('the praise lines have recordings', () => {
    const praise = content.bobo['bobo.praise'];
    for (const p of Array.isArray(praise) ? praise : [praise]) expect(audioFor(p!.text)).toBeDefined();
  });
});
