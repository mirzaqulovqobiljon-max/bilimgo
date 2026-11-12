import type { Progress, TaskResult } from './progress';

/**
 * Ikki qurilma (yoki offline va server) progressini birlashtirish.
 * Qoida: yutilgan narsa hech qachon yo'qolmaydi — shuning uchun hamma maydon "faqat o'sadi":
 * yulduz/o'yinlar/tangalar — max, xatolar/vaqt — min (eng yaxshi natija), buyum qismlari va
 * o'tilgan bosqichlar — birlashma. Natija tartibga bog'liq emas va takrorlansa o'zgarmaydi,
 * shuning uchun offline navbatni istalgancha qayta yuborish xavfsiz.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const tasks: Record<string, TaskResult> = { ...a.tasks };
  for (const [id, r] of Object.entries(b.tasks)) {
    const x = tasks[id];
    if (!x) {
      tasks[id] = r;
      continue;
    }
    const best: TaskResult = {
      stars: Math.max(x.stars, r.stars),
      plays: Math.max(x.plays, r.plays),
      bestMistakes: Math.min(x.bestMistakes, r.bestMistakes),
    };
    const times = [x.bestTimeMs, r.bestTimeMs].filter((t): t is number => t !== undefined);
    if (times.length) best.bestTimeMs = Math.min(...times);
    tasks[id] = best;
  }

  const inventory: Record<string, string[]> = {};
  for (const id of new Set([...Object.keys(a.inventory), ...Object.keys(b.inventory)])) {
    inventory[id] = [...new Set([...(a.inventory[id] ?? []), ...(b.inventory[id] ?? [])])].sort();
  }

  const hintsUsed: Record<string, number> = { ...a.hintsUsed };
  for (const [id, n] of Object.entries(b.hintsUsed)) hintsUsed[id] = Math.max(hintsUsed[id] ?? 0, n);

  return {
    version: a.version,
    profile: b.profile ?? a.profile,
    coins: Math.max(a.coins, b.coins),
    inventory,
    completedLevels: [...new Set([...a.completedLevels, ...b.completedLevels])].sort(),
    tasks,
    hintsUsed,
    // moslashuvchan qiyinlik — ko'proq o'ynalgan qurilmaniki dolzarbroq
    adaptive: playsOf(b) >= playsOf(a) ? b.adaptive : a.adaptive,
    introSeen: a.introSeen || b.introSeen,
  };
}

function playsOf(p: Progress): number {
  return Object.values(p.tasks).reduce((s, t) => s + t.plays, 0);
}

/** Taqqoslash uchun barqaror ko'rinish (kalitlar tartibidan qat'i nazar). */
export function progressKey(p: Progress): string {
  const sortObj = (o: unknown): unknown =>
    Array.isArray(o)
      ? o.map(sortObj)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, sortObj(v)]))
        : o;
  return JSON.stringify(sortObj(p));
}
