import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Item, Level } from '../content/schema';
import { useBobo } from './BoboProvider';
import { Icon } from './Icon';
import { OBSTACLE_SCENE, img } from '../assets';
import { sfx, type SfxName } from '../audio/sfx';

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

/**
 * Ochilish animatsiyasi turi:
 * - door: kalit qulfda buraladi, eshik tabaqalari 3D'da ochiladi (darvoza);
 * - boat: qayiq to'lqinlarda chayqalib suzib o'tadi (daryo);
 * - magic: yulduzchalar portlab, sehrli tovush bilan ochiladi (qolganlari).
 */
export type OpenKind = 'door' | 'boat' | 'magic';
export function openKindFor(obstacleType: string): OpenKind {
  return obstacleType === 'gate' ? 'door' : obstacleType === 'river' ? 'boat' : 'magic';
}
const OPEN_SOUND: Record<OpenKind, SfxName> = { door: 'unlock', boat: 'water', magic: 'magic' };
/** "using" bosqichi davomiyligi animationMs ga nisbatan (qayiq uzoqroq suzadi). */
const USING_FACTOR: Record<OpenKind, number> = { door: 1.15, boat: 1.6, magic: 0.8 };

/** Darvoza tabaqalari "oldin" rasmida qayerda (foizda) — rasm almashtirilsa moslash kerak. */
const DOOR_BOX = { left: 22.5, top: 26, width: 69, height: 71 };

/**
 * Tabaqa ichida "oldin" rasmining aynan o'sha bo'lagi ko'rinishi uchun fon o'lchami va joyi.
 * CSS: pozitsiya% = siljish / (element − rasm), shuning uchun tabaqa chap qirrasi L% bo'lsa: L / (100 − tabaqa_eni).
 */
export function leafStyle(src: string, side: 'left' | 'right') {
  const w = DOOR_BOX.width / 2;
  const left = side === 'left' ? DOOR_BOX.left : DOOR_BOX.left + w;
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${(100 / w) * 100}% ${(100 / DOOR_BOX.height) * 100}%`,
    backgroundPosition: `${(left / (100 - w)) * 100}% ${(DOOR_BOX.top / (100 - DOOR_BOX.height)) * 100}%`,
  };
}

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = 70 + (i % 3) * 26;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, delay: (i % 4) * 70, size: 22 + (i % 3) * 8 };
});

/** "Oldin" va "keyin" rasmlari ustma-ust; buyum ishlatilganda tanlangan animatsiya o'ynaydi. */
function SceneImage({ type, phase, item, target }: { type: string; phase: Phase; item: Item; target: { left: number; top: number; width: number; height: number } }) {
  const scene = OBSTACLE_SCENE[type];
  const kind = openKindFor(type);
  const using = phase === 'using';
  const open = phase === 'opened';
  if (!scene) return <div className="obstacle-emoji" aria-hidden="true">🚧</div>;
  const before = img.obstacle(scene, false);
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  return (
    <div className={`scene kind-${kind}${using ? ' using' : ''}${open ? ' open' : ''}`} aria-hidden="true">
      <img className="scene-before" src={before} alt="" draggable={false} />
      <img className="scene-after" src={img.obstacle(scene, true)} alt="" draggable={false} loading="eager" />

      {kind === 'door' && (using || open) && (
        <>
          <div
            className="door-frame"
            style={{ left: `${DOOR_BOX.left}%`, top: `${DOOR_BOX.top}%`, width: `${DOOR_BOX.width}%`, height: `${DOOR_BOX.height}%` }}
          >
            {(['left', 'right'] as const).map((side) => (
              <div
                key={side}
                className={`door-leaf ${side}`}
                style={leafStyle(before, side)}
              />
            ))}
          </div>
          <span className="anim-key" style={{ left: `${cx}%`, top: `${cy}%` }}>
            <Icon icon={item.icon} size={64} />
          </span>
        </>
      )}

      {kind === 'boat' && using && (
        <span className="anim-boat">
          <span className="boat-bob">
            <Icon icon={item.icon} size={120} />
          </span>
          <span className="boat-wake" />
        </span>
      )}

      {kind === 'magic' && (using || open) && (
        <span className="anim-magic" style={{ left: `${cx}%`, top: `${cy}%` }}>
          <span className="magic-ring" />
          <span className="magic-item">
            <Icon icon={item.icon} size={64} />
          </span>
          {SPARKS.map((p, i) => (
            <span
              key={i}
              className="spark"
              style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animationDelay: `${p.delay}ms`, fontSize: p.size }}
            >
              ✦
            </span>
          ))}
        </span>
      )}
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

  const kind = openKindFor(level.obstacle.type);

  useEffect(() => {
    if (phase !== 'using') return;
    const t1 = setTimeout(() => setPhase('opened'), animationMs * USING_FACTOR[kind]);
    return () => clearTimeout(t1);
  }, [phase, animationMs, kind]);

  useEffect(() => {
    if (phase !== 'opened') return;
    const t = setTimeout(() => onDoneRef.current(), animationMs); // ochiq darvozani ko'rib olsin
    return () => clearTimeout(t);
  }, [phase, animationMs]);

  const use = () => {
    if (phase === 'using' || phase === 'opened') return;
    setPhase('using');
    sfx.play(OPEN_SOUND[kind]);
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
        <SceneImage type={level.obstacle.type} phase={phase} item={item} target={TARGET_BOX[level.obstacle.type] ?? DEFAULT_BOX} />
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
