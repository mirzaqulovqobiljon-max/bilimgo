import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import type { RiddleQuestion, Tier } from '../content/schema';
import { BATTLE_HP } from '../content/validate';
import { useBobo } from './BoboProvider';
import { img } from '../assets';
import { SpeakButton } from './SpeakButton';
import { ShieldPhase } from './battle/ShieldPhase';
import { RunePhase } from './battle/RunePhase';
import type { Rng } from '../engine/random';
import type { Ticker } from '../minigames/ticker';

/** Olim darajasida har bir savolga vaqt (rejada: "7 ta savol, vaqt bilan"). */
export const OLIM_SECONDS_PER_QUESTION = 25;

/** Devning gaplari — dev ovozida yozilgan (tools/ovoz/manifest.py DEV_LINES bilan bir xil; test tekshiradi). */
export const DEV_LINES = {
  intro: 'Ho-ho! Bilim kitobini olmoqchimisan? Avval savollarimga javob ber!',
  sorryKichik: "Kechiring! Kitobni qaytaraman, endi yaxshi bo'laman!",
  defeated: 'Voy-voy! Bilimning kuchi mendan ham kuchli ekan!',
} as const;

/** Yakuniy jangning yangi fazalaridagi dev gaplari (dev ovozida). */
export const DEV_PHASE_LINES = {
  shield: 'Mana, sehrimni qaytar-chi!',
  runes: 'Sehrli belgilarimni hech kim topa olmaydi!',
} as const;

/** Yakuniy jang: 1 — bilim savollari, 2 — qalqon (vaqtni tanlash), 3 — sehrli belgilar ketma-ketligi. */
export type Stage = 'quiz' | 'shield' | 'runes';
export const STAGE_LABEL: Record<Stage, string> = { quiz: '1/3 • Bilim savollari', shield: '2/3 • Qalqon', runes: '3/3 • Sehrli belgilar' };
/** Faza jonning qolgan qismidan kelib chiqadi: oxirgi 2 zarba — qalqon va belgilar fazalari. HP 5/5/7 o'zgarmaydi. */
export function stageFor(hp: number): Stage {
  return hp > 2 ? 'quiz' : hp === 2 ? 'shield' : 'runes';
}
const PHASE1_LINE = "Kuch emas, bilim g'alaba keltiradi!";

type Phase = 'fight' | 'hit' | 'block' | 'won';

interface Props {
  tier: Tier;
  questions: RiddleQuestion[];
  onDone(result: { mistakes: number }): void;
  delayMs?: number;
  /** Uch fazali yakuniy jang (texnik topshiriq 7-bo'lim). Yo'q bo'lsa — avvalgi savol-javob jangi. */
  finale?: boolean;
  rng?: Rng;
  ticker?: Ticker;
}

function DevFigure({ state, tier }: { state: Phase; tier: Tier }) {
  // Kichiklarda dev o'ldirilmaydi: kichrayib, kechirim so'raydi. Kattalarda — tutunga aylanadi.
  const src = state === 'won' ? img.dev(tier === 'kichik' ? 'kechirim' : 'tutun') : img.dev(state === 'hit' ? 'zarba' : 'oddiy');
  return <img src={src} alt="" aria-hidden="true" draggable={false} className={`dev dev-${state}${tier === 'kichik' ? ' dev-soft' : ''}`} />;
}

/**
 * Dev jangi. To'g'ri javob — qilich zarbasi (jon chizig'i kamayadi).
 * Xato yoki vaqt tugashi — devning zarbasini qalqon to'sadi; savol keyinroq qaytadi.
 * Bola hech qachon "o'lmaydi". Kichiklarda dev o'ldirilmaydi: sehri sinadi, kichrayib, kechirim so'rab qochadi.
 */
export function DevBattle({ tier, questions, onDone, delayMs = 900, finale = false, rng, ticker }: Props) {
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
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const stage: Stage = finale ? stageFor(hp) : 'quiz';
  const inQuiz = stage === 'quiz';

  // Faza almashganda: qisqa o'tish yozuvi, bobo va dev gaplari
  const prevStage = useRef<Stage>(stage);
  useEffect(() => {
    if (!finale || phase === 'won' || prevStage.current === stage) return;
    prevStage.current = stage;
    setBanner(STAGE_LABEL[stage]);
    const t = setTimeout(() => setBanner(null), Math.max(delayMs, 1) * 1.4);
    if (stage === 'shield') bobo.say('bobo.battle.phase2', 'korsatadi');
    if (stage === 'runes') bobo.say('bobo.battle.phase3', 'korsatadi');
    if (stage !== 'quiz') bobo.speak(DEV_PHASE_LINES[stage], { voice: 'dev', queue: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, finale]);

  const stageDone = (misses: number) => {
    mistakes.current += misses;
    sfx.play('correct');
    const next = hp - 1;
    setHp(next);
    setPhase(next <= 0 ? 'won' : 'hit');
  };

  // Dev o'zini tanishtiradi (bobo kirish so'zidan keyin).
  useEffect(() => {
    if (finale) bobo.speak(PHASE1_LINE, { queue: true });
    bobo.speak(DEV_LINES.intro, { voice: 'dev', queue: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Har bir savolni dev o'z ovozida so'raydi (bobo maqtovi/qalqon gapi tugagach).
  const qText = phase === 'fight' && inQuiz ? q.q : null;
  useEffect(() => {
    if (!qText) return;
    bobo.speak(qText, { voice: 'dev', queue: true });
    return () => bobo.cancelQueued();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText, queue[0]]);

  const advance = (correct: boolean) => {
    const [cur, ...rest] = queue;
    if (correct) setQueue([...rest, cur!]);
    else {
      // xato javob berilgan savol bitta savoldan keyin yana so'raladi — bola uni o'rganib oladi
      const next = [...rest];
      next.splice(Math.min(1, next.length), 0, cur!);
      setQueue(next);
    }
    sfx.play(correct ? 'correct' : 'wrong');
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
      bobo.speak(tier === 'kichik' ? DEV_LINES.sorryKichik : DEV_LINES.defeated, { voice: 'dev', queue: true });
      const t = setTimeout(() => onDoneRef.current({ mistakes: mistakes.current }), delayMs * 3);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (!timed || phase !== 'fight' || !inQuiz || paused) return;
    if (seconds <= 0) {
      advance(false);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, phase, seconds, inQuiz, paused]);

  return (
    <section
      className={`battle phase-${phase}${finale ? ` finale stage-${stage}` : ''}`}
      aria-label="Dev bilan jang"
      style={finale ? { backgroundImage: `url(${img.minigame('jang', 'sahna.webp')})` } : undefined}
    >
      {finale && (
        <div className="stage-bar">
          <span className="stage-label">{STAGE_LABEL[stage]}</span>
          {phase !== 'won' && (
            <button type="button" className="btn small" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Davom etish' : 'Pauza'}>
              {paused ? '▶️' : '⏸️'}
            </button>
          )}
        </div>
      )}
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
            {tier === 'kichik' ? (
              DEV_LINES.sorryKichik
            ) : (
              <>
                {DEV_LINES.defeated} <span className="muted">Dev tutunga aylanib g'oyib bo'ldi.</span>
              </>
            )}
          </p>
        )}
      </div>
      {banner && (
        <div className="stage-banner" role="status">
          {banner}
        </div>
      )}
      {finale && paused && phase !== 'won' && (
        <div className="battle-pause">
          <p>Pauza</p>
          <button type="button" className="btn primary big" onClick={() => setPaused(false)}>
            ▶ Davom etish
          </button>
        </div>
      )}
      {phase !== 'won' && stage === 'shield' && !banner && (
        <>
          <p className="dev-says">{DEV_PHASE_LINES.shield}</p>
          {phase === 'fight' && <ShieldPhase tier={tier} paused={paused} onDone={stageDone} ticker={ticker} />}
        </>
      )}
      {phase !== 'won' && stage === 'runes' && !banner && (
        <>
          <p className="dev-says">{DEV_PHASE_LINES.runes}</p>
          {phase === 'fight' && <RunePhase tier={tier} rng={rng} onDone={stageDone} />}
        </>
      )}
      {phase !== 'won' && inQuiz && (
        <div className="battle-q">
          {hp === maxHp && mistakes.current === 0 && <p className="dev-intro">{DEV_LINES.intro}</p>}
          <div className="q-row">
            <p className="dev-says">
              <b>Dev so'raydi:</b> {q.q}
            </p>
            <SpeakButton text={q.q} voice="dev" />
          </div>
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
