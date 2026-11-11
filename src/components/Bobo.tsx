import { useBobo } from './BoboProvider';
import { BOBO_MOODS, img, type BoboMood } from '../assets';

/** Hikmat bobo rasmi (4 holat). Hamma holatlar oldindan yuklanadi — almashganda miltillamasin. */
export function BoboAvatar({ size = 84, mood = 'gapiradi' }: { size?: number; mood?: BoboMood }) {
  return (
    <span className="bobo-avatar" style={{ width: size, height: size * (7 / 6) }} aria-hidden="true" data-mood={mood}>
      {BOBO_MOODS.map((m) => (
        <img key={m} src={img.bobo(m)} alt="" draggable={false} className={m === mood ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Bobo() {
  const bobo = useBobo();
  return (
    <aside className="bobo" aria-label="Hikmat bobo">
      <button type="button" className="bobo-figure" onClick={bobo.help} aria-label="Bobo, yordam ber">
        <BoboAvatar mood={bobo.mood} />
        <span className="bobo-name">Bobo</span>
      </button>
      {bobo.current && (
        <p className="bobo-bubble" role="status" aria-live="polite" key={bobo.current.text}>
          {bobo.current.text}
        </p>
      )}
      <button
        type="button"
        className="bobo-mute"
        onClick={bobo.toggleMute}
        aria-pressed={bobo.muted}
        aria-label={bobo.muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
      >
        {bobo.muted ? '🔇' : '🔊'}
      </button>
    </aside>
  );
}
