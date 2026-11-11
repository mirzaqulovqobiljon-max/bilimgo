import { useState } from 'react';
import type { Item } from '../content/schema';
import { isItemComplete, partsCollected, type Progress } from '../engine/progress';
import { Icon } from './Icon';

interface Props {
  items: readonly Item[];
  progress: Progress;
}

/** Sumka (inventar): yuqori o'ng burchakda. To'liq buyumlar va yarim yig'ilganlar (masalan "Kalit 2/3"). */
export function Bag({ items, progress }: Props) {
  const [open, setOpen] = useState(false);
  const started = items.filter((i) => partsCollected(progress, i) > 0);
  const complete = started.filter((i) => isItemComplete(progress, i)).length;

  return (
    <div className="bag">
      <button
        type="button"
        className="bag-button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Sumka: ${complete} ta buyum`}
      >
        <span aria-hidden="true">🎒</span>
        {started.length > 0 && <span className="bag-count">{complete}</span>}
      </button>
      {open && (
        <div className="bag-panel" role="dialog" aria-label="Sumka ichida">
          <h2>Sumka</h2>
          {started.length === 0 && <p className="muted">Hozircha bo'sh. Topshiriqlarni bajar!</p>}
          <ul>
            {started.map((item) => {
              const have = progress.inventory[item.id] ?? [];
              const n = partsCollected(progress, item);
              const done = n === item.parts.length;
              return (
                <li key={item.id} className={done ? 'bag-item done' : 'bag-item'} data-testid={`bag-${item.id}`}>
                  <span className="bag-item-icon"><Icon icon={item.icon} size={40} /></span>
                  <span className="bag-item-name">
                    {item.name} <b>{n}/{item.parts.length}</b>
                  </span>
                  <span className="bag-parts">
                    {item.parts.map((p) => (
                      <span
                        key={p.id}
                        className={have.includes(p.id) ? 'part have' : 'part'}
                        title={p.name}
                        aria-label={`${p.name}: ${have.includes(p.id) ? 'bor' : "yo'q"}`}
                      >
                        {have.includes(p.id) ? <Icon icon={p.icon} size={26} /> : '·'}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>
            Yopish
          </button>
        </div>
      )}
    </div>
  );
}

export function Stars({ value, max = 3, label }: { value: number; max?: number; label?: string }) {
  return (
    <span className="stars" aria-label={label ?? `${value} yulduz`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'star on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
