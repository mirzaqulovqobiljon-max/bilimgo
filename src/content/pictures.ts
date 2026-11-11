import { img } from '../assets';

/**
 * Puzzle rasmlari: kalit -> public/img/puzzle/<kalit>.webp (kvadrat, 800x800).
 * Yangi rasm qo'shish: faylni public/img/puzzle/ ga qo'ying va kalitni shu ro'yxatga yozing.
 */
export const PICTURE_KEYS = ['qishloq-darvoza', 'ormon', 'daryo', 'chol', 'tog', 'gor', 'kitob'] as const;

export function pictureUrl(key: string): string {
  if (!(PICTURE_KEYS as readonly string[]).includes(key)) throw new Error(`Rasm topilmadi: ${key}`);
  return img.puzzle(key);
}
