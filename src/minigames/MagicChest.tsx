import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useBobo } from '../components/BoboProvider';
import { SpeakButton } from '../components/SpeakButton';
import { sfx } from '../audio/sfx';
import { img } from '../assets';
import { correctDigits, spin } from '../engine/chest';
import type { MiniGameProps } from './types';

/** Iliq maslahat matni (ovozlangan: tools/ovoz/manifest.py). Qaysi raqam ekanini aytmaydi. */
export function chestFeedback(n: number): string {
  return n === 0 ? "Hali hech bir raqam to'g'ri emas. Jumboqlarni qayta yech." : `${n} ta raqam to'g'ri. Qolganini tekshir.`;
}

/**
 * Sehrli sandiq: har bir jumboq kodning bitta raqamini beradi.
 * Raqam g'ildiragi: ▲/▼ tugmalari, klaviaturada raqam yoki ↑/↓. Kod rasmga chizilmagan — haqiqiy tugmalar.
 */
export function MagicChest({ content, tier, onDone, requestHint, delayMs = 900 }: MiniGameProps<'chest'>) {
  const bobo = useBobo();
  const n = content.puzzles.length;
  const [code, setCode] = useState<number[]>(() => Array(n).fill(0));
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const [hinted, setHinted] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const wheels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current, allowance: Math.ceil(n / 2) }), delayMs * 2);
    return () => clearTimeout(t);
  }, [open, n, delayMs]);

  const set = (i: number, v: number) => {
    if (open) return;
    sfx.play('tap');
    setCode((c) => c.map((d, j) => (j === i ? v : d)));
  };

  const check = () => {
    if (open) return;
    const ok = correctDigits(code, content.puzzles);
    if (ok === n) {
      setOpen(true);
      sfx.play('magic');
      setTimeout(() => sfx.play('fanfare'), 500);
      bobo.say('bobo.chest.open', 'maqtaydi');
      return;
    }
    mistakes.current += 1;
    sfx.play('wrong');
    setShake(true);
    setTimeout(() => setShake(false), 450);
    bobo.say({ text: chestFeedback(ok) });
  };

  /** Maslahat: birinchi noto'g'ri raqamning jumbog'ini qanday yechishni aytadi (javobni emas). */
  const hint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    const i = content.puzzles.findIndex((p, j) => code[j] !== p.answer);
    const k = i < 0 ? 0 : i;
    setHinted(k);
    bobo.say({ text: content.puzzles[k]!.hint }, 'oylaydi');
  };

  const onWheelKey = (i: number) => (e: KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) {
      set(i, Number(e.key));
      if (i < n - 1) wheels.current[i + 1]?.focus();
    } else if (e.key === 'ArrowUp') set(i, spin(code[i]!, 1));
    else if (e.key === 'ArrowDown') set(i, spin(code[i]!, -1));
    else if (e.key === 'ArrowRight' && i < n - 1) wheels.current[i + 1]?.focus();
    else if (e.key === 'ArrowLeft' && i > 0) wheels.current[i - 1]?.focus();
    else if (e.key === 'Enter') check();
    else return;
    e.preventDefault();
  };

  return (
    <section className={`mg chest tier-${tier}${open ? ' open' : ''}`} aria-label="Sehrli sandiq">
      <div className="chest-stage" style={{ backgroundImage: `url(${img.minigame('sandiq', 'sahna.webp')})` }}>
        <div className={`chest-lock${shake ? ' shake' : ''}`} role="group" aria-label={`${n} xonali kod`}>
          {code.map((d, i) => (
            <div className="wheel" key={i}>
              <button type="button" className="wheel-btn" aria-label={`${i + 1}-raqamni oshirish`} onClick={() => set(i, spin(d, 1))} disabled={open}>
                ▲
              </button>
              <div
                ref={(el) => (wheels.current[i] = el)}
                className={`wheel-digit${focus === i ? ' focus' : ''}`}
                tabIndex={0}
                role="spinbutton"
                aria-valuemin={0}
                aria-valuemax={9}
                aria-valuenow={d}
                aria-label={`${i + 1}-raqam`}
                data-wheel={i}
                onFocus={() => setFocus(i)}
                onKeyDown={onWheelKey(i)}
              >
                {d}
              </div>
              <button type="button" className="wheel-btn" aria-label={`${i + 1}-raqamni kamaytirish`} onClick={() => set(i, spin(d, -1))} disabled={open}>
                ▼
              </button>
            </div>
          ))}
        </div>
        {open && (
          <div className="chest-burst" aria-hidden="true">
            <span className="chest-light" />
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="chest-coin" style={{ ['--i' as string]: i }}>
                🪙
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mg-actions">
        <button type="button" className="btn primary big chest-check" onClick={check} disabled={open}>
          🔓 Tekshirish
        </button>
        <button type="button" className="btn hint" onClick={hint} disabled={open}>
          💡 Maslahat
        </button>
      </div>
      <p className="muted center">Har bir jumboq javobi — kodning bitta raqami. Raqamni ▲ ▼ bilan tanla.</p>
      <ol className="chest-puzzles">
        {content.puzzles.map((p, i) => (
          <li key={i} className={`${hinted === i ? 'hinted ' : ''}${focus === i ? 'focus' : ''}`} onClick={() => wheels.current[i]?.focus()}>
            <span className="chest-num">{i + 1}</span>
            <span className="chest-q">{p.q}</span>
            {tier === 'kichik' && <SpeakButton text={p.q} />}
          </li>
        ))}
      </ol>
    </section>
  );
}
