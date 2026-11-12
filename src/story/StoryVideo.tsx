import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { audioFor, defaultClipFactory, type Clip, type ClipFactory } from '../audio/voice';
import { sfx, type SfxName } from '../audio/sfx';
import { img } from '../assets';
import { LINE_GAP_MS, SCENE_TAIL_MS, minShowMs, readingMs, safetyMs, type IntroFx, type IntroScript } from './script';

/**
 * Ertak "videosi" (o'yin boshi va oxiri).
 * Haqiqiy MP4 emas: rasmlar + CSS animatsiya + yozilgan ovoz. Sabab: APK/PWA'ga ~0.9 MB qo'shiladi
 * (shu sifatdagi 1 daqiqalik video 5–10 MB bo'lardi), internetsiz ishlaydi, arzon telefonda silliq,
 * matni JSON'da tahrirlanadi, subtitr har doim ko'rinadi (ovozsiz sinfxonada ham tushunarli).
 */
export interface StoryVideoProps {
  script: IntroScript;
  onDone(): void;
  /** Boshlash ekranidagi sarlavha. */
  title: string;
  playLabel?: string;
  endLabel: string;
  ariaLabel: string;
  clipFactory?: ClipFactory;
  base?: string;
}

const SPEAKER = { bobo: 'Hikmat bobo', dev: 'Dev' } as const;

/** Sahna ichidagi qo'shimcha tovushlar (ms — sahna boshidan). CSS animatsiya vaqtlari bilan bir xil. */
export const FX_SFX: Partial<Record<IntroFx, Array<[number, SfxName]>>> = {
  'dev-steals': [
    [1000, 'magic'],
    [2200, 'whoosh'],
    [4900, 'whoosh'],
  ],
  'dev-sorry': [[600, 'magic']],
};

const LETTERS = ['A', 'B', '1', "O'", '2', 'K', '3', 'Sh', '5', 'D'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => i);

type Phase = 'ready' | 'playing' | 'end';

export function StoryVideo({
  script,
  onDone,
  title,
  playLabel = "▶ Ertakni ko'rish",
  endLabel,
  ariaLabel,
  clipFactory = defaultClipFactory,
  base = import.meta.env.BASE_URL ?? './',
}: StoryVideoProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [scene, setScene] = useState(0);
  const [line, setLine] = useState(0);
  /** Sahnaning birinchi gapi leadMs dan keyin ko'rinadi. */
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const clip = useRef<Clip | null>(null);
  const sceneStart = useRef(0);
  const finishLine = useRef<(() => void) | null>(null);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clip.current?.stop();
    clip.current = null;
    finishLine.current = null;
  }, []);
  useEffect(() => {
    // video o'z ovoz tugmasiga ega; yopilganda o'yindagi tovush holati tiklanadi
    const before = sfx.isMuted;
    return () => {
      stopAll();
      sfx.setMuted(before);
    };
  }, [stopAll]);

  const sc = script.scenes[scene]!;
  const ln = sc.lines[line]!;

  // Sahna boshlanishi: tovush effektlari, so'ng (leadMs dan keyin) birinchi gap
  useEffect(() => {
    if (phase !== 'playing') return;
    sceneStart.current = Date.now();
    sfx.setMuted(mutedRef.current);
    if (sc.sfx) sfx.play(sc.sfx);
    for (const [ms, name] of FX_SFX[sc.fx] ?? []) later(ms, () => sfx.play(name));
    if (sc.leadMs) later(sc.leadMs, () => setSpeaking(true));
    else setSpeaking(true);
  }, [phase, scene, sc, later]);

  // Har bir gap: ovoz (bo'lsa) -> tugashini kutish -> keyingi gap / sahna
  useEffect(() => {
    if (phase !== 'playing' || !speaking) return;
    let done = false;
    const startedAt = Date.now();
    const advance = () => {
      if (line + 1 < sc.lines.length) {
        later(LINE_GAP_MS, () => setLine(line + 1));
        return;
      }
      const left = Math.max(0, (sc.minMs ?? 0) - (Date.now() - sceneStart.current));
      later(left + SCENE_TAIL_MS, () => {
        setSpeaking(false);
        if (scene + 1 < script.scenes.length) {
          setLine(0);
          setScene(scene + 1);
        } else setPhase('end');
      });
    };
    const next = () => {
      if (done) return;
      done = true;
      finishLine.current = null;
      clip.current?.stop();
      clip.current = null;
      // ovoz juda tez tugasa (yoki brauzer blokladi) — matn o'qib ulgurilguncha turadi
      const wait = Math.max(0, minShowMs(ln.text) - (Date.now() - startedAt));
      if (wait > 0) later(wait, advance);
      else advance();
    };
    finishLine.current = next;

    const file = audioFor(ln.text, ln.voice);
    if (file && !mutedRef.current) {
      const c = clipFactory(base + file);
      clip.current = c;
      c.onEnd(next);
      void c.play();
      later(safetyMs(ln.text), next);
    } else {
      later(readingMs(ln.text), next);
    }
    return () => {
      done = true;
    };
  }, [phase, speaking, scene, line, sc, ln, script, clipFactory, base, later]);

  const start = () => {
    stopAll();
    setSpeaking(false);
    setScene(0);
    setLine(0);
    setPhase('playing');
  };
  const skip = () => {
    stopAll();
    onDone();
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    sfx.setMuted(m);
    if (m && clip.current) {
      clip.current.stop();
      clip.current = null;
      finishLine.current?.();
    }
  };

  const progress =
    phase === 'end' ? 100 : phase === 'ready' ? 0 : Math.round(((scene + line / sc.lines.length) / script.scenes.length) * 100);
  const lastLine = sc.lines[sc.lines.length - 1]!;

  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={`story-frame fx-${sc.fx}`} data-scene={sc.id} data-phase={phase}>
        <div className="story-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        {/* key: har sahnada animatsiyalar boshidan boshlanadi */}
        <div key={`${sc.id}-${phase === 'ready' ? 'r' : 'p'}`} className="story-scene">
          <img className="story-bg" src={sc.bg} alt="" draggable={false} />
          {phase !== 'ready' && <Effects fx={sc.fx} />}
        </div>

        <div className="story-controls">
          <button type="button" className="story-btn" onClick={toggleMute} aria-label={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}>
            {muted ? '🔇' : '🔊'}
          </button>
          {phase !== 'end' && (
            <button type="button" className="story-btn" onClick={skip}>
              O'tkazib yuborish ⏭
            </button>
          )}
        </div>

        {phase === 'ready' && (
          <div className="story-start">
            <h1>{title}</h1>
            <button type="button" className="btn big story-play" onClick={start} autoFocus>
              {playLabel}
            </button>
          </div>
        )}

        {phase === 'playing' && speaking && (
          <div className={`story-sub voice-${ln.voice}`} aria-live="polite">
            <b>{SPEAKER[ln.voice]}</b>
            <p key={`${scene}-${line}`}>{ln.text}</p>
          </div>
        )}

        {phase === 'end' && (
          <div className={`story-sub voice-${lastLine.voice}`}>
            <b>{SPEAKER[lastLine.voice]}</b>
            <p>{lastLine.text}</p>
            <div className="story-end-row">
              <button type="button" className="btn big story-go" onClick={onDone} autoFocus>
                {endLabel}
              </button>
              <button type="button" className="btn small ghost" onClick={start}>
                ↺ Qayta ko'rish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const letters = (cls: string) => (
  <div className={`sfx-letters ${cls}`} aria-hidden="true">
    {LETTERS.map((ch, i) => (
      <span key={i} style={{ '--i': i } as CSSProperties}>
        {ch}
      </span>
    ))}
  </div>
);

function Effects({ fx }: { fx: IntroFx }) {
  switch (fx) {
    case 'sunny':
      return (
        <>
          <div className="sfx-sun" />
          <div className="sfx-birds" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </>
      );
    case 'book-glow':
      return (
        <>
          <div className="sfx-glow" />
          {letters('up')}
        </>
      );
    case 'dev-steals':
      return (
        <>
          <div className="sfx-storm" />
          <div className="sfx-flash" />
          <img className="sfx-book" src="img/intro/kitob.webp" alt="" />
          <div className="sfx-smoke" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <img className="sfx-dev d-tutun" src={img.dev('tutun')} alt="" />
          <img className="sfx-dev d-kuladi" src={img.dev('kuladi')} alt="Dev kitobni olib qo'ydi" />
          <img className="sfx-dev d-uchadi" src={img.dev('uchadi')} alt="" />
        </>
      );
    case 'gloomy':
      return (
        <>
          {letters('down')}
          <div className="sfx-rain" aria-hidden="true" />
        </>
      );
    case 'bobo-calls':
      return (
        <>
          <div className="sfx-warm" />
          <img className="sfx-bobo" src="img/bobo/chaqiradi.webp" alt="Hikmat bobo" />
        </>
      );
    case 'dev-sorry':
      return (
        <>
          <div className="sfx-warm center" />
          <img className="sfx-dev d-kechirim" src={img.dev('kechirim')} alt="Dev kechirim so'rayapti" />
          <div className="sfx-hearts" aria-hidden="true">
            {['💛', '✨', '💜', '✨', '💛'].map((h, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {h}
              </span>
            ))}
          </div>
        </>
      );
    case 'celebrate':
      return (
        <>
          <div className="sfx-confetti" aria-hidden="true">
            {CONFETTI.map((i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
          <img className="sfx-dev d-friend" src={img.dev('oddiy')} alt="Dev endi do'st" />
        </>
      );
  }
}
