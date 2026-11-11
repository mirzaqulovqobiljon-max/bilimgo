/**
 * O'yin rasmlari (public/img). Yo'llar nisbiy — sayt istalgan papkada ishlaydi.
 * Asl rasmlarni tayyorlash: tools/rasmlar.py
 */
export const BOBO_MOODS = ['gapiradi', 'korsatadi', 'maqtaydi', 'oylaydi'] as const;
export type BoboMood = (typeof BOBO_MOODS)[number];

export const img = {
  bobo: (m: BoboMood) => `img/bobo/${m}.webp`,
  dev: (s: 'oddiy' | 'zarba' | 'kechirim' | 'tutun') => `img/dev/${s}.webp`,
  map: 'img/xarita.webp',
  caravan: 'img/karvon-belgi.webp',
  cardBack: 'img/karta-orqasi.webp',
  certificate: 'img/sertifikat-ramka.webp',
  puzzle: (key: string) => `img/puzzle/${key}.webp`,
  obstacle: (scene: string, open: boolean) => `img/tosiq/${scene}-${open ? 'keyin' : 'oldin'}.webp`,
};

/** To'siq turi -> sahna rasmi. */
export const OBSTACLE_SCENE: Record<string, string> = {
  gate: 'darvoza',
  dark: 'ormon',
  river: 'daryo',
  desert: 'chol',
  cliff: 'jarlik',
  castle: 'qala',
};
