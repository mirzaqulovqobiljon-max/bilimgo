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

/** Har bir to'siq turi uchun sahna. `open` — buyum ishlatilgandan keyingi holat. */
function SceneVisual({ type, open, icon }: { type: string; open: boolean; icon: string }) {
  const sky = <rect width="300" height="260" fill={open ? '#bfe3f2' : '#9fc6d9'} />;
  switch (type) {
    case 'dark':
      return (
        <svg viewBox="0 0 300 260" className={`scene-svg${open ? ' open' : ''}`} aria-hidden="true">
          <rect width="300" height="260" fill="#1f3b2a" />
          {[30, 90, 150, 210, 270].map((x, i) => (
            <path key={x} d={`M${x - 28} ${210 - (i % 2) * 20} L${x} ${40 + (i % 3) * 15} L${x + 28} ${210 - (i % 2) * 20}Z`} fill="#2e6b3a" />
          ))}
          <rect y="200" width="300" height="60" fill="#3d5a2a" />
          <g className="scene-reveal">
            <circle cx="70" cy="190" r="10" fill="#f9a825" /><text x="60" y="196" fontSize="16">🦔</text>
            <text x="200" y="120" fontSize="22">🦉</text><text x="230" y="200" fontSize="22">🐇</text>
          </g>
          <rect className="scene-dark" width="300" height="260" fill="#000" opacity="0.82" />
          {open && <text x="135" y="175" fontSize="44" className="scene-item-in">{icon}</text>}
        </svg>
      );
    case 'river':
      return (
        <svg viewBox="0 0 300 260" className={`scene-svg${open ? ' open' : ''}`} aria-hidden="true">
          {sky}
          <rect y="70" width="300" height="40" fill="#9ccc65" />
          <rect y="110" width="300" height="90" fill="#3d9bd1" />
          <path d="M0 140 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#bfe6fb" strokeWidth="4" fill="none" />
          <path d="M0 175 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#bfe6fb" strokeWidth="4" fill="none" />
          <rect y="200" width="300" height="60" fill="#9ccc65" />
          <text x="130" y="248" fontSize="34" className={open ? 'scene-cross' : ''}>{open ? icon : '🧒'}</text>
        </svg>
      );
    case 'desert':
      return (
        <svg viewBox="0 0 300 260" className={`scene-svg${open ? ' open' : ''}`} aria-hidden="true">
          <rect width="300" height="260" fill="#f6d58e" />
          <circle cx="240" cy="50" r="28" fill="#ffb300" />
          <path d="M0 170 Q75 120 150 170 T300 160 V260 H0Z" fill="#e7b75f" />
          <path d="M0 210 Q90 170 180 215 T300 205 V260 H0Z" fill="#d9a04a" />
          <text x="20" y="150" fontSize="26">🌵</text>
          <text x="40" y="240" fontSize="40" className={open ? 'scene-ride' : ''}>{open ? icon : '🧒'}</text>
        </svg>
      );
    case 'cliff':
      return (
        <svg viewBox="0 0 300 260" className={`scene-svg${open ? ' open' : ''}`} aria-hidden="true">
          {sky}
          <path d="M0 120 L110 120 L110 260 L0 260Z" fill="#8d9fb0" />
          <path d="M190 120 L300 120 L300 260 L190 260Z" fill="#8d9fb0" />
          <path d="M110 120 L190 120 L170 260 L130 260Z" fill="#3b4a58" />
          {open && <path d="M110 122 Q150 150 190 122" stroke="#a1724a" strokeWidth="6" fill="none" className="scene-rope" />}
          <text x="60" y="112" fontSize="30">🧒</text>
        </svg>
      );
    case 'castle':
      return (
        <svg viewBox="0 0 300 260" className={`scene-svg${open ? ' open' : ''}`} aria-hidden="true">
          <rect width="300" height="260" fill="#4a3f6b" />
          <rect x="40" y="70" width="220" height="160" fill="#6d6d78" />
          {[40, 80, 120, 160, 200, 240].map((x) => <rect key={x} x={x} y="56" width="20" height="16" fill="#6d6d78" />)}
          <rect x="20" y="40" width="40" height="190" fill="#5c5c68" /><rect x="240" y="40" width="40" height="190" fill="#5c5c68" />
          <path d="M110 230 V150 Q150 110 190 150 V230Z" fill={open ? '#ffe082' : '#2b1a0e'} className="castle-door" />
          {!open && <circle cx="150" cy="180" r="34" fill="none" stroke="#c5f" strokeWidth="5" strokeDasharray="6 6" className="magic-ring" />}
          {open && <text x="128" y="200" fontSize="40">📖</text>}
        </svg>
      );
    default:
      return <div className="obstacle-emoji" aria-hidden="true">🚧</div>;
  }
}

/** To'siq turiga qarab "nishon" joyi (buyum shu yerga olib boriladi). */
const TARGET_POS: Record<string, { left: string; top: string }> = {
  gate: { left: '36%', top: '42%' },
  dark: { left: '30%', top: '30%' },
  river: { left: '25%', top: '42%' },
  desert: { left: '10%', top: '55%' },
  cliff: { left: '33%', top: '42%' },
  castle: { left: '33%', top: '50%' },
};

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
      bobo.say({ text: 'Endi yonib turgan joyni bos.' });
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
          <SceneVisual type={level.obstacle.type} open={phase === 'opened'} icon={item.icon} />
        )}
        <button
          ref={targetRef}
          type="button"
          style={TARGET_POS[level.obstacle.type] ?? TARGET_POS.gate}
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
