// Faqat sinov uchun: bitta to'siq sahnasini alohida ochadi (?level=daryo). Build'ga kirmaydi.
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import { BoboProvider } from '../../src/components/BoboProvider';
import { ObstacleScene } from '../../src/components/ObstacleScene';
import { loadContent } from '../../src/content';

const content = loadContent();
const id = new URLSearchParams(location.search).get('level') ?? 'ona-qishloq';
const level = content.levels.find((l) => l.id === id)!;
const item = content.items.find((i) => i.id === level.obstacle.requires)!;
createRoot(document.getElementById('root')!).render(
  <BoboProvider dict={content.bobo} idleReminder={false} initialMuted>
    <main className="level-screen">
      <ObstacleScene level={level} item={item} onDone={() => ((window as unknown as { __done: boolean }).__done = true)} />
    </main>
  </BoboProvider>,
);
