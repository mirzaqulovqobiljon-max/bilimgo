import { useEffect, useMemo, useRef, useState } from 'react';
import type { Level } from '../content/schema';
import type { Progress } from '../engine/progress';
import { useBobo, useBoboScreen } from '../components/BoboProvider';
import { STATUS_LABEL, buildMapNodes } from '../components/map/mapModel';

interface Props {
  levels: readonly Level[];
  progress: Progress;
  onEnter(level: Level): void;
}

export function MapScreen({ levels, progress, onEnter }: Props) {
  const bobo = useBobo();
  const nodes = useMemo(() => buildMapNodes(levels, progress), [levels, progress]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const firstVisit = progress.completedLevels.length === 0 && Object.keys(progress.tasks).length === 0;
  useBoboScreen(firstVisit ? 'bobo.map.intro' : 'bobo.map.help', 'bobo.map.help');

  const select = (id: string) => {
    const level = levels.find((l) => l.id === id);
    const node = nodes.find((n) => n.id === id);
    if (!level || !node) return;
    if (node.status === 'locked') bobo.say('bobo.locked');
    else if (node.status === 'soon') bobo.say('bobo.soon');
    else onEnter(level);
  };
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    let handle: { destroy(): void } | null = null;
    let cancelled = false;
    // Phaser (~1 MB) faqat xarita kerak bo'lganda yuklanadi.
    import('../components/map/phaserMap')
      .then(({ createMap }) => {
        if (cancelled || !hostRef.current) return;
        handle = createMap(hostRef.current, nodes, (id) => selectRef.current(id));
        setMapState('ready');
      })
      .catch((e: unknown) => {
        console.warn('Xarita yuklanmadi, oddiy ro\'yxat ko\'rsatiladi', e);
        if (!cancelled) setMapState('failed');
      });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [nodes]);

  return (
    <main className="map-screen">
      <div ref={hostRef} className="map-canvas" data-state={mapState} />
      {mapState === 'loading' && <p className="map-loading">Xarita yuklanmoqda…</p>}
      {/* Ekran o'quvchilar, klaviatura va Phaser ishlamagan eski qurilmalar uchun. */}
      {/* Xarita yuklanguncha (sekin internet) yoki yuklanmasa — bola shu ro'yxatdan o'ynayveradi. */}
      <nav
        className={mapState === 'ready' ? 'map-list sr-only' : mapState === 'loading' ? 'map-list map-list-overlay' : 'map-list'}
        aria-label="Bosqichlar"
      >
        <ol>
          {nodes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`map-list-btn status-${n.status}`}
                onClick={() => select(n.id)}
                aria-label={`${n.order}. ${n.title} — ${STATUS_LABEL[n.status]}`}
              >
                <span aria-hidden="true">{n.status === 'locked' ? '🔒' : n.icon}</span> {n.order}. {n.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </main>
  );
}
