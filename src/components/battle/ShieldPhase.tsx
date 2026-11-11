import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import type { Tier } from '../../content/schema';
import { useTicker, type Ticker } from '../../minigames/ticker';
import { useBobo } from '../BoboProvider';

/** Nechta sharni qaytarish kerak. */
export const SHIELD_BLOCKS = 3;
/** Shar devdan bolagacha uchish vaqti (s) va qalqon ishlaydigan oraliq (yo'lning shu qismidan keyin). */
export const SHIELD_TUNING: Record<Tier, { flight: number; zone: number }> = {
  kichik: { flight: 2.6, zone: 0.5 },
  karvon: { flight: 2.0, zone: 0.62 },
  olim: { flight: 1.5, zone: 0.7 },
};
const GAP = 0.8; // sharlar orasidagi tanaffus

type Shot = { p: number; state: 'fly' | 'blocked' | 'missed' | 'gap'; wait: number };

/** Sof qadam: testlarda ham, UI'da ham shu ishlaydi. */
export function stepShield(s: Shot, dt: number, flight: number): { shot: Shot; arrived: boolean } {
  if (s.state !== 'fly') {
    const wait = s.wait - dt;
    return wait <= 0 ? { shot: { p: 0, state: 'fly', wait: 0 }, arrived: false } : { shot: { ...s, wait }, arrived: false };
  }
  const p = s.p + dt / flight;
  return p >= 1 ? { shot: { p: 1, state: 'missed', wait: GAP }, arrived: true } : { shot: { ...s, p }, arrived: false };
}

/**
 * 2-faza: dev sehrli shar otadi, bola shar yaqinlashganda qalqonni ko'taradi (vaqtni to'g'ri tanlash).
 * Erta ko'tarsa yoki kechiksa — shar bolaga zarar bermay "puf" bo'lib yo'qoladi, yana urinadi (+1 xato).
 */
export function ShieldPhase({ tier, paused, onDone, ticker: tickerProp }: { tier: Tier; paused: boolean; onDone(misses: number): void; ticker?: Ticker }) {
  const bobo = useBobo();
  const ctx = useTicker();
  const ticker = tickerProp ?? ctx;
  const { flight, zone } = SHIELD_TUNING[tier];
  const [shot, setShot] = useState<Shot>({ p: 0, state: 'gap', wait: 1.2 });
  const [blocks, setBlocks] = useState(0);
  const [raised, setRaised] = useState(false);
  const shotRef = useRef(shot);
  shotRef.current = shot;
  const misses = useRef(0);
  const blocksRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = blocks >= SHIELD_BLOCKS;

  const miss = () => {
    misses.current += 1;
    sfx.play('wrong');
    bobo.say('bobo.battle.shield.miss', undefined, { ifIdle: true });
  };

  useEffect(() => {
    if (paused || finished) return;
    return ticker((dt) => {
      const { shot: next, arrived } = stepShield(shotRef.current, dt, flight);
      shotRef.current = next;
      setShot(next);
      if (arrived) miss();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, finished, ticker, flight]);

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => doneRef.current(misses.current), 500);
    return () => clearTimeout(t);
  }, [finished]);

  const raise = () => {
    if (paused || finished) return;
    setRaised(true);
    setTimeout(() => setRaised(false), 250);
    const s = shotRef.current;
    if (s.state !== 'fly') return; // shar yo'q — hech narsa bo'lmaydi
    if (s.p >= zone) {
      sfx.play('correct');
      blocksRef.current += 1;
      setBlocks(blocksRef.current);
      const next: Shot = { p: s.p, state: 'blocked', wait: GAP };
      shotRef.current = next;
      setShot(next);
    } else {
      const next: Shot = { p: s.p, state: 'missed', wait: GAP };
      shotRef.current = next;
      setShot(next);
      miss();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) raise();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="phase-shield" data-orb={shot.state === 'fly' ? shot.p.toFixed(3) : ''} data-zone={zone}>
      <p className="phase-goal" role="status">
        🛡️ {blocks} / {SHIELD_BLOCKS} — shar oltin chiziqqa yetganda qalqonni ko'tar!
      </p>
      <div className="shield-lane" aria-hidden="true">
        <span className="shield-zone" style={{ left: 0, width: `${(1 - zone) * 100}%` }} />
        {shot.state !== 'gap' && (
          <span className={`orb ${shot.state}`} style={{ left: `${(1 - shot.p) * 100}%` }} />
        )}
        <span className={`hero-shield${raised ? ' up' : ''}`}>🛡️</span>
      </div>
      <button type="button" className="btn primary big shield-btn" onPointerDown={(e) => (e.preventDefault(), raise())} onKeyDown={(e) => e.key === 'Enter' && raise()} disabled={finished}>
        🛡️ Qalqon
      </button>
    </div>
  );
}
