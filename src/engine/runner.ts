/**
 * Ot bilan to'siqlar: sof simulyatsiya (UI'siz sinaladi, kadr tezligidan mustaqil).
 * Birliklar: metr va soniya. Ot x = HORSE_X da turadi, dunyo chapga siljiydi.
 *
 * Sakrash: v0 = 11 m/s, g = 30 m/s² -> havoda 0.73 s, eng baland nuqta 2 m.
 * "Sakrash oynasi" (qancha erta/kech bosish mumkin) darajaga qarab urilish chegaralari bilan kengaytiriladi.
 */
export type RunnerTier = 'kichik' | 'karvon' | 'olim';
export type ObstacleKind = 'past' | 'baland' | 'ikki';

export const JUMP_V = 11;
export const GRAVITY = 30;
export const HORSE_X = 2;

export interface TierTuning {
  speed: number;
  gap: number;
  /** Urilish chegarasi (otning "qattiq" tanasi) yarim eni. */
  horseHalf: number;
  obstacleHalf: number;
}
export const TUNING: Record<RunnerTier, TierTuning> = {
  kichik: { speed: 4, gap: 10, horseHalf: 0.22, obstacleHalf: 0.2 },
  karvon: { speed: 5.5, gap: 9, horseHalf: 0.4, obstacleHalf: 0.35 },
  olim: { speed: 7, gap: 8.5, horseHalf: 0.4, obstacleHalf: 0.35 },
};
export const HEIGHT: Record<'past' | 'baland', number> = { past: 0.6, baland: 1.0 };

export interface Obstacle {
  id: number;
  x: number;
  h: number;
  kind: 'past' | 'baland';
  passed: boolean;
  /** Ustida bezak yulduz bormi (yig'ilsa — faqat porlaydi, tanga bermaydi). */
  star: boolean;
}

export interface RunnerState {
  t: number;
  y: number;
  vy: number;
  obstacles: Obstacle[];
  finishX: number;
  /** Bosib o'tilgan masofa (marra chizig'i uchun). */
  dist: number;
  total: number;
  mistakes: number;
  stars: number;
  /** Urilgandan keyin qisqa to'xtash va himoya. */
  stunUntil: number;
  invulnUntil: number;
  /** Erta bosilgan sakrash (yerga tushishi bilan bajariladi). */
  bufferedUntil: number;
  /** Mashq: birinchi to'siq oldida to'xtab "sakra" deb kutadi. */
  practiceWaiting: boolean;
  practiceDone: boolean;
  done: boolean;
}

export type RunnerEvent = 'jump' | 'hit' | 'pass' | 'star' | 'practice' | 'finish';

/** Trek: har bir belgi bitta to'siq; "ikki" — past + baland qisqa oraliqda (ketma-ket ikki sakrash). */
export function buildTrack(track: readonly ObstacleKind[], tier: RunnerTier): { obstacles: Obstacle[]; finishX: number } {
  const { gap } = TUNING[tier];
  const obstacles: Obstacle[] = [];
  let x = HORSE_X + 9;
  let id = 0;
  track.forEach((kind, i) => {
    const star = i % 2 === 1;
    if (kind === 'ikki') {
      obstacles.push({ id: id++, x, h: HEIGHT.past, kind: 'past', passed: false, star: false });
      x += 6.5;
      obstacles.push({ id: id++, x, h: HEIGHT.baland, kind: 'baland', passed: false, star });
    } else obstacles.push({ id: id++, x, h: HEIGHT[kind], kind, passed: false, star });
    x += gap;
  });
  return { obstacles, finishX: x - gap + 8 };
}

export function initialRunner(track: readonly ObstacleKind[], tier: RunnerTier, practice: boolean): RunnerState {
  const { obstacles, finishX } = buildTrack(track, tier);
  return {
    t: 0,
    y: 0,
    vy: 0,
    obstacles,
    finishX,
    dist: 0,
    total: finishX - HORSE_X,
    mistakes: 0,
    stars: 0,
    stunUntil: 0,
    invulnUntil: 0,
    bufferedUntil: -1,
    practiceWaiting: false,
    practiceDone: !practice,
    done: false,
  };
}

/** Eng yaxshi sakrash nuqtasi: to'siq markazi ot oldida shuncha masofada bo'lganda sakrash kerak. */
export const idealLead = (tier: RunnerTier) => (TUNING[tier].speed * JUMP_V) / GRAVITY;

export function nextObstacle(s: RunnerState): Obstacle | undefined {
  return s.obstacles.find((o) => !o.passed);
}

export function jump(s: RunnerState): { state: RunnerState; event?: RunnerEvent } {
  if (s.done || s.t < s.stunUntil) return { state: s };
  if (s.y > 0.001) return { state: { ...s, bufferedUntil: s.t + 0.15 } };
  return { state: { ...s, vy: JUMP_V, practiceWaiting: false, practiceDone: s.practiceDone || s.practiceWaiting }, event: 'jump' };
}

export function stepRunner(s0: RunnerState, dt: number, tier: RunnerTier): { state: RunnerState; events: RunnerEvent[] } {
  if (s0.done || s0.practiceWaiting) return { state: s0, events: [] };
  const { speed, horseHalf, obstacleHalf } = TUNING[tier];
  const events: RunnerEvent[] = [];
  let s: RunnerState = { ...s0, t: s0.t + dt };
  if (s.t < s.stunUntil) return { state: s, events };

  // vertikal harakat
  let vy = s.vy;
  let y = s.y;
  if (y > 0 || vy > 0) {
    vy -= GRAVITY * dt;
    y = Math.max(0, y + vy * dt);
    if (y === 0) vy = 0;
  }
  s = { ...s, y, vy };
  if (y === 0 && s.bufferedUntil >= s.t) {
    s = { ...s, vy: JUMP_V, bufferedUntil: -1 };
    events.push('jump');
  }

  // dunyo siljiydi
  const dx = speed * dt;
  let obstacles = s.obstacles.map((o) => ({ ...o, x: o.x - dx }));
  const finishX = s.finishX - dx;
  s = { ...s, obstacles, finishX, dist: Math.min(s.total, s.dist + dx) };

  // mashq: birinchi to'siq ideal nuqtaga kelganda to'xtab kutadi
  const first = nextObstacle(s);
  if (!s.practiceDone && first && first.x - HORSE_X <= idealLead(tier) && s.y === 0) {
    events.push('practice');
    return { state: { ...s, practiceWaiting: true }, events };
  }

  // urilish va o'tish
  for (const o of obstacles) {
    if (o.passed) continue;
    const overlap = Math.abs(o.x - HORSE_X) < horseHalf + obstacleHalf;
    if (overlap && s.y < o.h && s.t >= s.invulnUntil) {
      // chekpoint: shu to'siq yana oldinda paydo bo'ladi, ot yerda
      const shift = HORSE_X + 7 - o.x;
      obstacles = obstacles.map((q) => (q.passed ? q : { ...q, x: q.x + shift }));
      s = {
        ...s,
        obstacles,
        finishX: s.finishX + shift,
        dist: Math.max(0, s.dist - shift),
        y: 0,
        vy: 0,
        bufferedUntil: -1,
        mistakes: s.mistakes + 1,
        stunUntil: s.t + 0.6,
        invulnUntil: s.t + 1.2,
      };
      events.push('hit');
      return { state: s, events };
    }
    if (o.x + obstacleHalf < HORSE_X - horseHalf) {
      o.passed = true;
      events.push('pass');
      if (o.star && s.y > 0.8) {
        s = { ...s, stars: s.stars + 1 };
        events.push('star');
      }
    }
  }
  s = { ...s, obstacles };
  if (s.finishX <= HORSE_X && obstacles.every((o) => o.passed)) {
    s = { ...s, done: true, dist: s.total };
    events.push('finish');
  }
  return { state: s, events };
}
