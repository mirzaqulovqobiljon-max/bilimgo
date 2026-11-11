import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useBobo } from '../components/BoboProvider';
import { sfx } from '../audio/sfx';
import { img } from '../assets';
import { dirTo, hintSteps, initialMaze, isTrap, isWall, moveMaze, same, type Cell, type Dir, type MazeMap } from '../engine/maze';
import type { MiniGameProps } from './types';

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

const ARROW: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const DIR_NAME: Record<Dir, string> = { up: 'Yuqoriga', down: 'Pastga', left: 'Chapga', right: "O'ngga" };

/**
 * Sirli labirint: avval oltin kalit, keyin darvoza.
 * Boshqaruv: ↑↓←→ / WASD, ekrandagi 4 tugma, qo'shni katakka tegish yoki barmoq bilan surish.
 * Devorga urilish xato emas; tuzoq — +1 xato va oxirgi xavfsiz katakka qaytish.
 */
export function Maze({ content, tier, onDone, requestHint, delayMs = 900 }: MiniGameProps<'maze'>) {
  const bobo = useBobo();
  const map = useMemo<MazeMap>(
    () => ({ rows: content.rows, start: content.start, key: content.key, exit: content.exit, traps: content.traps }),
    [content],
  );
  const W = map.rows[0]!.length;
  const H = map.rows.length;
  const [s, setS] = useState(() => initialMaze(map));
  const [hint, setHint] = useState<Cell[]>([]);
  const [bump, setBump] = useState<Dir | null>(null);
  const [flash, setFlash] = useState(false);
  const stateRef = useRef(s);
  stateRef.current = s;
  const lockedSaid = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const move = (dir: Dir) => {
    const { state, event } = moveMaze(map, stateRef.current, dir);
    stateRef.current = state;
    setS(state);
    if (event !== 'wall' && event !== 'none') setHint((h) => (h.length && same(h[0]!, state.pos) ? h.slice(1) : event === 'trap' ? [] : h));
    switch (event) {
      case 'wall':
        setBump(dir);
        setTimeout(() => setBump(null), 160);
        break;
      case 'move':
        sfx.play('tap');
        break;
      case 'key':
        sfx.play('correct');
        bobo.say('bobo.maze.key', 'maqtaydi');
        break;
      case 'trap':
        sfx.play('wrong');
        setFlash(true);
        setTimeout(() => setFlash(false), 400);
        bobo.say('bobo.maze.trap');
        break;
      case 'locked':
        sfx.play('wrong');
        if (!lockedSaid.current) bobo.say('bobo.maze.locked');
        lockedSaid.current = true;
        break;
      case 'win':
        sfx.play('unlock');
        bobo.say('bobo.praise');
        break;
    }
  };

  useEffect(() => {
    if (!s.done) return;
    const t = setTimeout(
      () => onDoneRef.current({ mistakes: stateRef.current.mistakes, allowance: Math.max(1, map.traps.length) }),
      delayMs,
    );
    return () => clearTimeout(t);
  }, [s.done, delayMs, map.traps.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (!dir || (e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const askHint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    bobo.say({ text: content.hint }, 'oylaydi');
    setHint(hintSteps(map, stateRef.current, 3));
  };

  const onCell = (c: Cell) => {
    const d = dirTo(stateRef.current.pos, c);
    if (d) move(d);
  };

  // barmoq bilan surish (taxta ustida)
  const onDown = (e: PointerEvent) => (swipe.current = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  const isHint = (c: Cell) => hint.some((h) => same(h, c));
  const cells: JSX.Element[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c: Cell = [x, y];
      const wall = isWall(map, c);
      const trap = !wall && isTrap(map, c);
      const cls = ['mz-cell', wall ? 'wall' : 'path', trap ? 'trap' : '', isHint(c) ? 'hint' : ''].filter(Boolean).join(' ');
      cells.push(
        <div key={`${x},${y}`} className={cls} data-cell={wall ? '#' : trap ? '!' : '.'} onClick={wall ? undefined : () => onCell(c)}>
          {trap && <span className="mz-spikes" aria-hidden="true" />}
          {!s.hasKey && same(c, map.key) && <img className="mz-key" src={img.item('kalit')} alt="" draggable={false} />}
          {same(c, map.exit) && (
            <span className={`mz-exit${s.hasKey ? ' open' : ''}`} aria-hidden="true">
              {s.hasKey ? '🚪' : '🔒'}
            </span>
          )}
        </div>,
      );
    }
  }

  const pct = (v: number, n: number) => `${(v / n) * 100}%`;
  return (
    <section
      className={`mg maze tier-${tier}${flash ? ' flash' : ''}`}
      aria-label="Sirli labirint"
      style={{ backgroundImage: `url(${img.minigame('labirint', 'sahna.webp')})` }}
    >
      <div className="mg-hud" role="status">
        <span className={s.hasKey ? 'ok' : ''}>
          <img src={img.item('kalit')} alt="" width={22} height={22} /> {s.hasKey ? 'Kalit olindi' : 'Kalitni top'}
        </span>
        <span>👣 {s.steps}</span>
        {map.traps.length > 0 && <span>⚠️ {s.mistakes}</span>}
        <button type="button" className="btn hint" onClick={askHint} disabled={s.done}>
          💡 Yo'lni ko'rsat
        </button>
      </div>
      <div
        className={`mz-board${bump ? ` bump-${bump}` : ''}`}
        style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, aspectRatio: `${W} / ${H}` }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        role="application"
        aria-label={`Labirint ${W}×${H}. Strelkalar yoki WASD bilan yur.${s.hasKey ? ' Kalit olindi, darvozaga bor.' : ''}`}
        data-pos={`${s.pos[0]},${s.pos[1]}`}
        data-key={s.hasKey ? '1' : '0'}
      >
        {cells}
        <img
          className="mz-hero"
          src={img.caravan}
          alt=""
          draggable={false}
          style={{ left: pct(s.pos[0], W), top: pct(s.pos[1], H), width: pct(1, W), height: pct(1, H) }}
        />
      </div>
      <div className="mz-controls">
        <div className="dpad">
          {(['up', 'left', 'right', 'down'] as Dir[]).map((d) => (
            <button key={d} type="button" className={`dpad-btn ${d}`} aria-label={DIR_NAME[d]} onClick={() => move(d)} disabled={s.done}>
              {ARROW[d]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
