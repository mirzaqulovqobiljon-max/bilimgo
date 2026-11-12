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

export const defaultClipFactory: ClipFactory = (url) => {
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

type Pending = { file: string; kind: 'say' | 'queue'; protect: boolean };

export interface SayOptions {
  /** Himoyalangan gap (maqtov, natija) oxirigacha aytiladi — keyingi bobo gapi uni bo'lmaydi. */
  protect?: boolean;
  /** Faqat kanal bo'sh bo'lsa gapiradi (tez-tez bo'ladigan reaksiyalar to'planib qolmasin). */
  ifIdle?: boolean;
}

/**
 * Bitta ovoz kanali: bir vaqtda faqat bitta gap eshitiladi (bola chalkashmasin).
 * - say(): bobo reaksiyasi. Joriy gap himoyalangan bo'lsa — kutadi (navbatda faqat eng oxirgisi qoladi),
 *   aks holda (kirish so'zi, savol) uni bo'lib darhol gapiradi.
 * - now(): bola o'zi bosgan 🔊 — har doim darhol.
 * - queue(): joriy gaplar tugagach (masalan, savolni o'qib berish).
 */
export class VoiceChannel {
  private current: Clip | null = null;
  private currentProtected = false;
  private pending: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private factory: ClipFactory = defaultClipFactory,
    private base = import.meta.env.BASE_URL ?? './',
    /** Navbatdagi gap ekran o'zgarganda bobo kirish so'zini aytib ulgurishi uchun kutadi. */
    private queueDelayMs = 350,
  ) {}

  get busy(): boolean {
    return this.current !== null;
  }

  say(file: string, opts: SayOptions = {}): void {
    const protect = opts.protect ?? false;
    if (opts.ifIdle && (this.current || this.pending.some((p) => p.kind === 'say'))) return;
    if (!this.current) return this.start(file, protect);
    if (!this.currentProtected) {
      this.current.stop();
      this.current = null;
      return this.start(file, protect);
    }
    // Joriy gap himoyalangan: eskirgan kutayotgan gaplarni tashlab, shu gapni savollardan oldinga qo'yamiz.
    // Himoyalangan yangi gap boshqa kutayotgan reaksiyalarni almashtiradi (oxirgisi yutadi);
    // oddiy yangi gap esa kutayotgan himoyalangan gapdan keyin turadi.
    this.pending = this.pending.filter((p) => p.kind !== 'say' || (p.protect && !protect));
    const at = this.pending.findIndex((p) => p.kind === 'queue');
    this.pending.splice(at < 0 ? this.pending.length : at, 0, { file, kind: 'say', protect });
  }

  now(file: string): void {
    this.current?.stop();
    this.current = null;
    this.start(file, false);
  }

  queue(file: string): void {
    this.pending.push({ file, kind: 'queue', protect: false });
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

  /** Faqat navbatdagi o'qishlarni tozalaydi (savol o'zgardi — eski savol endi kerak emas). */
  clearQueue(): void {
    this.pending = this.pending.filter((p) => p.kind !== 'queue');
  }

  private start(file: string, protect: boolean) {
    const clip = this.factory(this.base + file);
    this.current = clip;
    this.currentProtected = protect;
    clip.onEnd(() => {
      if (this.current !== clip) return;
      this.current = null;
      this.next();
    });
    void clip.play();
  }

  private next() {
    const p = this.pending.shift();
    if (p) this.start(p.file, p.protect);
  }
}
