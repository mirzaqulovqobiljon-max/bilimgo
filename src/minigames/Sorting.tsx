import { useEffect, useRef, useState } from 'react';
import { useBobo } from '../components/BoboProvider';
import { MISTAKES_BEFORE_HINT } from '../engine/rules';
import { scramble } from '../engine/random';
import type { MiniGameProps } from './types';

/**
 * Tartiblash: voqealar, sonlar, taxtalar og'irligi...
 * Bosish orqali: elementni bos, keyin joyini bos (yoki ▲▼).
 * "Tekshirish"dan keyin to'g'ri joydagilar yashil bo'lib qotadi — qolganini bola o'zi topadi.
 */
export function Sorting({ content, tier, onDone, requestHint, rng = Math.random, delayMs = 700 }: MiniGameProps<'sorting'>) {
  const bobo = useBobo();
  const [order, setOrder] = useState<number[]>(() => scramble(content.items.length, rng));
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongChecks, setWrongChecks] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [done, setDone] = useState(false);
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current, allowance: 1 }), delayMs);
    return () => clearTimeout(t);
  }, [done, delayMs]);

  /** Qotgan (to'g'ri) elementlarga tegmasdan, `from`dagi elementni `to` pozitsiyaga ko'chiradi. */
  const move = (from: number, to: number) => {
    if (from === to || locked.has(from) || locked.has(to)) return;
    const free = order.map((_, i) => i).filter((i) => !locked.has(i));
    const vals = free.map((i) => order[i]!);
    const fi = free.indexOf(from);
    const ti = free.indexOf(to);
    const [item] = vals.splice(fi, 1);
    vals.splice(ti, 0, item!);
    const next = [...order];
    free.forEach((pos, k) => (next[pos] = vals[k]!));
    setOrder(next);
  };

  const tap = (pos: number) => {
    if (done || locked.has(pos)) return;
    if (selected === null) setSelected(pos);
    else {
      move(selected, pos);
      setSelected(null);
    }
  };

  const nudge = (pos: number, delta: -1 | 1) => {
    let to = pos + delta;
    while (locked.has(to)) to += delta;
    if (to < 0 || to >= order.length) return;
    move(pos, to);
  };

  const check = () => {
    const right = new Set(order.map((item, pos) => (item === pos ? pos : -1)).filter((p) => p >= 0));
    setLocked(right);
    setSelected(null);
    if (right.size === order.length) {
      setDone(true);
      bobo.say('bobo.praise');
      return;
    }
    mistakes.current += 1;
    const n = wrongChecks + 1;
    setWrongChecks(n);
    bobo.say(
      n === MISTAKES_BEFORE_HINT
        ? 'bobo.hint.offer'
        : { text: `${right.size} tasi o'z joyida. Qolganini almashtirib ko'r!` },
    );
  };

  const hint = () => {
    setHintUsed(true);
    bobo.say(requestHint() ? { text: content.hint } : 'bobo.hint.none');
  };

  return (
    <section className={`sorting tier-${tier}`} aria-label="Tartiblash">
      <h2 className="sorting-prompt">{content.prompt}</h2>
      <p className="sort-label">⬆ {content.topLabel}</p>
      <ol className="sort-list">
        {order.map((item, pos) => {
          const isLocked = locked.has(pos);
          return (
            <li key={item} className={`sort-item${isLocked ? ' locked' : ''}${selected === pos ? ' selected' : ''}`}>
              <button
                type="button"
                className="sort-main"
                onClick={() => tap(pos)}
                aria-pressed={selected === pos}
                aria-label={`${pos + 1}-o'rin: ${content.items[item]}${isLocked ? ', to\'g\'ri' : ''}`}
                data-item={item}
                data-pos={pos}
              >
                <span className="sort-pos">{pos + 1}</span> {content.items[item]}
              </button>
              {!isLocked && !done && (
                <span className="sort-arrows">
                  <button type="button" onClick={() => nudge(pos, -1)} aria-label={`${content.items[item]} yuqoriga`}>▲</button>
                  <button type="button" onClick={() => nudge(pos, 1)} aria-label={`${content.items[item]} pastga`}>▼</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sort-label">⬇ {content.bottomLabel}</p>
      {!done && (
        <div className="sort-actions">
          <button type="button" className="btn primary big" onClick={check}>
            Tekshirish
          </button>
          {wrongChecks >= MISTAKES_BEFORE_HINT && !hintUsed && (
            <button type="button" className="btn hint" onClick={hint}>
              💡 Maslahat
            </button>
          )}
        </div>
      )}
    </section>
  );
}
