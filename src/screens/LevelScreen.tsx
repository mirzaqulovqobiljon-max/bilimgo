import { useCallback, useEffect, useMemo, useState } from 'react';
import { sfx } from '../audio/sfx';
import type { ContentBundle } from '../content/validate';
import { tasksForTier } from '../content/validate';
import { partsOf, type GameContent, type GameType, type Level, type Task, type Tier } from '../content/schema';
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
import { DevBattle } from '../components/DevBattle';
import { Certificate } from '../components/Certificate';
import { Stars } from '../components/Bag';
import { Icon } from '../components/Icon';
import { GAME_LABEL, MINI_GAMES } from '../minigames/registry';
import type { MiniGameProps, MiniGameResult } from '../minigames/types';

type Phase =
  | { kind: 'hub' }
  | { kind: 'play'; task: Task; round: number; contentTier: Tier; startedAt: number }
  | { kind: 'result'; task: Task; stars: 1 | 2 | 3; newParts: string[]; coins: number; itemDone: boolean }
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

export function maxStarsFor(content: ContentBundle, tier: Tier): number {
  return content.levels.reduce((sum, l) => sum + tasksForTier(l, content.tasks, tier).length * 3, 0);
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
  const levelDone = progress.completedLevels.includes(level.id);
  const isFinal = level.order === Math.max(...content.levels.map((l) => l.order));
  const suggested = nextTask(progress, level, content.tasks, tier);
  const wonKey = (id: string) => (`bobo.${id}.won` in content.bobo ? `bobo.${id}.won` : 'bobo.part.won');

  // Bosqich kirishida bobo hikoya va to'siqni aytadi; keyingi qaytishlarda faqat "Bobo" tugmasida.
  const [introSeen, setIntroSeen] = useState(false);
  const hubKey = ready && !levelDone ? wonKey(required.id) : level.intro;
  let introKey: string | null = null;
  let helpKey: string | undefined;
  if (phase.kind === 'hub') {
    introKey = introSeen ? null : hubKey;
    helpKey = hubKey;
  } else if (phase.kind === 'play') introKey = helpKey = phase.task.bobo;
  else if (phase.kind === 'obstacle') introKey = helpKey = `bobo.${level.id}.obstacle`;
  else if (phase.kind === 'done') introKey = level.outro ?? 'bobo.praise';
  useBoboScreen(introKey, helpKey);
  useEffect(() => {
    if (phase.kind === 'hub') setIntroSeen(true);
  }, [phase.kind]);

  const play = (task: Task) =>
    setPhase({
      kind: 'play',
      task,
      round: Date.now(),
      contentTier: effectiveTier(task, tier, progress.adaptive.shift),
      startedAt: Date.now(),
    });

  const finishTask = (task: Task, startedAt: number, r: MiniGameResult) => {
    const stars = starsFor(r.mistakes, r.allowance);
    let outcome: ReturnType<typeof recordTask> | null = null;
    update((p) => {
      outcome = recordTask(p, task, level, stars, r.mistakes, Date.now() - startedAt);
      return outcome.progress;
    });
    const o = outcome as ReturnType<typeof recordTask> | null;
    if (!o) return;
    const itemDone = o.newParts.length > 0 && isItemComplete(o.progress, item);
    if (itemDone) sfx.play('fanfare');
    if (itemDone) bobo.say(wonKey(item.id));
    else if (o.newParts.length) bobo.say('bobo.part.won');
    else if (partsOf(task).length === 0 && o.firstTime) bobo.say('bobo.bonus.won');
    else if (stars < 3) bobo.say('bobo.retry');
    else bobo.say('bobo.praise');
    setPhase({ kind: 'result', task, stars, newParts: o.newParts, coins: o.coinsEarned, itemDone });
  };

  const requestHint = useCallback(() => {
    let ok = false;
    update((p) => {
      const next = spendHint(p, level.id, tier);
      ok = next !== null;
      return next ?? p;
    });
    return ok;
  }, [update, level.id, tier]);

  const finishLevel = () => {
    update((p) => completeLevel(p, level, content.items));
    setPhase({ kind: 'done' });
  };

  if (phase.kind === 'play') {
    const gameContent = phase.task.tiers[phase.contentTier] as GameContent<typeof phase.task.game>;
    const { task, startedAt } = phase;
    return (
      <main className="level-screen play">
        <header className="level-head">
          <button type="button" className="btn small ghost" onClick={() => setPhase({ kind: 'hub' })}>
            ← Ortga
          </button>
          <h1>{task.title}</h1>
          <span className="hints-left" aria-label="Qolgan maslahatlar">
            💡 {tier === 'kichik' ? '∞' : hintsLeft(progress, level.id, tier)}
          </span>
        </header>
        <GameHost
          key={`${task.id}-${phase.round}`}
          game={task.game}
          content={gameContent}
          tier={phase.contentTier}
          onDone={(r) => finishTask(task, startedAt, r)}
          requestHint={requestHint}
          rng={rng}
          delayMs={delayMs}
        />
      </main>
    );
  }

  if (phase.kind === 'result') {
    const parts = item.parts.filter((p) => phase.newParts.includes(p.id));
    return (
      <main className="level-screen result" aria-label="Natija">
        <div className="result-card">
          <Stars value={phase.stars} label={`${phase.stars} yulduz`} />
          {parts.length > 0 && (
            <p className="result-part">
              <span className="part-fly">
                {parts.map((p) => (
                  <Icon key={p.id} icon={p.icon} size={56} />
                ))}
              </span>{' '}
              {parts.map((p) => p.name).join(' va ')} sumkaga tushdi!
            </p>
          )}
          {phase.itemDone && (
            <p className="result-item">
              <Icon icon={item.icon} size={64} /> {item.name} to'liq yig'ildi!
            </p>
          )}
          {phase.coins > 0 && <p className="result-coins">+{phase.coins} 🪙</p>}
          <div className="result-actions">
            <button
              type="button"
              className="btn primary big"
              onClick={() => setPhase(phase.itemDone ? { kind: 'obstacle' } : { kind: 'hub' })}
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
    const battle = level.obstacle.battle;
    return (
      <main className="level-screen">
        {battle ? (
          <DevBattle tier={tier} questions={battle[tier].questions} onDone={finishLevel} delayMs={delayMs} />
        ) : (
          <ObstacleScene
            level={level}
            item={required}
            animationMs={delayMs === undefined ? undefined : delayMs * 2}
            onDone={finishLevel}
          />
        )}
      </main>
    );
  }

  if (phase.kind === 'done') {
    return (
      <main className="level-screen done">
        <div className="result-card">
          <p className="done-emoji" aria-hidden="true">{isFinal ? '📖' : '🎉'}</p>
          <h1>{isFinal ? 'Bilim kitobi qaytarildi!' : `${level.title} — o'tildi!`}</h1>
          <p>
            {level.obstacle.title} yengildi. Sumkangda: <Icon icon={required.icon} size={28} /> {required.name}
          </p>
          {isFinal && <Certificate progress={progress} maxStars={maxStarsFor(content, tier)} />}
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
        <span className="item-big"><Icon icon={item.icon} size={60} /></span>
        <ol style={{ gridTemplateColumns: `repeat(${Math.min(item.parts.length, 3)}, 1fr)` }}>
          {item.parts.map((p) => (
            <li key={p.id} className={have.includes(p.id) ? 'slot have' : 'slot'}>
              {have.includes(p.id) ? <Icon icon={p.icon} size={34} /> : <span aria-hidden="true">?</span>}
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
          const parts = item.parts.filter((p) => partsOf(t).includes(p.id));
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
                    {g.name} ·{' '}
                    {parts.length ? `mukofot: ${parts.map((p) => p.name.toLowerCase()).join(', ')}` : "qo'shimcha sinov"}
                  </small>
                </span>
                {r ? <Stars value={r.stars} /> : <span className="task-go" aria-hidden="true">▶</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {ready && !levelDone && (
        <button type="button" className="btn primary big pulse" onClick={() => setPhase({ kind: 'obstacle' })}>
          <Icon icon={required.icon} size={30} /> {level.obstacle.battle ? 'Dev bilan jangga!' : "To'siqni yengamiz!"}
        </button>
      )}
    </main>
  );
}
