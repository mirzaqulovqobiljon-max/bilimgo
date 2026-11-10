import { Puzzle } from './Puzzle';
import { Riddle } from './Riddle';
import type { MiniGameRegistry } from './types';

/** Yangi mini-o'yin = komponent + schema.ts'dagi content sxemasi + shu yerga bitta qator. */
export const MINI_GAMES: MiniGameRegistry = {
  riddle: Riddle,
  puzzle: Puzzle,
};

export const GAME_LABEL: Record<keyof MiniGameRegistry, { name: string; icon: string }> = {
  riddle: { name: 'Bosh qotirma', icon: '🧠' },
  puzzle: { name: 'Puzzle', icon: '🧩' },
};
