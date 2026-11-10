export type Rng = () => number;

/** Deterministik RNG (mulberry32) — testlarda va qayta takrorlanadigan aralashtirishda. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Puzzle uchun aralash tartib: `order[cell] = piece`.
 * Kafolat: yechilgan holatda emas va kamida yarmi o'z joyida emas (bola uchun mazmunli).
 */
export function scramble(n: number, rng: Rng): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return identity;
  for (let attempt = 0; attempt < 50; attempt++) {
    const order = shuffle(identity, rng);
    const inPlace = order.filter((p, i) => p === i).length;
    if (inPlace <= Math.floor(n / 2) && inPlace < n) return order;
  }
  // Fallback: rotate by one — hech bir bo'lak o'z joyida emas.
  return identity.map((_, i) => (i + 1) % n);
}

/** Pool'dan tasodifiy element, oxirgisini takrorlamasdan. */
export function pickIndex(length: number, rng: Rng, avoid?: number): number {
  if (length <= 1) return 0;
  let i = Math.floor(rng() * length);
  if (i === avoid) i = (i + 1) % length;
  return i;
}
