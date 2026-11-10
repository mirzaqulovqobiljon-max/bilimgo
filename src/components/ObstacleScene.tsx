import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Item, Level } from '../content/schema';
import { useBobo } from './BoboProvider';

type Phase = 'idle' | 'holding' | 'using' | 'opened';

interface Props {
  level: Level;
  item: Item;
  onDone(): void;
  /** Ochilish animatsiyasi davomiyligi (testlarda 0). */
  animationMs?: number;
}

/** Darvoza rasmi. `open` bo'lsa eshiklar ochiladi (CSS transform). */
function GateVisual({ open, phase }: { open: boolean; phase: Phase }) {
  return (
    <svg viewBox="0 0 300 260" className={`gate-svg${open ? ' open' : ''}`} aria-hidden="true">
      <rect x="0" y="200" width="300" height="60" fill="#9ccc65" />
      <path d="M120 260 L140 200 L160 200 L180 260Z" fill="#e8c88f" />
      <rect x="20" y="60" width="40" height="150" fill="#c98b4f" />
      <rect x="240" y="60" width="40" height="150" fill="#c98b4f" />
      <path d="M10 70 Q150 -20 290 70 L290 92 Q150 6 10 92Z" fill="#1e88a8" />
      <g fill="#ffd34d">
        <circle cx="80" cy="45" r="5" />
        <circle cx="150" cy="25" r="6" />
        <circle cx="220" cy="45" r="5" />
      </g>
      <rect x="60" y="88" width="180" height="122" fill="#2b1a0e" />
      <g className="door door-left">
        <rect x="60" y="88" width="90" height="122" fill="#a0602e" stroke="#5d3317" strokeWidth="3" />
        <line x1="60" y1="120" x2="150" y2="120" stroke="#5d3317" strokeWidth="3" />
        <line x1="60" y1="175" x2="150" y2="175" stroke="#5d3317" strokeWidth="3" />
      </g>
      <g className="door door-right">
        <rect x="150" y="88" width="90" height="122" fill="#b06a35" stroke="#5d3317" strokeWidth="3" />
        <line x1="150" y1="120" x2="240" y2="120" stroke="#5d3317" strokeWidth="3" />
        <line x1="150" y1="175" x2="240" y2="175" stroke="#5d3317" strokeWidth="3" />
      </g>
      {!open && (
        <g className={`padlock${phase === 'holding' ? ' glow' : ''}${phase === 'using' ? ' unlocking' : ''}`}>
          <path d="M138 140 v-10 a12 12 0 0 1 24 0 v10" fill="none" stroke="#6d6d6d" strokeWidth="5" />
          <rect x="132" y="138" width="36" height="30" rx="5" fill="#ffca28" stroke="#8a6d00" strokeWidth="2" />
          <circle cx="150" cy="150" r="4" fill="#5d3317" />
          <rect x="148.5" y="150" width="3" height="10" fill="#5d3317" />
        </g>
      )}
    </svg>
  );
}

/**
 * Buyumni to'siqqa ishlatish: bola buyumni sumkadan sudrab to'siqqa olib boradi
 * ("men o'zim yutdim" tuyg'usi). Sudrash qiyin bo'lsa: buyumni bos, keyin to'siqni bos.
 * Rejaga ko'ra animatsiya Phaser'da — bu sahnani ataylab React+SVG'da qildik (sabab README'da).
 */
export function ObstacleScene({ level, item, onDone, animationMs = 1600 }: Props) {
  const bobo = useBobo();
  const [phase, setPhase] = useState<Phase>('idle');
  const targetRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; el: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (phase !== 'using') return;
    const t1 = setTimeout(() => setPhase('opened'), animationMs * 0.5);
    return () => clearTimeout(t1);
  }, [phase, animationMs]);

  useEffect(() => {
    if (phase !== 'opened') return;
    const t = setTimeout(() => onDoneRef.current(), animationMs); // ochiq darvozani ko'rib olsin
    return () => clearTimeout(t);
  }, [phase, animationMs]);

  const use = () => {
    if (phase === 'using' || phase === 'opened') return;
    setPhase('using');
    bobo.say('bobo.praise');
  };

  const onItemClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (phase === 'idle') {
      setPhase('holding');
      bobo.say({ text: `Endi ${level.obstacle.title.toLowerCase()}ni bos.` });
    } else if (phase === 'holding') setPhase('idle');
  };

  const onTargetClick = () => {
    if (phase === 'holding') use();
    else if (phase === 'idle') bobo.say({ text: `Avval sumkadagi ${item.name.toLowerCase()}ni ol.` });
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (phase === 'using' || phase === 'opened') return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    if (!d.moved) setPhase('holding');
    d.moved = true;
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    d.el.style.transform = '';
    const r = targetRef.current?.getBoundingClientRect();
    const pad = 24; // barmoq aniq tegmasa ham ishlasin
    const hit = r && e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    if (hit) use();
    else {
      setPhase('idle');
      bobo.say({ text: 'Yana bir oz yaqinroq olib bor.' });
    }
  };

  const used = phase === 'using' || phase === 'opened';

  return (
    <section className={`obstacle obstacle-${level.obstacle.type} phase-${phase}`} aria-label={level.obstacle.title}>
      <h2>{level.obstacle.title}</h2>
      <div className="obstacle-stage">
        {level.obstacle.type === 'gate' ? (
          <GateVisual open={phase === 'opened'} phase={phase} />
        ) : (
          <div className="obstacle-emoji" aria-hidden="true">🚧</div>
        )}
        <button
          ref={targetRef}
          type="button"
          className="obstacle-target"
          onClick={onTargetClick}
          aria-label={`${level.obstacle.title}: ${item.name.toLowerCase()}ni shu yerga qo'y`}
          disabled={used}
        />
      </div>
      <div className="obstacle-tray">
        <span className="tray-label">🎒 Sumkadan:</span>
        {!used && (
          <button
            type="button"
            className={`tray-item${phase === 'holding' ? ' holding' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onItemClick}
            aria-pressed={phase === 'holding'}
            aria-label={`${item.name}ni olish`}
          >
            <span aria-hidden="true">{item.icon}</span>
          </button>
        )}
        {used && <span className="tray-used" aria-hidden="true">{item.icon} ✨</span>}
      </div>
      {phase === 'opened' && <p className="obstacle-opened" role="status">Ochildi!</p>}
    </section>
  );
}
