import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useBobo } from '../components/BoboProvider';
import { pictureUrl } from '../content/pictures';
import { scramble } from '../engine/random';
import type { MiniGameProps } from './types';

const DRAG_THRESHOLD_PX = 8;

export function solvedCount(order: readonly number[]): number {
  return order.filter((p, i) => p === i).length;
}

/**
 * Rasmli puzzle (4/9/16/25 bo'lak). Ikki usul:
 *  - bosish: bitta bo'lakni bos, keyin ikkinchisini — o'rni almashadi (7 yoshlilar uchun eng oson);
 *  - sudrash: bo'lakni boshqasining ustiga olib borib qo'yish.
 * O'z joyiga tushgan bo'lak qotib qoladi (yashil chegara).
 */
export function Puzzle({ content, tier, onDone, rng = Math.random, delayMs = 700 }: MiniGameProps<'puzzle'>) {
  const bobo = useBobo();
  const n = Math.round(Math.sqrt(content.pieces));
  const [order, setOrder] = useState(() => scramble(content.pieces, rng));
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState(tier === 'kichik');
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const drag = useRef<{ cell: number; x: number; y: number; moved: boolean; el: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const url = useMemo(() => pictureUrl(content.image), [content.image]);
  const solved = solvedCount(order) === order.length;

  useEffect(() => {
    if (!solved) return;
    bobo.say('bobo.praise');
    const t = setTimeout(
      () => onDoneRef.current({ mistakes: mistakes.current, allowance: Math.ceil(content.pieces / 4) }),
      delayMs,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const swap = (a: number, b: number) => {
    if (a === b || order[a] === a || order[b] === b) return;
    const next = [...order];
    [next[a], next[b]] = [next[b]!, next[a]!];
    if (next[a] !== a && next[b] !== b) mistakes.current += 1;
    setOrder(next);
  };

  const tap = (cell: number) => {
    if (solved || order[cell] === cell) return;
    if (selected === null) setSelected(cell);
    else {
      swap(selected, cell);
      setSelected(null);
    }
  };

  const onPointerDown = (cell: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (solved || order[cell] === cell) return;
    drag.current = { cell, x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    d.el.style.zIndex = '5';
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    d.el.style.visibility = 'hidden';
    const under = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]');
    d.el.style.visibility = '';
    d.el.style.transform = '';
    d.el.style.zIndex = '';
    if (under) swap(d.cell, Number(under.dataset.cell));
    setSelected(null);
  };

  const pieceStyle = (piece: number): CSSProperties => {
    const col = piece % n;
    const row = Math.floor(piece / n);
    return {
      backgroundImage: `url("${url}")`,
      backgroundSize: `${n * 100}% ${n * 100}%`,
      backgroundPosition: `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`,
    };
  };

  return (
    <section className="puzzle" aria-label="Rasmli puzzle">
      <div className="puzzle-head">
        {preview && <img className="puzzle-preview" src={url} alt="Namuna rasm" />}
        <h2>{content.caption}</h2>
        <button type="button" className="btn small ghost" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
          {preview ? 'Namunani yashirish' : "Namunani ko'rish"}
        </button>
      </div>
      <div className="puzzle-area">
        <div
          className={`puzzle-board${solved ? ' solved' : ''}`}
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
          role="grid"
          aria-label={`${content.pieces} bo'lakli puzzle, ${solvedCount(order)} tasi joyida`}
        >
          {order.map((piece, cell) => {
            const locked = piece === cell;
            return (
              <button
                key={cell}
                type="button"
                role="gridcell"
                data-cell={cell}
                data-piece={piece}
                className={`piece${locked ? ' locked' : ''}${selected === cell ? ' selected' : ''}`}
                style={pieceStyle(piece)}
                aria-label={`Bo'lak ${piece + 1}${locked ? ', joyida' : ''}`}
                aria-pressed={selected === cell}
                onPointerDown={onPointerDown(cell)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  tap(cell);
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
