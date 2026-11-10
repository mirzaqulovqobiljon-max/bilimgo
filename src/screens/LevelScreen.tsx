import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContentBundle } from '../content/validate';
import { tasksForTier } from '../content/validate';
import type { GameContent, GameType, Level, Task, Tier } from '../content/schema';
import {
  completeLevel,
  effectiveTier,
  hintsLeft,
  isItemComplete,
  nextTask,
  recordTask,
  spendHint,
  type Progress,
} from '../engine/progress';
import { starsFor } from '../engine/rules';
import type { Rng } from '../engine/random';
import { useBobo, useBoboScreen } from '../components/BoboProvider';
import { ObstacleScene } from '../components/ObstacleScene';
import { Stars } from '../components/Bag';
import { GAME_LABEL, MINI_GAMES } from '../minigames/registry';
import type { MiniGameProps, MiniGameResult } from '../minigames/types';

type Phase =
  | { kind: 'hub' }
  | { kind: 'play'; task: Task; round: number; contentTier: Tier; startedAt: number }
  | { kind: 'result'; task: Task; stars: 1 | 2 | 3; newPart: string | null; coins: number; itemDone: boolean }
  | { kind: 'obstacle' }
  | { kind: 'done' };

interface Props {
  level: Level;
  content: ContentBundle;
  progress: Progress;
  tier: Tier;
  update(fn: (p: Progress) => Progress): void;
  onExit(): void;
  rng?: Rng;
  /** Animatsiya pauzalari (testlarda 0). */
  delayMs?: number;
}

function GameHost<G extends GameType>(props: { game: G } & MiniGameProps<G>) {
  const { game, ...rest } = props;
  const Comp = MINI_GAMES[game] as unknown as React.ComponentType<MiniGameProps<G>>;
  return <Comp {...(rest as MiniGameProps<G>)} />;
}

export function LevelScreen({ level, content, progress, tier, update, onExit, rng, delayMs }: Props) {
  const bobo = useBobo();
  const [phase, setPhase] = useState<Phase>(() =>
    progress.completedLevels.includes(level.id) ? { kind: 'done' } : { kind: 'hub' },
  );
  const item = content.items.find((i) => i.id === level.reward)!;
  const required = content.items.find((i) => i.id === level.obstacle.requires)!;
  const tasks = useMemo(() => tasksForTier(level, content.tasks, tier), [level, content.tasks, tier]);
  const have = progress.inventory[item.id] ?? [];
  const ready = isItemComplete(progress, required);
  const suggested = nextTask(progress, level, content.tasks, tier);

  // Bosqich kirishida bobo hikoya va to'siqni aytadi; keyingi qaytishlarda faqat "Bobo" tugmasida.
  const [introSeen, setIntroSeen] = useState(false);
  const readyKey = `bobo.${required.id}.won` in content.bobo ? `bobo.${required.id}.won` : 'bobo.part.won';
  const hubKey = ready && !progress.completedLevels.includes(level.id) ? readyKey : level.intro;
  let introKey: string | null = null;
  let helpKey: string | undefined;
  if (phase.kind === 'hub') {
    introKey = introSeen ? null : hubKey;
    helpKey = hubKey;
  } else if (phase.kind === 'play') introKey = helpKey = phase.task.bobo;
  else if (phase.kind === 'obstacle') introKey = `bobo.${level.id}.gate`;
  else if (phase.kind === 'done') introKey = level.outro ?? 'bobo.praise';
  useBoboScreen(introKey, helpKey);
  useEffect(() => {
    if (phase.kind === 'hub') setIntroSeen(true);
  }, [phase.kind]);

  const startedAtRef = { current: phase.kind === 'play' ? phase.startedAt : 0 };
  const play = (task: Task) =>
    setPhase({ kind: 'play', task, round: Date.now(), contentTier: effectiveTier(task, tier, progress.adaptive.shift), startedAt: Date.now() });

  const finishTask = useCallback(
    (task: Task, r: MiniGameResult) => {
      const stars = starsFor(r.mistakes, r.allowance);
      let outcome: ReturnType<typeof recordTask> | null = null;
      update((p) => {
        outcome = recordTask(p, task, level, stars, r.mistakes, startedAtRef.current ? Date.now() - startedAtRef.current : undefined);
        return outcome.progress;
      });
      const o = outcome as ReturnType<typeof recordTask> | null;
      const itemDone = !!o && isItemComplete(o.progress, item);
      if (o?.newPart) bobo.say(itemDone && `bobo.${item.id}.won` in content.bobo ? `bobo.${item.id}.won` : 'bobo.part.won');
      else if (!task.rewardPart && o?.firstTime) bobo.say('bobo.bonus.won');
      else if (stars < 3) bobo.say('bobo.retry');
      else bobo.say('bobo.praise');
      setPhase({ kind: 'result', task, stars, newPart: o?.newPart ?? null, coins: o?.coinsEarned ?? 0, itemDone: !!o?.newPart && itemDone });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update, level, item, bobo, content.bobo, phase],
  );

  const requestHint = useCallback(() => {
    let ok = false;
    update((p) => {
      const next = spendHint(p, level.id, tier);
      ok = next !== null;
      return next ?? p;
    });
    return ok;
  }, [update, level.id, tier]);

  const openObstacle = () => setPhase({ kind: 'obstacle' });

  if (phase.kind === 'play') {
    const content_ = phase.task.tiers[phase.contentTier] as GameContent<typeof phase.task.game>;
    return (
      <main className="level-screen play">
        <header className="level-head">
          <button type="button" className="btn small ghost" onClick={() => setPhase({ kind: 'hub' })}>
            ← Ortga
          </button>
          <h1>{phase.task.title}</h1>
          <span className="hints-left" aria-label="Qolgan maslahatlar">
            💡 {tier === 'kichik' ? '∞' : hintsLeft(progress, level.id, tier)}
          </span>
        </header>
        <GameHost
          key={`${phase.task.id}-${phase.round}`}
          game={phase.task.game}
          content={content_}
          tier={phase.contentTier}
          onDone={(r) => finishTask(phase.task, r)}
          requestHint={requestHint}
          rng={rng}
          delayMs={delayMs}
        />
      </main>
    );
  }

  if (phase.kind === 'result') {
    const part = phase.newPart ? item.parts.find((p) => p.id === phase.newPart) : null;
    return (
      <main className="level-screen result" aria-label="Natija">
        <div className="result-card">
          <Stars value={phase.stars} label={`${phase.stars} yulduz`} />
          {part && (
            <p className="result-part">
              <span className="part-fly" aria-hidden="true">{part.icon}</span> {part.name} sumkaga tushdi!
            </p>
          )}
          {phase.itemDone && (
            <p className="result-item">
              <span aria-hidden="true">{item.icon}</span> {item.name} to'liq yig'ildi!
            </p>
          )}
          {phase.coins > 0 && <p className="result-coins">+{phase.coins} 🪙</p>}
          <div className="result-actions">
            <button
              type="button"
              className="btn primary big"
              onClick={() => (phase.itemDone ? openObstacle() : setPhase({ kind: 'hub' }))}
            >
              {phase.itemDone ? "To'siqni yengamiz!" : 'Davom etamiz'}
            </button>
            {phase.stars < 3 && (
              <button type="button" className="btn ghost" onClick={() => play(phase.task)}>
                Yana o'ynash (3 yulduz uchun)
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (phase.kind === 'obstacle') {
    return (
      <main className="level-screen">
        <ObstacleScene
          level={level}
          item={required}
          animationMs={delayMs === undefined ? undefined : delayMs * 2}
          onDone={() => {
            update((p) => completeLevel(p, level, content.items));
            setPhase({ kind: 'done' });
          }}
        />
      </main>
    );
  }

  if (phase.kind === 'done') {
    return (
      <main className="level-screen done">
        <div className="result-card">
          <p className="done-emoji" aria-hidden="true">🎉</p>
          <h1>{level.title} — o'tildi!</h1>
          <p>{level.obstacle.title} yengildi. Sumkangda: {required.icon} {required.name}</p>
          <div className="result-actions">
            <button type="button" className="btn primary big" onClick={onExit}>
              Xaritaga qaytish
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase({ kind: 'hub' })}>
              Topshiriqlarni qayta o'ynash
            </button>
          </div>
        </div>
      </main>
    );
  }

  // hub
  const levelDone = progress.completedLevels.includes(level.id);
  return (
    <main className="level-screen hub">
      <header className="level-head">
        <button type="button" className="btn small ghost" onClick={onExit}>
          ← Xarita
        </button>
        <h1>
          {level.order}. {level.title}
        </h1>
        <span className="subject">{level.subject}</span>
      </header>

      <section className="item-slots" aria-label={`${item.name} qismlari`}>
        <span className="item-big" aria-hidden="true">{item.icon}</span>
        <ol>
          {item.parts.map((p) => (
            <li key={p.id} className={have.includes(p.id) ? 'slot have' : 'slot'}>
              <span aria-hidden="true">{have.includes(p.id) ? p.icon : '?'}</span>
              <small>{p.name}</small>
            </li>
          ))}
        </ol>
        <p className="item-count">
          {item.name}: {item.parts.filter((p) => have.includes(p.id)).length}/{item.parts.length}
        </p>
      </section>

      <ul className="task-list">
        {tasks.map((t) => {
          const r = progress.tasks[t.id];
          const part = t.rewardPart ? item.parts.find((p) => p.id === t.rewardPart) : null;
          const g = GAME_LABEL[t.game];
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`task-card${suggested?.id === t.id ? ' next' : ''}${r ? ' done' : ''}`}
                onClick={() => play(t)}
              >
                <span className="task-icon" aria-hidden="true">{g.icon}</span>
                <span className="task-text">
                  <b>{t.title}</b>
                  <small>
                    {g.name} · {part ? `mukofot: ${part.name.toLowerCase()}` : "qo'shimcha sinov"}
                  </small>
                </span>
                {r ? <Stars value={r.stars} /> : <span className="task-go" aria-hidden="true">▶</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {ready && !levelDone && (
        <button type="button" className="btn primary big pulse" onClick={openObstacle}>
          {required.icon} {level.obstacle.title}ni ochish
        </button>
      )}
    </main>
  );
}
