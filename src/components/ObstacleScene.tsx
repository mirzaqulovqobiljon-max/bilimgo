import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Item, Level } from '../content/schema';
import { useBobo } from './BoboProvider';
import { Icon } from './Icon';
import { OBSTACLE_SCENE, img } from '../assets';

type Phase = 'idle' | 'holding' | 'using' | 'opened';

interface Props {
  level: Level;
  item: Item;
  onDone(): void;
  /** Ochilish animatsiyasi davomiyligi (testlarda 0). */
  animationMs?: number;
}

/**
 * Har bir to'siq turi uchun nishon (bola buyumni shu joyga olib boradi), rasmdagi foizlarda.
 * Rasm almashtirilsa — shu jadvalni rasmga moslash kerak (tools/rasmlar.py izohiga qarang).
 */
export const TARGET_BOX: Record<string, { left: number; top: number; width: number; height: number }> = {
  gate: { left: 44, top: 56, width: 24, height: 30 }, // osma qulf
  dark: { left: 30, top: 60, width: 40, height: 30 }, // qorong'i yo'l
  river: { left: 30, top: 38, width: 40, height: 32 }, // daryo o'rtasi
  desert: { left: 33, top: 42, width: 34, height: 34 }, // cho'l
  cliff: { left: 30, top: 45, width: 40, height: 30 }, // singan ko'prik
  castle: { left: 38, top: 46, width: 28, height: 30 }, // sehrli doira
};
const DEFAULT_BOX = { left: 33, top: 40, width: 34, height: 34 };

/** "Oldin" va "keyin" rasmlari ustma-ust; buyum ishlatilganda "keyin" asta paydo bo'ladi. */
function SceneImage({ type, open }: { type: string; open: boolean }) {
  const scene = OBSTACLE_SCENE[type];
  if (!scene) return <div className="obstacle-emoji" aria-hidden="true">🚧</div>;
  return (
    <div className={`scene${open ? ' open' : ''}`} aria-hidden="true">
      <img className="scene-before" src={img.obstacle(scene, false)} alt="" draggable={false} />
      <img className="scene-after" src={img.obstacle(scene, true)} alt="" draggable={false} loading="eager" />
    </div>
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
        <SceneImage type={level.obstacle.type} open={phase === 'opened'} />
        <button
          ref={targetRef}
          type="button"
          style={(() => {
            const b = TARGET_BOX[level.obstacle.type] ?? DEFAULT_BOX;
            return { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` };
          })()}
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
            <Icon icon={item.icon} size={56} />
          </button>
        )}
        {used && (
          <span className="tray-used" aria-hidden="true">
            <Icon icon={item.icon} size={40} /> ✨
          </span>
        )}
      </div>
      {phase === 'opened' && <p className="obstacle-opened" role="status">Ochildi!</p>}
    </section>
  );
}
