/**
 * Qisqa tovush effektlari — WebAudio'da sintez qilinadi (fayl yo'q: APK/PWA hajmi oshmaydi, internetsiz ishlaydi).
 * Pedagogik qoida: "xato" tovushi yumshoq va past ("hmm"), qo'rqitmaydi va jazolamaydi.
 */
export type SfxName = 'tap' | 'correct' | 'wrong' | 'magic' | 'unlock' | 'water' | 'fanfare' | 'jump';

type Listener = (name: SfxName) => void;

class Sfx {
  private ctx: AudioContext | null = null;
  private muted = false;
  private listeners = new Set<Listener>();

  setMuted(m: boolean) {
    this.muted = m;
  }

  /** Testlar va diagnostika uchun: qaysi tovush chalindi. */
  onPlay(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  play(name: SfxName) {
    if (this.muted) return;
    this.listeners.forEach((fn) => fn(name));
    const ctx = this.context();
    if (!ctx) return;
    try {
      SOUNDS[name](ctx, ctx.currentTime + 0.01);
    } catch {
      // ovoz chiqmasa ham o'yin davom etadi
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    return this.ctx;
  }
}

export const sfx = new Sfx();

// ---------- sintez yordamchilari ----------

function tone(ctx: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, peak: number, endFreq?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(ctx: AudioContext, t: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1 = f0, q = 1) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.15, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SOUNDS: Record<SfxName, (ctx: AudioContext, t: number) => void> = {
  // karta ochildi / bo'lak bosildi
  tap: (c, t) => tone(c, t, 880, 0.05, 'sine', 0.12),
  // to'g'ri: ikki yorqin nota yuqoriga
  correct: (c, t) => {
    tone(c, t, 784, 0.12, 'triangle', 0.22);
    tone(c, t + 0.1, 1175, 0.22, 'triangle', 0.22);
  },
  // noto'g'ri: yumshoq "hmm-mm" pastga, qisqa
  wrong: (c, t) => {
    tone(c, t, 311, 0.14, 'sine', 0.16);
    tone(c, t + 0.13, 247, 0.2, 'sine', 0.14);
  },
  // sehrli ochilish: yuqoriga arpedjio + yaltiroq
  magic: (c, t) => {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(c, t + i * 0.07, f, 0.35, 'sine', 0.11));
    for (let i = 0; i < 8; i++) tone(c, t + 0.3 + i * 0.06, 2400 + ((i * 523) % 1800), 0.18, 'sine', 0.05);
    noise(c, t, 0.9, 0.04, 'highpass', 6000, 9000);
  },
  // kalit: ikki "chiq" + eshik g'ichirlashi
  unlock: (c, t) => {
    noise(c, t, 0.05, 0.3, 'bandpass', 3000, 3000, 6);
    noise(c, t + 0.14, 0.05, 0.3, 'bandpass', 2200, 2200, 6);
    tone(c, t + 0.35, 140, 0.7, 'sawtooth', 0.035, 230);
    noise(c, t + 0.35, 0.7, 0.05, 'bandpass', 500, 900, 3);
  },
  // suv: to'lqin shovqini + tomchilar
  water: (c, t) => {
    noise(c, t, 1.8, 0.09, 'lowpass', 500, 1400, 0.7);
    [0.3, 0.75, 1.2].forEach((d) => tone(c, t + d, 620, 0.12, 'sine', 0.08, 1300));
  },
  // sakrash: tez ko'tariluvchi "vush"
  jump: (c, t) => {
    tone(c, t, 300, 0.22, 'triangle', 0.12, 700);
    noise(c, t, 0.18, 0.05, 'bandpass', 900, 2400, 2);
  },
  // buyum to'liq yig'ildi
  fanfare: (c, t) => {
    [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.11, f, 0.18, 'triangle', 0.2));
    tone(c, t + 0.33, 1047, 0.5, 'triangle', 0.22);
  },
};
