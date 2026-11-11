import { Crossword } from './Crossword';
import { HiddenObjects } from './HiddenObjects';
import { HorseRunner } from './HorseRunner';
import { MagicChest } from './MagicChest';
import { Maze } from './Maze';
import { Memory } from './Memory';
import { Puzzle } from './Puzzle';
import { Riddle } from './Riddle';
import { Sorting } from './Sorting';
import type { MiniGameRegistry } from './types';

/** Yangi mini-o'yin = komponent + schema.ts'dagi content sxemasi + shu yerga bitta qator. */
export const MINI_GAMES: MiniGameRegistry = {
  riddle: Riddle,
  puzzle: Puzzle,
  crossword: Crossword,
  memory: Memory,
  sorting: Sorting,
  // 5 ta yangi mini-o'yin (qo'shimcha sarguzasht topshiriqlari; 5-chisi — DevBattle'dagi 3 fazali jang)
  maze: Maze,
  hidden: HiddenObjects,
  horse: HorseRunner,
  chest: MagicChest,
};

export const GAME_LABEL: Record<keyof MiniGameRegistry, { name: string; icon: string }> = {
  riddle: { name: 'Bosh qotirma', icon: '🧠' },
  puzzle: { name: 'Puzzle', icon: '🧩' },
  crossword: { name: 'Krossvord', icon: '✏️' },
  memory: { name: 'Xotira kartalari', icon: '🃏' },
  sorting: { name: 'Tartiblash', icon: '🔢' },
  maze: { name: 'Sirli labirint', icon: '🌿' },
  hidden: { name: 'Yashirin buyumlar', icon: '🔍' },
  horse: { name: "Ot bilan to'siqlar", icon: '🐎' },
  chest: { name: 'Sehrli sandiq', icon: '🧰' },
};
