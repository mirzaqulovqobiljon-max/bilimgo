import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBobo } from '../components/BoboProvider';
import { sfx } from '../audio/sfx';
import { img } from '../assets';
import {
  HORSE_X,
  idealLead,
  initialRunner,
  jump,
  nextObstacle,
  stepRunner,
  type RunnerState,
  type RunnerTier,
} from '../engine/runner';
import type { MiniGameProps } from './types';
import { useTicker, type Ticker } from './ticker';

/** Ekranda ko'rinadigan dunyo eni (metr). */
const VIEW_M = 14;
const GROUND = 0.2; // pastdan 20% — yer chizig'i
export const ASSIST_AFTER = 3;

/**
 * Ot bilan to'siqlar: ot o'zi yuguradi, bola to'g'ri paytda sakraydi (Space / ↑ / "SAKRASH" / ekranga tegish).
 * To'siqqa tegsa — +1 xato va chekpoint (o'sha to'siq yana oldinda). 3 xatodan keyin yerda "sakrash nuqtasi" ko'rinadi.
 * Pozitsiyalar har kadrda DOM'ga to'g'ridan-to'g'ri yoziladi (React qayta chizmaydi) — arzon telefonda ham ravon.
 */
export function HorseRunner({ content, tier, onDone, requestHint, delayMs = 900, ticker: tickerProp }: MiniGameProps<'horse'> & { ticker?: Ticker }) {
  const bobo = useBobo();
  const ctxTicker = useTicker();
  const ticker = tickerProp ?? ctxTicker;
  const t = tier as RunnerTier;
  const practice = tier !== 'olim';
  const initial = useMemo(() => initialRunner(content.track, t, practice), [content.track, t, practice]);
  const st = useRef<RunnerState>(initial);
  const [phase, setPhase] = useState<'ready' | 'run' | 'paused' | 'done'>('ready');
  const [hud, setHud] = useState({ mistakes: 0, stars: 0, progress: 0, waiting: false });
  const [assist, setAssist] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const horse = useRef<HTMLDivElement>(null);
  const obsEls = useRef(new Map<number, HTMLDivElement>());
  const starEls = useRef(new Map<number, HTMLImageElement>());
  const markerEl = useRef<HTMLDivElement>(null);
  const finishEl = useRef<HTMLDivElement>(null);
  const bgEl = useRef<HTMLDivElement>(null);
  const groundEl = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const collected = useRef(new Set<number>());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const assistRef = useRef(assist);
  assistRef.current = assist;
  const count = initial.obstacles.length;

  /** Dunyo holatini ekranga chizish (faqat transform/opacity — reflow yo'q). */
  const paint = useCallback(() => {
    const s = st.current;
    const w = box.current?.clientWidth ?? 360;
    const ppm = w / VIEW_M;
    const sx = (x: number) => (x - HORSE_X) * ppm;
    if (horse.current) {
      const tilt = s.y > 0 ? (s.vy > 0 ? -10 : 8) : 0;
      horse.current.style.transform = `translate(0, ${-s.y * ppm}px) rotate(${tilt}deg)`;
      horse.current.classList.toggle('air', s.y > 0);
      horse.current.classList.toggle('stun', s.t < s.stunUntil);
    }
    for (const o of s.obstacles) {
      const el = obsEls.current.get(o.id);
      if (el) el.style.transform = `translateX(${sx(o.x)}px)`;
      const star = starEls.current.get(o.id);
      if (star) {
        star.style.transform = `translate(${sx(o.x)}px, ${-2.1 * ppm}px)`;
        star.style.opacity = collected.current.has(o.id) ? '0' : '1';
      }
    }
    const nxt = nextObstacle(s);
    if (markerEl.current) {
      markerEl.current.style.opacity = assistRef.current && nxt ? '1' : '0';
      if (nxt) markerEl.current.style.transform = `translateX(${sx(nxt.x - idealLead(t))}px)`;
    }
    if (finishEl.current) finishEl.current.style.transform = `translateX(${sx(s.finishX)}px)`;
    if (groundEl.current) groundEl.current.style.backgroundPositionX = `${-scroll.current * ppm}px`;
    if (box.current) {
      box.current.dataset.next = nxt ? (nxt.x - HORSE_X).toFixed(2) : '';
      box.current.dataset.y = s.y.toFixed(2);
      box.current.dataset.lead = idealLead(t).toFixed(2);
    }
  }, [t]);

  const sync = () => {
    const s = st.current;
    setHud((h) => {
      const progress = Math.round((s.dist / s.total) * 100);
      return h.mistakes === s.mistakes && h.stars === s.stars && h.progress === progress && h.waiting === s.practiceWaiting
        ? h
        : { mistakes: s.mistakes, stars: s.stars, progress, waiting: s.practiceWaiting };
    });
  };

  const doJump = useCallback(() => {
    if (phaseRef.current === 'ready') {
      setPhase('run');
      return;
    }
    if (phaseRef.current !== 'run') return;
    const { state, event } = jump(st.current);
    st.current = state;
    if (event === 'jump') sfx.play('jump');
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // asosiy sikl
  useEffect(() => {
    if (phase !== 'run') return;
    return ticker((dt) => {
      const before = st.current;
      if (before.done) return;
      const passedBefore = new Set(before.obstacles.filter((o) => o.passed).map((o) => o.id));
      const { state, events } = stepRunner(before, dt, t);
      st.current = state;
      scroll.current += Math.max(0, state.dist - before.dist); // fon faqat oldinga siljiydi
      if (events.includes('star')) {
        for (const o of state.obstacles) if (o.passed && o.star && !passedBefore.has(o.id)) collected.current.add(o.id);
        sfx.play('magic');
      }
      if (events.includes('practice')) bobo.say('bobo.horse.practice', 'korsatadi');
      if (events.includes('hit')) {
        sfx.play('wrong');
        if (state.mistakes === ASSIST_AFTER) {
          setAssist(true);
          bobo.say('bobo.horse.assist', 'korsatadi');
        } else bobo.say('bobo.horse.hit', undefined, { ifIdle: true });
      }
      if (events.includes('pass')) sfx.play('tap');
      if (events.includes('finish')) {
        sfx.play('fanfare');
        bobo.say('bobo.praise');
        setPhase('done');
      }
      paint();
      if (events.length || Math.random() < 0.1) sync();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ticker, t, paint]);

  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(() => onDoneRef.current({ mistakes: st.current.mistakes, allowance: Math.ceil(count / 4) }), delayMs);
    return () => clearTimeout(timer);
  }, [phase, delayMs, count]);

  // klaviatura: Space / ↑ — sakrash, P / Escape — pauza
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (!e.repeat) doJump();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        setPhase((p) => (p === 'run' ? 'paused' : p === 'paused' ? 'run' : p));
      }
    };
    window.addEventListener('keydown', onKey);
    const onHide = () => document.hidden && setPhase((p) => (p === 'run' ? 'paused' : p));
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [doJump]);

  useEffect(() => {
    paint();
    const onResize = () => paint();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [paint]);

  const hint = () => {
    if (!requestHint()) {
      bobo.say('bobo.hint.none');
      return;
    }
    setAssist(true);
    bobo.say({ text: content.hint }, 'oylaydi');
  };

  return (
    <section className={`mg horse tier-${tier} phase-${phase}`} aria-label="Ot bilan to'siqlar">
      <div className="mg-hud" role="status">
        <span>🐎 {hud.progress}%</span>
        <span>⭐ {hud.stars}</span>
        <span>
          ⚠️ {hud.mistakes}
        </span>
        <button
          type="button"
          className="btn small"
          onClick={() => setPhase((p) => (p === 'run' ? 'paused' : p === 'paused' ? 'run' : p))}
          disabled={phase === 'ready' || phase === 'done'}
          aria-label={phase === 'paused' ? 'Davom etish' : 'Pauza'}
        >
          {phase === 'paused' ? '▶️' : '⏸️'}
        </button>
      </div>
      <div className="hr-progress" aria-hidden="true">
        <span style={{ width: `${hud.progress}%` }} />
        <i>🏁</i>
      </div>
      <div ref={box} className="hr-box" onPointerDown={(e) => (e.preventDefault(), doJump())}>
        <div ref={bgEl} className="hr-bg" style={{ backgroundImage: `url(${img.minigame('ot', 'fon.webp')})` }} />
        <div ref={groundEl} className="hr-ground" style={{ backgroundImage: `url(${img.minigame('ot', 'yer.webp')})`, height: `${GROUND * 100}%` }} />
        <div className="hr-world" style={{ bottom: `${GROUND * 100}%` }}>
          <div ref={markerEl} className="hr-marker" aria-hidden="true" />
          <div ref={finishEl} className="hr-finish" aria-hidden="true">
            🏁
          </div>
          {initial.obstacles.map((o) => (
            <div key={o.id} ref={(el) => (el ? obsEls.current.set(o.id, el) : obsEls.current.delete(o.id))} className={`hr-obstacle ${o.kind}`}>
              <img src={img.minigame('ot', 'xoda.webp')} alt="" draggable={false} />
              {o.kind === 'baland' && <img className="top" src={img.minigame('ot', 'xoda.webp')} alt="" draggable={false} />}
            </div>
          ))}
          {initial.obstacles
            .filter((o) => o.star)
            .map((o) => (
              <img
                key={`s${o.id}`}
                ref={(el) => (el ? starEls.current.set(o.id, el) : starEls.current.delete(o.id))}
                className="hr-star"
                src={img.minigame('ot', 'yulduz.webp')}
                alt=""
                draggable={false}
              />
            ))}
          <div ref={horse} className={`hr-horse${phase === 'run' ? ' running' : ''}`}>
            <img src={img.minigame('ot', 'ot.webp')} alt="Chavandoz bola ot ustida" draggable={false} />
          </div>
        </div>
        {phase === 'ready' && (
          <div className="hr-overlay">
            <p>
              To'siqqa yaqinlashganda <b>SAKRASH</b> tugmasini bos.
              <br />
              Kompyuterda: <kbd>Space</kbd> yoki <kbd>↑</kbd>
            </p>
            <button type="button" className="btn primary big" onClick={() => setPhase('run')}>
              ▶ Boshlash
            </button>
          </div>
        )}
        {phase === 'paused' && (
          <div className="hr-overlay">
            <p>Pauza</p>
            <button type="button" className="btn primary big" onClick={() => setPhase('run')}>
              ▶ Davom etish
            </button>
          </div>
        )}
      </div>
      <div className="mg-actions">
        <button
          type="button"
          className={`btn primary big hr-jump${hud.waiting ? ' pulse' : ''}`}
          onPointerDown={(e) => (e.preventDefault(), doJump())}
          onKeyDown={(e) => (e.key === 'Enter' ? doJump() : undefined)}
          disabled={phase === 'done' || phase === 'paused'}
        >
          ⤴ SAKRASH
        </button>
        <button type="button" className="btn hint" onClick={hint} disabled={phase === 'done' || assist}>
          💡 Qachon sakray?
        </button>
      </div>
    </section>
  );
}
