import { useBobo } from './BoboProvider';

/** Hikmat bobo: oq soqol, salla, chopon, hassa. Rassom chizgunicha vaqtinchalik SVG. */
export function BoboAvatar({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" aria-hidden="true" className="bobo-avatar">
      <rect x="82" y="30" width="5" height="82" rx="2" fill="#7a4a21" />
      <circle cx="84.5" cy="30" r="5" fill="#8d5a2b" />
      <path d="M18 112 C18 72 30 62 50 62 C70 62 82 72 82 112Z" fill="#2f6b4f" />
      <g stroke="#e8c15a" strokeWidth="2.2" fill="none" opacity=".9">
        <path d="M30 112 C30 85 34 72 40 66" />
        <path d="M70 112 C70 85 66 72 60 66" />
        <path d="M24 112 C24 90 28 76 33 69" />
        <path d="M76 112 C76 90 72 76 67 69" />
      </g>
      <circle cx="50" cy="42" r="18" fill="#f2c9a0" />
      <path d="M32 44 C33 72 42 82 50 84 C58 82 67 72 68 44 C62 52 56 55 50 55 C44 55 38 52 32 44Z" fill="#fafafa" />
      <path d="M41 52 Q50 47 59 52 Q50 50 41 52Z" fill="#e6e6e6" />
      <circle cx="43.5" cy="40" r="2.2" fill="#3b2a1a" />
      <circle cx="56.5" cy="40" r="2.2" fill="#3b2a1a" />
      <path d="M39 35 q4 -3 8 0 M53 35 q4 -3 8 0" stroke="#ddd" strokeWidth="2" fill="none" />
      <path d="M30 33 C30 14 70 14 70 33 C66 27 34 27 30 33Z" fill="#fff" />
      <path d="M31 31 C40 24 60 24 69 31" stroke="#d9d9d9" strokeWidth="2.5" fill="none" />
      <path d="M33 27 C42 20 58 20 67 27" stroke="#e3e3e3" strokeWidth="2" fill="none" />
      <circle cx="50" cy="18" r="4" fill="#1e88a8" />
    </svg>
  );
}

export function Bobo() {
  const bobo = useBobo();
  return (
    <aside className="bobo" aria-label="Hikmat bobo">
      <button type="button" className="bobo-figure" onClick={bobo.help} aria-label="Bobo, yordam ber">
        <BoboAvatar />
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
