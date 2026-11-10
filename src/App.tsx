import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentBundle } from './content/validate';
import type { Level } from './content/schema';
import { Bobo } from './components/Bobo';
import { BoboProvider } from './components/BoboProvider';
import { Bag } from './components/Bag';
import { initialProgress, setProfile, tierOf, totalStars, type Progress } from './engine/progress';
import { TIER_LABEL } from './engine/rules';
import type { ProgressStore } from './engine/storage';
import type { Rng } from './engine/random';
import { RegisterScreen } from './screens/RegisterScreen';
import { MapScreen } from './screens/MapScreen';
import { LevelScreen } from './screens/LevelScreen';

interface Props {
  content: ContentBundle;
  store: ProgressStore;
  rng?: Rng;
  delayMs?: number;
}

export function App({ content, store, rng, delayMs }: Props) {
  const [progress, setProgress] = useState<Progress>(() => store.load());
  // Sinxron yangilash: mini-o'yin natijasini (yangi qism, tanga) darhol bilish uchun.
  const ref = useRef(progress);
  const update = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setProgress(next);
  }, []);
  useEffect(() => store.save(progress), [progress, store]);

  const [levelId, setLevelId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const level = useMemo(() => content.levels.find((l) => l.id === levelId) ?? null, [content.levels, levelId]);

  if (!progress.profile) {
    return (
      <BoboProvider dict={content.bobo} rng={rng} idleReminder={false}>
        <RegisterScreen onDone={(p) => update((s) => setProfile(s, p))} />
      </BoboProvider>
    );
  }

  const tier = tierOf(progress);

  return (
    <BoboProvider dict={content.bobo} rng={rng} initialMuted={tier !== 'kichik'}>
      <div className={`app tier-${tier}`}>
        <header className="topbar">
          <span className="who">
            <b>{progress.profile.name}</b>
            <small>{TIER_LABEL[tier]}</small>
          </span>
          <span className="counter" aria-label={`Jami yulduz: ${totalStars(progress)}`}>⭐ {totalStars(progress)}</span>
          <span className="counter" aria-label={`Jami tanga: ${progress.coins}`}>🪙 {progress.coins}</span>
          <Bag items={content.items} progress={progress} />
        </header>

        {level ? (
          <LevelScreen
            key={level.id}
            level={level}
            content={content}
            progress={progress}
            tier={tier}
            update={update}
            onExit={() => setLevelId(null)}
            rng={rng}
            delayMs={delayMs}
          />
        ) : (
          <>
            <MapScreen levels={content.levels} progress={progress} onEnter={(l: Level) => setLevelId(l.id)} />
            <div className="reset-row">
              {confirmReset ? (
                <>
                  <span>Hamma natija o'chadi. Rozimisiz?</span>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      store.reset();
                      setConfirmReset(false);
                      update(() => initialProgress());
                    }}
                  >
                    Ha, yangi o'yinchi
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => setConfirmReset(false)}>
                    Yo'q
                  </button>
                </>
              ) : (
                <button type="button" className="btn small ghost" onClick={() => setConfirmReset(true)}>
                  O'yinchini almashtirish
                </button>
              )}
            </div>
          </>
        )}
        <Bobo />
      </div>
    </BoboProvider>
  );
}
