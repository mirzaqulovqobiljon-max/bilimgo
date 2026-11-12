import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryVideo } from './StoryVideo';
import { INTRO, IntroScriptSchema, LINE_GAP_MS, OUTRO, SCENE_TAIL_MS, estimateTotalMs, minShowMs, readingMs } from './script';
import { audioFor, type ClipFactory } from '../audio/voice';
import { sfx, type SfxName } from '../audio/sfx';
import { App } from '../App';
import { content } from '../test/utils';
import { createLocalStore } from '../engine/storage';
import { seededRng } from '../engine/random';
import { initialProgress, markIntroSeen, setProfile, shouldAutoplayIntro } from '../engine/progress';
import { mergeProgress } from '../engine/merge';

vi.mock('../components/map/phaserMap', () => ({ createMap: vi.fn(() => ({ destroy: vi.fn() })) }));

const PUBLIC = resolve(__dirname, '../../public');

/** Soxta ovoz ijrochisi: qaysi fayllar chalinganini yozadi, tugashini test boshqaradi. */
function fakeClips() {
  const played: string[] = [];
  const stopped: string[] = [];
  let endCurrent: (() => void) | null = null;
  const factory: ClipFactory = (url) => {
    let onEnd = () => {};
    return {
      play: async () => {
        played.push(url);
        endCurrent = () => onEnd();
      },
      stop: () => stopped.push(url),
      onEnd: (fn) => {
        onEnd = fn;
      },
    };
  };
  return { factory, played, stopped, end: () => act(() => endCurrent?.()) };
}

const allLines = (s: typeof INTRO) => s.scenes.flatMap((sc) => sc.lines);

describe('ertak ssenariysi (story.uz.json)', () => {
  it("o'yin boshi: qishloq -> kitob -> dev -> homush -> bobo; oxiri: kechirim -> bayram", () => {
    expect(INTRO.scenes.map((s) => s.id)).toEqual(['qishloq', 'kitob', 'dev', 'homush', 'bobo']);
    expect(OUTRO.scenes.map((s) => s.id)).toEqual(['kechirim', 'bayram']);
    expect(allLines(INTRO).at(-2)!.text).toBe('Bolam, sen bizga yordam ber!');
  });

  it('har bir gapning yozilgan ovozi va har bir rasm fayli bor', () => {
    for (const script of [INTRO, OUTRO]) {
      for (const sc of script.scenes) {
        expect(existsSync(resolve(PUBLIC, sc.bg)), sc.bg).toBe(true);
        for (const l of sc.lines) {
          const f = audioFor(l.text, l.voice);
          expect(f, l.text).toBeDefined();
          expect(existsSync(resolve(PUBLIC, f!)), f).toBe(true);
        }
      }
    }
    for (const f of ['dev/tutun', 'dev/kuladi', 'dev/uchadi', 'dev/kechirim', 'dev/oddiy', 'dev/zarba', 'bobo/chaqiradi', 'intro/kitob'])
      expect(existsSync(resolve(PUBLIC, `img/${f}.webp`)), f).toBe(true);
  });

  it('kichiklar qoidasi: gapda 10 tadan kam so\'z; uzun gap sxemada rad etiladi', () => {
    const bad = { scenes: [INTRO.scenes[0], { ...INTRO.scenes[1], lines: [{ voice: 'bobo', text: 'Bir ikki uch to\'rt besh olti yetti sakkiz to\'qqiz o\'n.' }] }] };
    const r = IntroScriptSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('gap juda uzun');
  });

  it("video qisqa: 1 daqiqadan oshmaydi (bolalar zerikmasin)", () => {
    expect(estimateTotalMs(INTRO)).toBeLessThan(60_000);
    expect(estimateTotalMs(OUTRO)).toBeLessThan(30_000);
  });
});

describe('StoryVideo', () => {
  let sounds: SfxName[];
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    sfx.setMuted(false);
    sounds = [];
    off = sfx.onPlay((n) => sounds.push(n));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  const renderVideo = (clips = fakeClips(), onDone = vi.fn()) => {
    render(
      <StoryVideo script={INTRO} onDone={onDone} title="Ipak yo'li sarguzashti" endLabel="Ha, yo'lga chiqamiz!" ariaLabel="Ertak" clipFactory={clips.factory} base="/" />,
    );
    return { clips, onDone };
  };
  const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const sub = () => document.querySelector('.story-sub p')?.textContent;
  const scene = () => document.querySelector('.story-frame')?.getAttribute('data-scene');

  it("boshlash tugmasi bosilmaguncha ovoz chiqmaydi (brauzer avtoijroni bloklamasin)", () => {
    const { clips } = renderVideo();
    expect(screen.getByRole('button', { name: "▶ Ertakni ko'rish" })).toBeInTheDocument();
    tick(10_000);
    expect(clips.played).toEqual([]);
  });

  it("butun ertakni ovoz bilan tartibda ijro etadi, oxirida 'Yo'lga chiqamiz'", async () => {
    const { clips, onDone } = renderVideo();
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    const lines = allLines(INTRO);
    for (const [i, l] of lines.entries()) {
      // dev sahnasi: gap animatsiya boshlangach (leadMs) chiqadi
      if (sub() !== l.text) tick(3000);
      expect(sub()).toBe(l.text);
      expect(clips.played[i]).toBe('/' + audioFor(l.text, l.voice));
      tick(minShowMs(l.text));
      clips.end();
      tick(LINE_GAP_MS + SCENE_TAIL_MS + 6500);
    }
    expect(clips.played).toHaveLength(lines.length);
    expect(sounds).toEqual(expect.arrayContaining(['magic', 'thunder', 'whoosh']));
    const go = screen.getByRole('button', { name: "Ha, yo'lga chiqamiz!" });
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(go);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("dev sahnasida gap kitob o'g'irlangandan keyin chiqadi; sahna animatsiya tugaguncha davom etadi", () => {
    const { clips } = renderVideo();
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    // 3 ta gapni tez o'tkazamiz
    for (let i = 0; i < 3; i++) {
      tick(minShowMs('x'.repeat(60)));
      clips.end();
      tick(LINE_GAP_MS + SCENE_TAIL_MS);
    }
    expect(scene()).toBe('dev');
    const dev = INTRO.scenes[2]!;
    expect(sub()).toBeUndefined();
    tick(dev.leadMs! - 10);
    expect(sub()).toBeUndefined();
    tick(20);
    expect(sub()).toBe(dev.lines[0]!.text);
    tick(minShowMs(dev.lines[0]!.text));
    clips.end(); // ovoz tez tugadi — lekin dev hali uchib ketmagan
    tick(SCENE_TAIL_MS);
    expect(scene()).toBe('dev');
    tick(dev.minMs!);
    expect(scene()).toBe('homush');
  });

  it("ovoz bloklansa (play darhol tugasa) ham matn o'qib ulgurilguncha turadi", () => {
    const clips = fakeClips();
    const instant: ClipFactory = (url) => {
      const c = clips.factory(url);
      let fn = () => {};
      return { ...c, onEnd: (f: () => void) => (fn = f), play: async () => fn() };
    };
    renderVideo({ ...clips, factory: instant });
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    const first = INTRO.scenes[0]!.lines[0]!.text;
    tick(minShowMs(first) - 100);
    expect(sub()).toBe(first);
    expect(scene()).toBe('qishloq');
  });

  it("ovozsiz rejim: fayl chalinmaydi, gaplar o'qish vaqti bilan almashadi", () => {
    const { clips } = renderVideo();
    fireEvent.click(screen.getByRole('button', { name: "Ovozni o'chirish" }));
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    const [a, b] = INTRO.scenes[1]!.lines;
    tick(readingMs(INTRO.scenes[0]!.lines[0]!.text) + SCENE_TAIL_MS + 10);
    expect(sub()).toBe(a!.text);
    tick(readingMs(a!.text) + LINE_GAP_MS + 10);
    expect(sub()).toBe(b!.text);
    expect(clips.played).toEqual([]);
    expect(sounds).toEqual([]);
  });

  it("o'tkazib yuborish: ovoz to'xtaydi va darhol davom etadi", () => {
    const { clips, onDone } = renderVideo();
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    expect(clips.played).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /O'tkazib yuborish/ }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(clips.stopped).toContain(clips.played[0]);
  });

  it("o'rtada ovozni o'chirsa — gap to'xtaydi, video qotib qolmaydi", () => {
    const { clips } = renderVideo();
    fireEvent.click(screen.getByRole('button', { name: "▶ Ertakni ko'rish" }));
    tick(minShowMs(INTRO.scenes[0]!.lines[0]!.text));
    fireEvent.click(screen.getByRole('button', { name: "Ovozni o'chirish" }));
    expect(clips.stopped).toHaveLength(1);
    tick(SCENE_TAIL_MS + 10);
    expect(scene()).toBe('kitob');
    expect(clips.played).toHaveLength(1);
  });
});

describe("o'yinda ertak", () => {
  it('progress: introSeen eski saqlanganlarga false, birlashtirishda yo\'qolmaydi', () => {
    const p = setProfile(initialProgress(), { name: 'Ali', grade: 2 });
    expect(shouldAutoplayIntro(p)).toBe(true);
    const seen = markIntroSeen(p);
    expect(shouldAutoplayIntro(seen)).toBe(false);
    expect(mergeProgress(p, seen).introSeen).toBe(true);
    expect(mergeProgress(seen, p).introSeen).toBe(true);
    // allaqachon o'ynayotgan o'yinchiga avtomatik chiqmaydi
    expect(shouldAutoplayIntro({ ...p, completedLevels: ['ona-qishloq'] })).toBe(false);
  });

  it("yangi o'yinchi: ro'yxatdan o'tgach ertak chiqadi, ko'rilgach qayta chiqmaydi, xaritadan qayta ko'rish mumkin", async () => {
    const u = userEvent.setup();
    const store = createLocalStore();
    const { unmount } = render(<App content={content} store={store} rng={seededRng(1)} delayMs={0} />);
    await u.type(screen.getByLabelText('Isming'), 'Aziza');
    await u.click(screen.getByRole('button', { name: /^2$/ }));
    await u.click(screen.getByRole('button', { name: 'Sayohatni boshlash' }));
    expect(screen.getByRole('dialog', { name: "Ertak: o'yin boshlanishi" })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /O'tkazib yuborish/ }));
    expect(screen.queryByRole('dialog', { name: /Ertak/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('navigation', { name: 'Bosqichlar' })).toBeInTheDocument();
    expect(store.load().introSeen).toBe(true);

    unmount();
    render(<App content={content} store={store} rng={seededRng(1)} delayMs={0} />);
    expect(screen.queryByRole('dialog', { name: /Ertak/ })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: "▶ Ertakni qayta ko'rish" }));
    expect(screen.getByRole('dialog', { name: "Ertak: o'yin boshlanishi" })).toBeInTheDocument();
  });
});
