import { createContext, useContext } from 'react';

/** Kadr manbai: frame(dt soniyada). Qaytgan funksiya to'xtatadi. */
export type Ticker = (frame: (dt: number) => void) => () => void;

/** Brauzerda — requestAnimationFrame; uzoq kadr (sekin telefon, fon) 50 ms bilan cheklanadi. */
export const rafTicker: Ticker = (frame) => {
  if (typeof requestAnimationFrame !== 'function') {
    const id = setInterval(() => frame(1 / 60), 1000 / 60);
    return () => clearInterval(id);
  }
  let id = 0;
  let last = performance.now();
  const loop = (now: number) => {
    frame(Math.min(0.05, Math.max(0, (now - last) / 1000)));
    last = now;
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
};

export const TickerContext = createContext<Ticker>(rafTicker);
export const useTicker = () => useContext(TickerContext);

/** Testlar uchun: kadrlarni qo'lda yuritiladi — natija vaqtga bog'liq emas. */
export function manualTicker() {
  const frames = new Set<(dt: number) => void>();
  return {
    ticker: ((frame) => {
      frames.add(frame);
      return () => frames.delete(frame);
    }) as Ticker,
    tick(dt = 1 / 30) {
      [...frames].forEach((f) => f(dt));
    },
    get active() {
      return frames.size;
    },
  };
}
