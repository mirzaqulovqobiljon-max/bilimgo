import index from '../content/audio.uz.json';

/** Kim gapiradi: Hikmat bobo (Amir ovozi) yoki dev (Qora Shoh ovozi). */
export type Voice = 'bobo' | 'dev';

const clips = index as Record<string, string>;

/** Matn uchun yozilgan audio fayl (bo'lmasa undefined). Matn ekrandagidek aniq bo'lishi kerak. */
export function audioFor(text: string, voice: Voice = 'bobo'): string | undefined {
  return clips[`${voice}|${text.trim()}`];
}

/** Ijrochi interfeysi — brauzerda HTMLAudioElement, testlarda soxta ijrochi. */
export interface Clip {
  play(): Promise<void>;
  stop(): void;
  onEnd(fn: () => void): void;
}
export type ClipFactory = (url: string) => Clip;

const htmlClip: ClipFactory = (url) => {
  const a = new Audio(url);
  let ended: () => void = () => {};
  const finish = () => ended();
  a.addEventListener('ended', finish);
  a.addEventListener('error', finish);
  return {
    play: async () => {
      try {
        await a.play();
      } catch {
        // fayl yo'q yoki brauzer avtoijroni blokladi — matn baribir ko'rinadi, navbat to'xtamasin
        finish();
      }
    },
    stop: () => {
      a.pause();
      a.removeEventListener('ended', finish);
      a.removeEventListener('error', finish);
    },
    onEnd: (fn) => {
      ended = fn;
    },
  };
};

/**
 * Bitta ovoz kanali: bir vaqtda faqat bitta gap eshitiladi (bola chalkashmasin).
 * - now(): joriy gapni to'xtatib, darhol gapiradi (bobo javobga munosabati).
 * - queue(): joriy gap tugagach gapiradi (masalan, savolni o'qib berish maqtovdan keyin).
 */
export class VoiceChannel {
  private current: Clip | null = null;
  private pending: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private factory: ClipFactory = htmlClip,
    private base = import.meta.env.BASE_URL ?? './',
    /** Navbatdagi gap ekran o'zgarganda bobo kirish so'zini aytib ulgurishi uchun kutadi. */
    private queueDelayMs = 350,
  ) {}

  get busy(): boolean {
    return this.current !== null;
  }

  now(file: string): void {
    this.current?.stop();
    this.current = null;
    this.start(file);
  }

  queue(file: string): void {
    this.pending.push(file);
    if (this.current || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.current) this.next();
    }, this.queueDelayMs);
  }

  /** Hammasini to'xtatadi (ovoz o'chirildi yoki ekran yopildi). */
  stop(): void {
    this.pending = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current?.stop();
    this.current = null;
  }

  /** Faqat navbatni tozalaydi (masalan, savol o'zgardi — eski savol endi kerak emas). */
  clearQueue(): void {
    this.pending = [];
  }

  private start(file: string) {
    const clip = this.factory(this.base + file);
    this.current = clip;
    clip.onEnd(() => {
      if (this.current !== clip) return;
      this.current = null;
      this.next();
    });
    void clip.play();
  }

  private next() {
    const file = this.pending.shift();
    if (file) this.start(file);
  }
}
