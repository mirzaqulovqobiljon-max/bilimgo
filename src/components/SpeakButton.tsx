import { audioFor, type Voice } from '../audio/voice';
import { useBobo } from './BoboProvider';

/**
 * 🔊 "O'qib ber" tugmasi: o'qishni hali yaxshi bilmagan bola savolni qayta eshitadi.
 * Yozuv bo'lmasa umuman ko'rinmaydi. Bola o'zi bosgani uchun ovoz o'chiq bo'lsa ham gapiradi.
 */
export function SpeakButton({ text, voice = 'bobo' }: { text: string; voice?: Voice }) {
  const bobo = useBobo();
  if (!audioFor(text, voice)) return null;
  return (
    <button
      type="button"
      className="speak-btn"
      aria-label="Savolni o'qib ber"
      onClick={() => bobo.speak(text, { voice, force: true })}
    >
      🔊
    </button>
  );
}
