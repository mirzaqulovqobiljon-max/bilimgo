import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useBobo } from '../components/BoboProvider';
import { sfx } from '../audio/sfx';
import type { HiddenContent, Tier } from '../content/schema';
import type { MiniGameProps } from './types';

type Target = HiddenContent['targets'][number];

/** Bosish hududi zaxirasi (rasm eniga nisbatan): kichiklarga kattaroq, olimga aniq. */
export const HIT_PAD: Record<Tier, number> = { kichik: 0.03, karvon: 0.012, olim: 0 };
/** Shuncha noto'g'ri bosish = 1 xato (kichiklarda noto'g'ri bosish umuman jazolanmaydi). */
export const MISSES_PER_MISTAKE: Record<Tier, number> = { kichik: Infinity, karvon: 3, olim: 3 };
const ZOOMS = [1, 1.5, 2, 3];

/** Nuqta (0..1) qaysi nishonga tegadi — zaxira bilan. */
export function hitTarget(targets: readonly Target[], x: number, y: number, pad: number): Target | undefined {
  return targets.find((t) => x >= t.x - pad && x <= t.x + t.w + pad && y >= t.y - pad && y <= t.y + t.h + pad);
}

/**
 * Yashirin buyumlar: rasm ichidan ro'yxatdagi narsalarni topish.
 * Koordinatalar rasmga nisbatan 0..1, shuning uchun ekran o'lchami va zoom'dan qat'i nazar joyida qoladi.
 * Zoom: ＋/− tugmalari, sichqoncha g'ildiragi, ikki barmoq; kattalashtirilganda sudrab suriladi.
 */
export function HiddenObjects({ content, tier, onDone, requestHint, delayMs = 900 }: MiniGameProps<'hidden'>) {
  const bobo = useBobo();
  const [found, setFound] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState<string | null>(null);
  const [miss, setMiss] = useState<{ x: number; y: number; n: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; dist?: number; z?: number } | null>(null);
  const misses = useRef(0);
  const missesSinceFind = useRef(0);
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const done = found.length === content.targets.length;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(
      () => onDoneRef.current({ mistakes: mistakes.current, allowance: Math.ceil(content.targets.length / 3) }),
      delayMs,
    );
    return () => clearTimeout(t);
  }, [done, delayMs, content.targets.length]);

  /** Zoom'ni chegaralar ichida ushlab turadi: rasm chetidan bo'sh joy ko'rinmasin. */
  const clampPan = (p: { x: number; y: number }, z: number) => {
    const v = viewRef.current;
    const w = v?.clientWidth ?? 0;
    const h = v?.clientHeight ?? 0;
    return { x: Math.min(0, Math.max(w - w * z, p.x)), y: Math.min(0, Math.max(h - h * z, p.y)) };
  };

  const zoomTo = (z: number, cx?: number, cy?: number) => {
    const v = viewRef.current;
    const w = v?.clientWidth ?? 0;
    const h = v?.clientHeight ?? 0;
    const ox = cx ?? w / 2;
    const oy = cy ?? h / 2;
    // ko'rish nuqtasi ostidagi rasm nuqtasi joyida qolsin
    const nx = ox - ((ox - pan.x) / zoom) * z;
    const ny = oy - ((oy - pan.y) / zoom) * z;
    setZoom(z);
    setPan(clampPan({ x: nx, y: ny }, z));
  };

  const tap = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || done) return;
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    const t = hitTarget(content.targets, x, y, HIT_PAD[tier]);
    if (t) {
      if (found.includes(t.id)) return; // qayta bosish hisoblanmaydi
      sfx.play('correct');
      missesSinceFind.current = 0;
      setGlow(null);
      setFound((f) => [...f, t.id]);
      bobo.say('bobo.praise', undefined, { ifIdle: true });
      return;
    }
    sfx.play('wrong');
    misses.current += 1;
    missesSinceFind.current += 1;
    if (misses.current % MISSES_PER_MISTAKE[tier] === 0) mistakes.current += 1;
    setMiss({ x, y, n: misses.current });
    if (missesSinceFind.current === 5) bobo.say('bobo.hint.offer');
    else bobo.say('bobo.hidden.miss', undefined, { ifIdle: true });
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { x: 0, y: 0, px: pan.x, py: pan.y, moved: true, dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: zoom };
    } else gesture.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size === 2 && g.dist) {
      const [a, b] = [...pointers.current.values()];
      const z = Math.min(3, Math.max(1, (g.z ?? 1) * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / g.dist)));
      const r = viewRef.current!.getBoundingClientRect();
      zoomTo(z, (a!.x + b!.x) / 2 - r.left, (a!.y + b!.y) / 2 - r.top);
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (zoom > 1) setPan(clampPan({ x: g.px + dx, y: g.py + dy }, zoom));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (g && !g.moved) tap(e.clientX, e.clientY); // sudrash bosish hisoblanmaydi
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const r = viewRef.current!.getBoundingClientRect();
    const z = Math.min(3, Math.max(1, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    zoomTo(z, e.clientX - r.left, e.clientY - r.top);
  };

  const hint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    const t = content.targets.find((x) => !found.includes(x.id));
    if (!t) return;
    setGlow(t.id);
    bobo.say({ text: content.hint }, 'oylaydi');
  };

  const glowT = content.targets.find((t) => t.id === glow);
  const pct = (v: number) => `${v * 100}%`;
  return (
    <section className={`mg hidden-game tier-${tier}`} aria-label="Yashirin buyumlar">
      <div className="mg-hud" role="status">
        <span>
          🔍 {found.length} / {content.targets.length}
        </span>
        <span className="ho-zoom">
          <button type="button" className="btn small" aria-label="Kichiklashtirish" onClick={() => zoomTo(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)] ?? 1)} disabled={zoom <= 1}>
            −
          </button>
          <b>{zoom.toFixed(1).replace('.0', '')}×</b>
          <button type="button" className="btn small" aria-label="Kattalashtirish" onClick={() => zoomTo(ZOOMS.find((z) => z > zoom) ?? 3)} disabled={zoom >= 3}>
            ＋
          </button>
        </span>
        <button type="button" className="btn hint" onClick={hint} disabled={done}>
          💡 Qayerda?
        </button>
      </div>
      <div
        ref={viewRef}
        className={`ho-view${zoom > 1 ? ' zoomed' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div
          ref={stageRef}
          className="ho-stage"
          data-zoom={zoom}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <img src={content.scene.startsWith('img/') ? content.scene : `img/${content.scene}`} alt="Sehrli o'rmon manzarasi" draggable={false} />
          {content.targets
            .filter((t) => found.includes(t.id))
            .map((t) => (
              <span
                key={t.id}
                className="ho-found"
                style={{ left: pct(t.x), top: pct(t.y), width: pct(t.w), height: pct(t.h) }}
                aria-hidden="true"
              >
                <span className="ho-check">✓</span>
              </span>
            ))}
          {glowT && (
            <span
              className="ho-glow"
              style={{ left: pct(glowT.x + glowT.w / 2), top: pct(glowT.y + glowT.h / 2) }}
              aria-hidden="true"
            />
          )}
          {miss && <span key={miss.n} className="ho-miss" style={{ left: pct(miss.x), top: pct(miss.y) }} aria-hidden="true" />}
        </div>
      </div>
      <ul className="ho-list" aria-label="Topish kerak">
        {content.targets.map((t) => (
          <li key={t.id} className={found.includes(t.id) ? 'got' : ''} data-target={t.id}>
            <span className="ho-icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
            {found.includes(t.id) && <span className="sr-only"> — topildi</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
