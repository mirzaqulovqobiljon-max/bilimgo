import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useBobo } from '../components/BoboProvider';
import { MISTAKES_BEFORE_HINT } from '../engine/rules';
import { layoutCrossword, sameAnswer, wordCells } from './crosswordLayout';
import type { MiniGameProps } from './types';

/**
 * Krossvord. Telefonda katakma-katak yozish qiyin, shuning uchun:
 * savolni bosasan -> katta maydonga javobni yozasan -> to'g'ri bo'lsa to'rga tushadi.
 * Kesishgan harflar boshqa so'zlarga yordam beradi. 2 xatodan keyin maslahat: birinchi harf ochiladi.
 */
export function Crossword({ content, tier, onDone, requestHint, delayMs = 700 }: MiniGameProps<'crossword'>) {
  const bobo = useBobo();
  const grid = useMemo(() => layoutCrossword(content.words.map((w) => w.a)), [content.words]);
  const [solved, setSolved] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<number>(grid.placements[0]!.index);
  const [input, setInput] = useState('');
  const [wrongCount, setWrongCount] = useState<Record<number, number>>({});
  const [hinted, setHinted] = useState<Set<number>>(new Set());
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const inputRef = useRef<HTMLInputElement>(null);

  const done = solved.length === content.words.length;
  const solvedCells = useMemo(() => {
    const s = new Set<string>();
    for (const p of grid.placements) if (solved.includes(p.index)) wordCells(p).forEach((c) => s.add(c));
    return s;
  }, [grid, solved]);
  const activeCells = useMemo(() => {
    const p = grid.placements.find((x) => x.index === active);
    return new Set(p ? wordCells(p) : []);
  }, [grid, active]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current, allowance: content.words.length }), delayMs);
    return () => clearTimeout(t);
  }, [done, delayMs, content.words.length]);

  // Katta to'rda faol so'z ko'rinadigan joyga suriladi.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = grid.placements.find((x) => x.index === active);
    if (!p) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-k="${wordCells(p)[0]}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [active, grid]);

  const select = (index: number) => {
    if (solved.includes(index)) return;
    setActive(index);
    setInput('');
    inputRef.current?.focus({ preventScroll: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const word = content.words[active]!;
    if (!input.trim()) return;
    if (sameAnswer(input, word.a)) {
      const next = [...solved, active];
      setSolved(next);
      setInput('');
      bobo.say('bobo.praise');
      const nextWord = grid.placements.find((p) => !next.includes(p.index));
      if (nextWord) setActive(nextWord.index);
      return;
    }
    mistakes.current += 1;
    const n = (wrongCount[active] ?? 0) + 1;
    setWrongCount({ ...wrongCount, [active]: n });
    bobo.say(n === MISTAKES_BEFORE_HINT ? 'bobo.hint.offer' : 'bobo.encourage');
  };

  const hint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    const p = grid.placements.find((x) => x.index === active)!;
    const first = wordCells(p)[0]!;
    setRevealed(new Set([...revealed, first]));
    setHinted(new Set([...hinted, active]));
    bobo.say({ text: `Bu so'z "${p.tokens[0]}" harfi bilan boshlanadi.` });
  };

  const activeWord = content.words[active]!;
  const activePlacement = grid.placements.find((p) => p.index === active)!;
  const showHint = (wrongCount[active] ?? 0) >= MISTAKES_BEFORE_HINT && !hinted.has(active) && !done;
  const numberAt = new Map(grid.placements.map((p) => [`${p.row},${p.col}`, p.number]));

  return (
    <section className={`crossword tier-${tier}`} aria-label="Krossvord">
      {!done && (
        <form className="cw-answer" onSubmit={submit}>
          <p className="cw-clue">
            {activeWord.picture && <span className="cw-pic" aria-hidden="true">{activeWord.picture}</span>}
            <b>
              {activePlacement.number}. {activePlacement.dir === 'across' ? '→' : '↓'}
            </b>{' '}
            {activeWord.q} <span className="muted">({activePlacement.tokens.length} harf)</span>
          </p>
          <div className="cw-row">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Javob"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={activePlacement.tokens.length * 2}
            />
            <button type="submit" className="btn primary">
              Tekshirish
            </button>
          </div>
          {showHint && (
            <button type="button" className="btn hint" onClick={hint}>
              💡 Maslahat
            </button>
          )}
        </form>
      )}

      {grid.cols > 12 && <p className="cw-swipe muted">↔ To'rni barmoq bilan surib ko'rish mumkin</p>}
      <div className="cw-scroll" ref={scrollRef}>
      <div
        className="cw-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          // barmoq tegishi uchun katak kamida 26px; katta to'r yon tomonga suriladi
          width: `max(min(100%, 420px), ${grid.cols * 26}px)`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: grid.rows * grid.cols }, (_, i) => {
          const r = Math.floor(i / grid.cols);
          const c = i % grid.cols;
          const k = `${r},${c}`;
          const letter = grid.cells.get(k);
          if (letter === undefined) return <span key={k} className="cw-cell empty" />;
          const show = solvedCells.has(k) || revealed.has(k);
          return (
            <span key={k} data-k={k} className={`cw-cell${activeCells.has(k) ? ' active' : ''}${solvedCells.has(k) ? ' solved' : ''}`}>
              {numberAt.has(k) && <small>{numberAt.get(k)}</small>}
              {show ? letter : ''}
            </span>
          );
        })}
      </div>
      </div>

      <ol className="cw-clues" aria-label="Savollar">
        {grid.placements.map((p) => (
          <li key={p.index}>
            <button
              type="button"
              className={`cw-clue-btn${p.index === active ? ' on' : ''}${solved.includes(p.index) ? ' done' : ''}`}
              onClick={() => select(p.index)}
              disabled={solved.includes(p.index)}
              aria-label={`${p.number} ${p.dir === 'across' ? 'gorizontal' : 'vertikal'}: ${content.words[p.index]!.q}${solved.includes(p.index) ? ' — topildi' : ''}`}
            >
              <b>{p.number}{p.dir === 'across' ? '→' : '↓'}</b> {content.words[p.index]!.q}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
