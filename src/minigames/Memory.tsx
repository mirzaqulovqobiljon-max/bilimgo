import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { useBobo } from '../components/BoboProvider';
import { shuffle } from '../engine/random';
import { MISTAKES_BEFORE_HINT } from '../engine/rules';
import type { MiniGameProps } from './types';
import { img } from '../assets';

interface Card {
  id: number;
  pair: number;
  face: string;
}

/**
 * Xotira kartalari. Xato faqat "bilishi kerak edi" holatda hisoblanadi:
 * ochilgan kartalardan biri avval ko'rilgan bo'lsa. Birinchi marta ko'rish — bu xato emas.
 */
export function Memory({ content, tier, onDone, requestHint, rng = Math.random, delayMs = 900 }: MiniGameProps<'memory'>) {
  const bobo = useBobo();
  const cards = useMemo<Card[]>(
    () =>
      shuffle(
        content.pairs.flatMap((p, i) => [
          { id: i * 2, pair: i, face: p.a },
          { id: i * 2 + 1, pair: i, face: p.b },
        ]),
        rng,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content],
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [peek, setPeek] = useState<number[]>([]);
  const [realMistakes, setRealMistakes] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const seen = useRef(new Set<number>());
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const done = matched.length === cards.length;

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((id) => cards.find((c) => c.id === id)!) as [Card, Card];
    if (a.pair === b.pair) {
      setMatched((m) => [...m, a.id, b.id]);
      setOpen([]);
      sfx.play('correct');
      // har juftda gapirsa, tez o'ynaganda gaplar to'planib qoladi — faqat bobo jim bo'lsa
      bobo.say('bobo.praise', undefined, { ifIdle: true });
      return;
    }
    const knewIt = seen.current.has(a.id) || seen.current.has(b.id);
    seen.current.add(a.id);
    seen.current.add(b.id);
    sfx.play('wrong');
    if (knewIt) {
      mistakes.current += 1;
      const n = realMistakes + 1;
      setRealMistakes(n);
      if (n === MISTAKES_BEFORE_HINT) bobo.say('bobo.hint.offer');
      else bobo.say('bobo.encourage', undefined, { ifIdle: true });
    }
    const t = setTimeout(() => setOpen([]), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current, allowance: content.pairs.length }), delayMs);
    return () => clearTimeout(t);
  }, [done, delayMs, content.pairs.length]);

  const flip = (id: number) => {
    if (open.length >= 2 || open.includes(id) || matched.includes(id)) return;
    sfx.play('tap');
    setOpen([...open, id]);
  };

  /** Maslahat: bitta topilmagan juftni bir lahzaga ko'rsatadi (javobni o'zi ochmaydi). */
  const hint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    setHintUsed(true);
    bobo.say({ text: content.hint }, 'oylaydi');
    const pair = cards.find((c) => !matched.includes(c.id))!.pair;
    const ids = cards.filter((c) => c.pair === pair).map((c) => c.id);
    setPeek(ids);
    setTimeout(() => setPeek([]), Math.max(delayMs * 2, 0));
  };

  const cols = cards.length <= 8 ? 4 : cards.length <= 12 ? 4 : 4;

  return (
    <section className={`memory tier-${tier}`} aria-label="Xotira kartalari">
      <p className="muted center">Juftini top: {matched.length / 2} / {content.pairs.length}</p>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map((c) => {
          const up = open.includes(c.id) || matched.includes(c.id) || peek.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`mcard${up ? ' up' : ''}${matched.includes(c.id) ? ' matched' : ''}`}
              style={up ? undefined : { backgroundImage: `url(${img.cardBack})` }}
              onClick={() => flip(c.id)}
              aria-label={up ? c.face : 'Yopiq karta'}
              data-pair={c.pair}
              disabled={matched.includes(c.id)}
            >
              <span className="mcard-face">{up ? c.face : ''}</span>
            </button>
          );
        })}
      </div>
      {realMistakes >= MISTAKES_BEFORE_HINT && !hintUsed && !done && (
        <button type="button" className="btn hint" onClick={hint}>
          💡 Maslahat
        </button>
      )}
    </section>
  );
}
