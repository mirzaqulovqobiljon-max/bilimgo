/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { audioFor, VoiceChannel, type Clip } from './voice';
import index from '../content/audio.uz.json';
import { BoboProvider, useBobo } from '../components/BoboProvider';
import { Bobo } from '../components/Bobo';
import { DevBattle, DEV_LINES } from '../components/DevBattle';
import { Riddle } from '../minigames/Riddle';
import { content } from '../test/utils';
import { seededRng } from '../engine/random';
import type { RiddleQuestion } from '../content/schema';

/** Soxta ijrochi: qaysi fayllar boshlangani va to'xtatilganini yozib boradi, tugashni qo'lda boshqaramiz. */
function fakeChannel(delay = 10) {
  const log: string[] = [];
  const live: { url: string; end: () => void; stopped: boolean }[] = [];
  const ch = new VoiceChannel(
    (url): Clip => {
      const c = { url, end: () => {}, stopped: false };
      live.push(c);
      return {
        play: async () => {
          log.push(url);
        },
        stop: () => {
          c.stopped = true;
        },
        onEnd: (fn) => {
          c.end = fn;
        },
      };
    },
    '',
    delay,
  );
  const finishCurrent = () => live.filter((c) => !c.stopped).at(-1)?.end();
  return { ch, log, live, finishCurrent };
}

describe('VoiceChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('now() interrupts the current clip', () => {
    const { ch, log, live } = fakeChannel();
    ch.now('a.mp3');
    ch.now('b.mp3');
    expect(log).toEqual(['a.mp3', 'b.mp3']);
    expect(live[0]!.stopped).toBe(true);
  });

  it('queue() waits for the current clip to end, then plays in order', () => {
    const { ch, log, finishCurrent } = fakeChannel();
    ch.now('bobo.mp3');
    ch.queue('q1.mp3');
    ch.queue('q2.mp3');
    vi.advanceTimersByTime(50);
    expect(log).toEqual(['bobo.mp3']);
    finishCurrent();
    expect(log).toEqual(['bobo.mp3', 'q1.mp3']);
    finishCurrent();
    expect(log).toEqual(['bobo.mp3', 'q1.mp3', 'q2.mp3']);
  });

  it('queue() on an idle channel starts after the short delay (lets a screen intro go first)', () => {
    const { ch, log, finishCurrent } = fakeChannel(300);
    ch.queue('q.mp3');
    ch.now('intro.mp3'); // ekran kirish gapi keyinroq keldi
    vi.advanceTimersByTime(300);
    expect(log).toEqual(['intro.mp3']);
    finishCurrent();
    expect(log).toEqual(['intro.mp3', 'q.mp3']);
  });

  it('stop() silences everything; clearQueue() keeps the current clip', () => {
    const { ch, log, live, finishCurrent } = fakeChannel();
    ch.now('a.mp3');
    ch.queue('b.mp3');
    ch.clearQueue();
    finishCurrent();
    expect(log).toEqual(['a.mp3']);
    ch.now('c.mp3');
    ch.queue('d.mp3');
    ch.stop();
    vi.advanceTimersByTime(100);
    expect(live.at(-1)!.stopped).toBe(true);
    expect(ch.busy).toBe(false);
    expect(log).toEqual(['a.mp3', 'c.mp3']);
  });
});

describe('recorded voice index', () => {
  const files = Object.values(index as Record<string, string>);
  const pub = join(__dirname, '../../public');

  it('every indexed clip exists, and there are no orphan files', () => {
    for (const f of files) expect(existsSync(join(pub, f)), f).toBe(true);
    const onDisk = readdirSync(join(pub, 'audio/uz')).filter((f) => f.endsWith('.mp3'));
    expect(onDisk.sort()).toEqual(files.map((f) => f.split('/').pop()!).sort());
  });

  it('every Bobo line is voiced', () => {
    for (const v of Object.values(content.bobo)) {
      for (const line of Array.isArray(v) ? v : [v]) expect(audioFor(line.text), line.text).toBeDefined();
    }
  });

  it('every kichik question, hint and prompt is voiced (7-10 yoshlilar o\'qishda qiynalishi mumkin)', () => {
    for (const t of content.tasks) {
      const c = t.tiers.kichik as Record<string, unknown> | undefined;
      if (!c) continue;
      const qs = (c.questions as { q: string; hint: string }[] | undefined) ?? [];
      for (const q of qs) {
        expect(audioFor(q.q), q.q).toBeDefined();
        expect(audioFor(q.hint), q.hint).toBeDefined();
      }
      for (const w of (c.words as { q: string }[] | undefined) ?? []) expect(audioFor(w.q), w.q).toBeDefined();
      if (typeof c.prompt === 'string') expect(audioFor(c.prompt), c.prompt).toBeDefined();
    }
  });

  it('every dev battle question (all tiers) and every dev line is voiced in the dev voice', () => {
    for (const l of content.levels) {
      const b = l.obstacle.battle;
      if (!b) continue;
      for (const tier of ['kichik', 'karvon', 'olim'] as const)
        for (const q of b[tier].questions) expect(audioFor(q.q, 'dev'), q.q).toBeDefined();
    }
    for (const line of Object.values(DEV_LINES)) expect(audioFor(line, 'dev'), line).toBeDefined();
  });

  it('dynamic lines built in code are voiced', () => {
    expect(audioFor("Hali hech biri o'z joyida emas. Almashtirib ko'r!")).toBeDefined();
    for (let n = 1; n <= 7; n++) expect(audioFor(`${n} tasi o'z joyida. Qolganini almashtirib ko'r!`)).toBeDefined();
    for (const it of content.items) expect(audioFor(`Avval sumkadagi ${it.name.toLowerCase()}ni ol.`), it.name).toBeDefined();
  });
});

describe('voice in the game', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(ui: React.ReactNode, muted = false) {
    const f = fakeChannel(0);
    render(
      <BoboProvider dict={content.bobo} rng={seededRng(1)} idleReminder={false} initialMuted={muted} channel={f.ch}>
        {ui}
        <Bobo />
      </BoboProvider>,
    );
    return f;
  }

  function SayButton({ k }: { k: string }) {
    const bobo = useBobo();
    return (
      <button type="button" onClick={() => bobo.say(k)}>
        say
      </button>
    );
  }

  it('Bobo speaks his line aloud; muted Bobo stays silent', () => {
    const f = setup(<SayButton k="bobo.locked" />);
    fireEvent.click(screen.getByText('say'));
    const line = content.bobo['bobo.locked'] as { text: string };
    expect(f.log).toEqual([audioFor(line.text)]);

    const g = setup(<SayButton k="bobo.locked" />, true);
    fireEvent.click(screen.getAllByText('say')[1]!);
    expect(g.log).toEqual([]);
  });

  const qs: RiddleQuestion[] = [
    { q: '2 + 3 = ?', options: ['5', '6'], answer: 0, hint: 'Barmoqlaringda sanab ko\'r.' },
  ];

  it('Riddle reads the question to kichik, and the 🔊 button works even when muted', () => {
    const f = setup(<Riddle content={{ questions: qs }} tier="kichik" onDone={() => {}} requestHint={() => true} delayMs={0} />);
    act(() => void vi.advanceTimersByTime(10));
    expect(f.log).toContain(audioFor('2 + 3 = ?'));

    const g = setup(<Riddle content={{ questions: qs }} tier="karvon" onDone={() => {}} requestHint={() => true} delayMs={0} />, true);
    act(() => void vi.advanceTimersByTime(10));
    expect(g.log).toEqual([]); // kattalarga avtomatik o'qilmaydi
    fireEvent.click(screen.getAllByRole('button', { name: "Savolni o'qib ber" })[1]!);
    expect(g.log).toEqual([audioFor('2 + 3 = ?')]);
  });

  it('the dev introduces himself and asks in his own voice', () => {
    const battleQs = content.levels.find((l) => l.obstacle.battle)!.obstacle.battle!.kichik.questions;
    const f = setup(<DevBattle tier="kichik" questions={battleQs} onDone={() => {}} delayMs={0} />);
    expect(screen.getByText(DEV_LINES.intro)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(10));
    expect(f.log[0]).toBe(audioFor(DEV_LINES.intro, 'dev'));
    f.finishCurrent();
    expect(f.log[1]).toBe(audioFor(battleQs[0]!.q, 'dev'));
  });
});
