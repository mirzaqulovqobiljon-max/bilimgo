// Faqat sinov uchun: bitta mini-o'yin yoki yakuniy jangni haqiqiy maket ichida ochadi.
// ?game=maze|hidden|horse|chest|battle &tier=kichik|karvon|olim
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import { BoboProvider, useBobo } from '../../src/components/BoboProvider';
import { Bobo } from '../../src/components/Bobo';
import { DevBattle } from '../../src/components/DevBattle';
import { MINI_GAMES } from '../../src/minigames/registry';
import { loadContent } from '../../src/content';
import type { GameType, Tier } from '../../src/content/schema';

const content = loadContent();
const q = new URLSearchParams(location.search);
const game = q.get('game') ?? 'maze';
const tier = (q.get('tier') ?? 'kichik') as Tier;

function Screen() {
  const bobo = useBobo();
  const task = content.tasks.find((t) => t.game === game);
  useEffect(() => bobo.say(task?.bobo ?? 'bobo.gor.obstacle'), []);
  const done = (r: unknown) => ((window as unknown as { __result: unknown }).__result = r);
  const Comp = task ? (MINI_GAMES[task.game as GameType] as React.ComponentType<any>) : null;
  return (
    <div className={`app tier-${tier}`}>
      <main className="level-screen play">
        <header className="level-head">
          <button type="button" className="btn small ghost">← Ortga</button>
          <h1>{task?.title ?? 'Dev bilan jang'}</h1>
          <span className="hints-left">💡 ∞</span>
        </header>
        {Comp ? (
          <Comp content={task!.tiers[tier]} tier={tier} onDone={done} requestHint={() => true} />
        ) : (
          <DevBattle tier={tier} questions={content.levels.find((l) => l.id === 'gor')!.obstacle.battle![tier].questions} onDone={done} finale />
        )}
      </main>
      <Bobo />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <BoboProvider dict={content.bobo} idleReminder={false} initialMuted>
    <Screen />
  </BoboProvider>,
);
