import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import type { Tier } from '../../content/schema';
import { shuffle, type Rng } from '../../engine/random';
import { useBobo } from '../BoboProvider';

export const RUNES = ['☀', '☾', '★', '◆', '✿', '❖'] as const;
export const RUNE_LEN: Record<Tier, number> = { kichik: 3, karvon: 4, olim: 5 };
/** Olimda ketma-ketlik shuncha soniyadan keyin yashiriladi (xotira sinovi); bir marta qayta ko'rish mumkin. */
export const RUNE_SHOW_MS = 4000;

export function makeRuneSequence(tier: Tier, rng: Rng): string[] {
  return shuffle([...RUNES], rng).slice(0, RUNE_LEN[tier]);
}

/**
 * 3-faza: dev sehrli doirasidagi belgilarni xuddi shu tartibda bosish — sehr sinadi.
 * Xato bosilsa — yumshoq signal, kiritilgan qism tozalanadi, yana urinadi (+1 xato).
 */
export function RunePhase({ tier, rng = Math.random, onDone }: { tier: Tier; rng?: Rng; onDone(misses: number): void }) {
  const bobo = useBobo();
  const target = useMemo(() => makeRuneSequence(tier, rng), [tier, rng]);
  const options = useMemo(() => shuffle([...RUNES], rng), [rng]);
  const [input, setInput] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [wrong, setWrong] = useState(false);
  const misses = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = input.length === target.length;

  useEffect(() => {
    if (tier !== 'olim' || hidden) return;
    const t = setTimeout(() => setHidden(true), RUNE_SHOW_MS);
    return () => clearTimeout(t);
  }, [tier, hidden]);

  useEffect(() => {
    if (!finished) return;
    sfx.play('magic');
    const t = setTimeout(() => doneRef.current(misses.current), 700);
    return () => clearTimeout(t);
  }, [finished]);

  const press = (r: string) => {
    if (finished) return;
    if (target[input.length] === r) {
      sfx.play('tap');
      setInput([...input, r]);
      return;
    }
    misses.current += 1;
    sfx.play('wrong');
    setWrong(true);
    setTimeout(() => setWrong(false), 400);
    setInput([]);
    bobo.say('bobo.battle.rune.wrong', undefined, { ifIdle: true });
  };

  return (
    <div className="phase-runes" data-target={target.join('')}>
      <p className="phase-goal" role="status">
        ✨ Dev sehridagi belgilarni shu tartibda bos
      </p>
      <div className={`rune-circle${wrong ? ' wrong' : ''}`} aria-label="Sehrli belgilar ketma-ketligi">
        {target.map((r, i) => (
          <span key={i} className={`rune-slot${i < input.length ? ' lit' : ''}`}>
            {hidden && i >= input.length ? '?' : r}
          </span>
        ))}
      </div>
      {tier === 'olim' && hidden && !peeked && !finished && (
        <button type="button" className="btn small ghost" onClick={() => (setHidden(false), setPeeked(true))}>
          👁 Yana bir bor ko'rsat
        </button>
      )}
      <div className="rune-pad">
        {options.map((r) => (
          <button key={r} type="button" className="rune-btn" aria-label={`Belgi ${r}`} onClick={() => press(r)} disabled={finished}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
