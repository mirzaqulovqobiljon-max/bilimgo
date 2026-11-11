import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BoboDict, BoboLine } from '../content/schema';
import { IDLE_REMINDER_MS } from '../engine/rules';
import { pickIndex, type Rng } from '../engine/random';
import type { BoboMood } from '../assets';

/**
 * Bobo qaysi holatda chiqadi (rasm tanlash uchun). Kalit nomidan aniqlanadi;
 * tayyor matnlar uchun (masalan topshiriq maslahati) chaqiruvchi o'zi beradi.
 */
export function moodFor(what: string | BoboLine): BoboMood {
  if (typeof what !== 'string') return 'gapiradi';
  if (/praise|\.won|bonus|outro/.test(what)) return 'maqtaydi';
  if (/hint/.test(what)) return 'oylaydi';
  if (/^bobo\.[a-z0-9-]+\.[a-z0-9-]+$/.test(what) && !/^bobo\.(map|battle|part|hint)\./.test(what)) return 'korsatadi';
  return 'gapiradi';
}

export interface BoboApi {
  /** Lug'atdan kalit bo'yicha yoki tayyor matn bilan gapirtiradi. */
  say(what: string | BoboLine, mood?: BoboMood): void;
  /** "Bobo" tugmasi bosilganda nima bo'lishini joriy ekran belgilaydi (odatda qoidani takrorlash). */
  setHelp(fn: (() => void) | null): void;
  help(): void;
  current: BoboLine | null;
  mood: BoboMood;
  muted: boolean;
  toggleMute(): void;
}

const Ctx = createContext<BoboApi | null>(null);

export function useBobo(): BoboApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBobo BoboProvider ichida ishlatilishi kerak');
  return v;
}

interface Props {
  dict: BoboDict;
  rng?: Rng;
  /** Jim turish eslatmasi (ro'yxatdan o'tish ekranida o'chiriladi). */
  idleReminder?: boolean;
  /** 7-10 yoshlilar uchun ovoz yoqilgan, kattalar uchun ixtiyoriy. */
  initialMuted?: boolean;
  children: ReactNode;
}

export function BoboProvider({ dict, rng = Math.random, idleReminder = true, initialMuted = false, children }: Props) {
  const [current, setCurrent] = useState<BoboLine | null>(null);
  const [mood, setMood] = useState<BoboMood>('gapiradi');
  const [muted, setMuted] = useState(initialMuted);
  const helpRef = useRef<(() => void) | null>(null);
  const lastPick = useRef(new Map<string, number>());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resolve = useCallback(
    (what: string | BoboLine): BoboLine => {
      if (typeof what !== 'string') return what;
      const phrase = dict[what];
      if (!phrase) {
        console.warn(`Bobo gapi topilmadi: ${what}`);
        return { text: '…' };
      }
      if (!Array.isArray(phrase)) return phrase;
      const i = pickIndex(phrase.length, rng, lastPick.current.get(what));
      lastPick.current.set(what, i);
      return phrase[i]!;
    },
    [dict, rng],
  );

  const say = useCallback(
    (what: string | BoboLine, m?: BoboMood) => {
      setCurrent(resolve(what));
      setMood(m ?? moodFor(what));
    },
    [resolve],
  );

  // Ovoz: MP3 bo'lsa ijro etamiz. Hozircha yozuvlar yo'q (ochiq savol) — faqat matn ko'rinadi.
  useEffect(() => {
    audioRef.current?.pause();
    if (!current?.audio || muted || typeof Audio === 'undefined') return;
    const a = new Audio(current.audio);
    audioRef.current = a;
    a.play().catch(() => {
      /* fayl yo'q yoki brauzer avtoijroni blokladi — matn baribir ko'rinadi */
    });
  }, [current, muted]);

  // 30 soniya jimlik — bobo eslatadi.
  useEffect(() => {
    if (!idleReminder) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setCurrent(resolve('bobo.idle'));
        setMood('korsatadi');
      }, IDLE_REMINDER_MS);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [idleReminder, resolve]);

  const api = useMemo<BoboApi>(
    () => ({
      say,
      setHelp: (fn) => {
        helpRef.current = fn;
      },
      help: () => (helpRef.current ? helpRef.current() : say('bobo.idle')),
      current,
      mood,
      muted,
      toggleMute: () => setMuted((m) => !m),
    }),
    [say, current, mood, muted],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Ekran ochilganda bobo gapiradi va "Bobo" tugmasi uchun yordamni ro'yxatdan o'tkazadi. */
export function useBoboScreen(intro: string | BoboLine | null, help?: string | BoboLine) {
  const bobo = useBobo();
  const introKey = typeof intro === 'string' ? intro : intro?.text;
  const helpKey = typeof help === 'string' ? help : help?.text;
  useEffect(() => {
    if (intro) bobo.say(intro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey]);
  useEffect(() => {
    const target = help ?? intro;
    bobo.setHelp(target ? () => bobo.say(target) : null);
    return () => bobo.setHelp(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpKey, introKey, bobo.say]);
}
