import type { ComponentType } from 'react';
import type { GameContent, GameType, Tier } from '../content/schema';
import type { Rng } from '../engine/random';

export interface MiniGameResult {
  mistakes: number;
  /** Yulduz hisoblashda "kechiriladigan" xatolar soni. */
  allowance: number;
}

/**
 * Har bir mini-o'yin shu shartnomani bajaradi: mazmun JSON'dan keladi,
 * natija tashqariga qaytadi. O'yin progress/sumka haqida hech narsa bilmaydi.
 */
export interface MiniGameProps<G extends GameType> {
  content: GameContent<G>;
  tier: Tier;
  onDone(result: MiniGameResult): void;
  /** Maslahat so'rash: byudjet bo'lsa true (bobo maslahatni aytadi). */
  requestHint(): boolean;
  rng?: Rng;
  /** Animatsiya pauzalari (testlarda 0). */
  delayMs?: number;
}

export type MiniGameRegistry = { [G in GameType]: ComponentType<MiniGameProps<G>> };
