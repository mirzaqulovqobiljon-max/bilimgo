import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentBundle } from './content/validate';
import type { Level } from './content/schema';
import { Bobo } from './components/Bobo';
import { BoboProvider } from './components/BoboProvider';
import { Bag } from './components/Bag';
import { initialProgress, markIntroSeen, setProfile, shouldAutoplayIntro, tierOf, totalStars, type Progress } from './engine/progress';
import { StoryVideo } from './story/StoryVideo';
import { INTRO } from './story/script';
import { mergeProgress, progressKey } from './engine/merge';
import { TIER_LABEL } from './engine/rules';
import type { ProgressStore } from './engine/storage';
import type { Rng } from './engine/random';
import { RegisterScreen } from './screens/RegisterScreen';
import { MapScreen } from './screens/MapScreen';
import { LevelScreen } from './screens/LevelScreen';
import type { ApiClient, MyClass } from './net/api';
import { loadAccount, saveAccount, type Account } from './net/account';
import { SyncEngine, type SyncStatus } from './net/sync';
import { indexedKV, type KV } from './net/kv';

interface Props {
  content: ContentBundle;
  store: ProgressStore;
  rng?: Rng;
  delayMs?: number;
  /** Bo'lsa — sinf kodi bilan kirish va server bilan sinxronlash. */
  api?: ApiClient;
  kv?: KV;
}

const SYNC_ICON: Record<SyncStatus, { icon: string; label: string }> = {
  idle: { icon: '☁️', label: 'Sinxronlash kutilmoqda' },
  syncing: { icon: '⏳', label: 'Natijalar yuborilmoqda' },
  synced: { icon: '☁️✓', label: 'Natijalar saqlandi' },
  offline: { icon: '📴', label: "Internet yo'q — natijalar shu qurilmada saqlanib turibdi" },
  'auth-error': { icon: '⚠️', label: 'Qayta kirish kerak' },
};

function ClassGoal({ data }: { data: MyClass }) {
  const pct = Math.min(100, Math.round((data.goal.stars / data.goal.target) * 100));
  return (
    <section className="class-goal" aria-label="Sinf maqsadi">
      <p>
        <b>{data.class.name}</b> sinf maqsadi: ⭐ {data.goal.stars} / {data.goal.target}
      </p>
      <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {data.ranking && (
        <ol className="ranking" aria-label="Sinf reytingi">
          {data.ranking.slice(0, 5).map((r) => (
            <li key={r.rank}>
              {r.rank}. {r.name} — ⭐ {r.stars}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function App({ content, store, rng, delayMs, api, kv }: Props) {
  const [progress, setProgress] = useState<Progress>(() => store.load());
  const [account, setAccount] = useState<Account | null>(() => (api ? loadAccount() : null));
  // Sinxron yangilash: mini-o'yin natijasini (yangi qism, tanga) darhol bilish uchun.
  const ref = useRef(progress);
  const update = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setProgress(next);
  }, []);
  useEffect(() => store.save(progress), [progress, store]);

  // ---------- Server bilan sinxronlash ----------
  const kvStore = useMemo(() => kv ?? indexedKV(), [kv]);
  const engine = useMemo(() => {
    if (!api || !account) return null;
    const client = api.withToken(account.token);
    return new SyncEngine(
      client,
      kvStore,
      (merged) =>
        update((p) => {
          const m = mergeProgress(p, merged);
          return progressKey(m) === progressKey(p) ? p : m;
        }),
      { key: account.studentId },
    );
  }, [api, account, kvStore, update]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const lastPushed = useRef<string>('');

  useEffect(() => {
    if (!engine) return;
    const off = engine.subscribe(setSyncStatus);
    void engine.pull(ref.current).then((merged) => {
      lastPushed.current = progressKey(merged);
      update(() => merged);
      if (introAfterSync.current) {
        introAfterSync.current = false;
        if (shouldAutoplayIntro(merged)) setShowIntro(true);
      }
    });
    return () => {
      off();
      engine.stop();
    };
  }, [engine, update]);

  useEffect(() => {
    if (!engine || !progress.profile) return;
    const key = progressKey(progress);
    if (key === lastPushed.current) return;
    lastPushed.current = key;
    void engine.push(progress);
  }, [engine, progress]);

  const [levelId, setLevelId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Ertak: yangi o'yinchiga avtomatik (bir marta), keyin xaritadagi tugma orqali
  const [showIntro, setShowIntro] = useState(() => shouldAutoplayIntro(ref.current));
  const introAfterSync = useRef(false);
  const closeIntro = useCallback(() => {
    setShowIntro(false);
    update(markIntroSeen);
  }, [update]);
  const level = useMemo(() => content.levels.find((l) => l.id === levelId) ?? null, [content.levels, levelId]);

  useEffect(() => {
    if (!engine || !account || levelId) return;
    const client = api!.withToken(account.token);
    client.myClass().then(setMyClass, () => {});
  }, [engine, account, levelId, api, syncStatus]);

  if (!progress.profile) {
    return (
      <BoboProvider dict={content.bobo} rng={rng} idleReminder={false}>
        <RegisterScreen
          api={api}
          onDone={(p, acc) => {
            if (acc) {
              saveAccount(acc);
              setAccount(acc);
            }
            update((s) => setProfile(s, p));
            // sinf kodi bilan kirganda: avval serverdagi natijalar kelsin — boshqa qurilmada
            // o'ynab yurgan o'quvchiga ertak qayta chiqmasin (qaror pull'dan keyin)
            if (acc) introAfterSync.current = true;
            else if (shouldAutoplayIntro(ref.current)) setShowIntro(true);
          }}
        />
      </BoboProvider>
    );
  }

  const tier = tierOf(progress);
  const reset = () => {
    store.reset();
    setConfirmReset(false);
    if (account) {
      saveAccount(null);
      setAccount(null);
      setMyClass(null);
    }
    lastPushed.current = '';
    update(() => initialProgress());
  };

  if (showIntro) {
    return (
      <StoryVideo
        script={INTRO}
        onDone={closeIntro}
        title="Ipak yo'li sarguzashti"
        endLabel="Ha, yo'lga chiqamiz! 🐪"
        ariaLabel="Ertak: o'yin boshlanishi"
      />
    );
  }

  return (
    <BoboProvider dict={content.bobo} rng={rng} initialMuted={tier !== 'kichik'}>
      <div className={`app tier-${tier}`}>
        <header className="topbar">
          <span className="who">
            <b>{progress.profile.name}</b>
            <small>
              {TIER_LABEL[tier]}
              {account && ` · ${account.className}`}
            </small>
          </span>
          {engine && (
            <span className="sync" role="status" aria-label={SYNC_ICON[syncStatus].label} title={SYNC_ICON[syncStatus].label}>
              {SYNC_ICON[syncStatus].icon}
            </span>
          )}
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
            {myClass && <ClassGoal data={myClass} />}
            <MapScreen levels={content.levels} progress={progress} onEnter={(l: Level) => setLevelId(l.id)} />
            <div className="reset-row">
              <button type="button" className="btn small ghost" onClick={() => setShowIntro(true)}>
                ▶ Ertakni qayta ko'rish
              </button>
              {confirmReset ? (
                <>
                  <span>
                    {account
                      ? syncStatus === 'synced'
                        ? 'Natijalaring serverda saqlangan. Chiqamizmi?'
                        : "Natijalar hali yuborilmagan — qayta kirganingda yuboriladi. Chiqamizmi?"
                      : "Hamma natija o'chadi. Rozimisiz?"}
                  </span>
                  <button type="button" className="btn small danger" onClick={reset}>
                    {account ? 'Ha, chiqish' : "Ha, yangi o'yinchi"}
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
