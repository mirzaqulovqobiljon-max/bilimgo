import { useEffect, useRef, useState } from 'react';
import { useBobo } from '../components/BoboProvider';
import { MISTAKES_BEFORE_HINT } from '../engine/rules';
import type { MiniGameProps } from './types';
import { SpeakButton } from '../components/SpeakButton';

/**
 * "Bosh qotirma" — savol + 2-4 variant.
 * Xato variant o'chadi (bola baribir oxiriga yetadi), 2 xatodan keyin bobo maslahat taklif qiladi.
 */
export function Riddle({ content, tier, onDone, requestHint, delayMs = 900 }: MiniGameProps<'riddle'>) {
  const bobo = useBobo();
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const mistakes = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const q = content.questions[index]!;
  const total = content.questions.length;

  useEffect(() => {
    if (!solved) return;
    const t = setTimeout(() => {
      if (index + 1 >= total) {
        onDoneRef.current({ mistakes: mistakes.current, allowance: total });
      } else {
        setIndex(index + 1);
        setWrong([]);
        setSolved(false);
        setHintShown(false);
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [solved, index, total, delayMs]);

  // Kichik sayyohlarga savol o'qib beriladi (bobo gapi tugagach).
  useEffect(() => {
    if (tier !== 'kichik') return;
    bobo.cancelQueued();
    bobo.speak(q.q, { queue: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tier]);

  const choose = (i: number) => {
    if (solved || wrong.includes(i)) return;
    if (i === q.answer) {
      setSolved(true);
      bobo.say('bobo.praise');
      return;
    }
    mistakes.current += 1;
    const next = [...wrong, i];
    setWrong(next);
    bobo.say(next.length === MISTAKES_BEFORE_HINT ? 'bobo.hint.offer' : 'bobo.encourage');
  };

  const hint = () => {
    if (requestHint()) {
      bobo.say({ text: q.hint }, 'oylaydi');
      setHintShown(true);
    } else {
      bobo.say('bobo.hint.none');
    }
  };

  const showHintButton = wrong.length >= MISTAKES_BEFORE_HINT && !solved && !hintShown;

  return (
    <section className={`riddle tier-${tier}`} aria-label="Bosh qotirma">
      <p className="progress-dots" aria-label={`Savol ${index + 1} / ${total}`}>
        {content.questions.map((_, i) => (
          <span key={i} className={i < index || (i === index && solved) ? 'dot done' : i === index ? 'dot now' : 'dot'} />
        ))}
      </p>
      {q.picture && (
        <div className="riddle-picture" aria-hidden="true">
          {q.picture}
        </div>
      )}
      <div className="q-row">
        <h2 className="riddle-q">{q.q}</h2>
        <SpeakButton text={q.q} />
      </div>
      <div className="riddle-options" role="group" aria-label="Javob variantlari">
        {q.options.map((opt, i) => {
          const isWrong = wrong.includes(i);
          const isRight = solved && i === q.answer;
          return (
            <button
              key={`${index}-${i}`}
              type="button"
              className={`option${isWrong ? ' wrong' : ''}${isRight ? ' right' : ''}`}
              disabled={isWrong || solved}
              aria-label={isRight ? `${opt} — to'g'ri` : opt}
              onClick={() => choose(i)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {showHintButton && (
        <button type="button" className="btn hint" onClick={hint}>
          💡 Maslahat
        </button>
      )}
    </section>
  );
}
