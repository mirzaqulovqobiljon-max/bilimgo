import { useEffect, useRef, useState } from 'react';
import type { RiddleQuestion, Tier } from '../content/schema';
import { BATTLE_HP } from '../content/validate';
import { useBobo } from './BoboProvider';

/** Olim darajasida har bir savolga vaqt (rejada: "7 ta savol, vaqt bilan"). */
export const OLIM_SECONDS_PER_QUESTION = 25;

type Phase = 'fight' | 'hit' | 'block' | 'won';

interface Props {
  tier: Tier;
  questions: RiddleQuestion[];
  onDone(result: { mistakes: number }): void;
  delayMs?: number;
}

function DevFigure({ state, tier }: { state: Phase; tier: Tier }) {
  return (
    <svg viewBox="0 0 160 170" className={`dev dev-${state}${tier === 'kichik' ? ' dev-soft' : ''}`} aria-hidden="true">
      <path d="M40 40 L30 8 L58 30Z M120 40 L130 8 L102 30Z" fill="#e8d9b5" />
      <ellipse cx="80" cy="115" rx="58" ry="52" fill="#6a4c93" />
      <circle cx="80" cy="62" r="40" fill="#7d5ba6" />
      <ellipse cx="64" cy="58" rx="9" ry="11" fill="#fff" />
      <ellipse cx="96" cy="58" rx="9" ry="11" fill="#fff" />
      <circle cx="66" cy="60" r="4.5" fill="#222" />
      <circle cx="94" cy="60" r="4.5" fill="#222" />
      {state === 'won' && tier === 'kichik' ? (
        <path d="M66 84 Q80 76 94 84" stroke="#222" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M62 82 Q80 92 98 82" stroke="#222" strokeWidth="4" fill="#3a2350" strokeLinecap="round" />
      )}
      <path d="M52 44 L74 50 M108 44 L86 50" stroke="#2b1a3a" strokeWidth="5" strokeLinecap="round" />
      <rect x="48" y="138" width="20" height="26" rx="8" fill="#5a3f80" />
      <rect x="92" y="138" width="20" height="26" rx="8" fill="#5a3f80" />
      <circle cx="80" cy="120" r="10" fill="#c5f" opacity=".7" className="dev-magic" />
    </svg>
  );
}

/**
 * Dev jangi. To'g'ri javob — qilich zarbasi (jon chizig'i kamayadi).
 * Xato yoki vaqt tugashi — devning zarbasini qalqon to'sadi; savol keyinroq qaytadi.
 * Bola hech qachon "o'lmaydi". Kichiklarda dev o'ldirilmaydi: sehri sinadi, kichrayib, kechirim so'rab qochadi.
 */
export function DevBattle({ tier, questions, onDone, delayMs = 900 }: Props) {
  const bobo = useBobo();
  const maxHp = BATTLE_HP[tier];
  const [hp, setHp] = useState(maxHp);
  const [queue, setQueue] = useState<number[]>(() => questions.map((_, i) => i));
  const [phase, setPhase] = useState<Phase>('fight');
  const [seconds, setSeconds] = useState(OLIM_SECONDS_PER_QUESTION);
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const timed = tier === 'olim';
  const q = questions[queue[0]!]!;

  const advance = (correct: boolean) => {
    const [cur, ...rest] = queue;
    if (correct) setQueue([...rest, cur!]);
    else {
      // xato javob berilgan savol bitta savoldan keyin yana so'raladi — bola uni o'rganib oladi
      const next = [...rest];
      next.splice(Math.min(1, next.length), 0, cur!);
      setQueue(next);
    }
    if (correct) {
      const next = hp - 1;
      setHp(next);
      setPhase(next <= 0 ? 'won' : 'hit');
      if (next > 0) bobo.say('bobo.praise');
    } else {
      mistakes.current += 1;
      setPhase('block');
      bobo.say('bobo.battle.block');
    }
    setSeconds(OLIM_SECONDS_PER_QUESTION);
  };

  useEffect(() => {
    if (phase === 'hit' || phase === 'block') {
      const t = setTimeout(() => setPhase('fight'), delayMs);
      return () => clearTimeout(t);
    }
    if (phase === 'won') {
      bobo.say(tier === 'kichik' ? 'bobo.battle.won.kichik' : 'bobo.battle.won');
      const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current }), delayMs * 3);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (!timed || phase !== 'fight') return;
    if (seconds <= 0) {
      advance(false);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, phase, seconds]);

  return (
    <section className={`battle phase-${phase}`} aria-label="Dev bilan jang">
      <div className="hp" role="meter" aria-label="Devning kuchi" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
        {Array.from({ length: maxHp }, (_, i) => (
          <span key={i} className={i < hp ? 'hp-seg on' : 'hp-seg'} />
        ))}
      </div>
      <div className="battle-stage">
        <span className="weapon shield" aria-hidden="true">🛡️</span>
        <DevFigure state={phase} tier={tier} />
        <span className="weapon sword" aria-hidden="true">🗡️</span>
        {phase === 'won' && (
          <p className="dev-says" role="status">
            {tier === 'kichik' ? "Kechiring! Kitobni qaytaraman, endi yaxshi bo'laman!" : "Dev tutunga aylanib g'oyib bo'ldi!"}
          </p>
        )}
      </div>
      {phase !== 'won' && (
        <div className="battle-q">
          <p className="dev-says">
            <b>Dev so'raydi:</b> {q.q}
          </p>
          {timed && phase === 'fight' && (
            <p className="timer" aria-label={`Qolgan vaqt ${seconds} soniya`}>
              ⏳ {seconds}
            </p>
          )}
          <div className="riddle-options">
            {q.options.map((opt, i) => (
              <button
                key={`${queue[0]}-${i}`}
                type="button"
                className="option"
                disabled={phase !== 'fight'}
                onClick={() => advance(i === q.answer)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
