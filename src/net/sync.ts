import { mergeProgress, progressKey } from '../engine/merge';
import type { Progress } from '../engine/progress';
import { ApiError, type ApiClient } from './api';
import type { KV } from './kv';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'auth-error';


/**
 * Offline-first sinxronlash.
 *  - Har bir o'zgarish avval IndexedDB'dagi navbatga yoziladi (internet uzilsa ham yo'qolmaydi).
 *  - Keyin serverga yuboriladi; server birlashtirgan natija qaytadi va mahalliy holat bilan birlashtiriladi.
 *  - Tarmoq xatosida: kutish vaqti oshib boradi (2s → 60s), `online` hodisasida darhol qayta urinish.
 * Birlashtirish faqat "o'sadi", shuning uchun bir xil holatni qayta yuborish xavfsiz.
 */
export class SyncEngine {
  status: SyncStatus = 'idle';
  private listeners = new Set<(s: SyncStatus) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 2000;
  private inflight: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private api: ApiClient,
    private kv: KV,
    private onMerged: (p: Progress) => void,
    private opts: { minBackoffMs?: number; maxBackoffMs?: number; key?: string } = {},
  ) {
    this.backoffMs = opts.minBackoffMs ?? 2000;
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  private onOnline = () => void this.flush();
  /** Navbat kaliti har bir o'quvchi uchun alohida: bir qurilmada bir necha bola o'ynasa ham aralashmaydi. */
  private get PENDING() {
    return `pending-progress:${this.opts.key ?? 'default'}`;
  }

  subscribe(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => void this.listeners.delete(fn);
  }

  private set(s: SyncStatus) {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  /** Ilova ochilganda: serverdagi holatni olib, mahalliy (va navbatdagi) bilan birlashtiradi. */
  async pull(local: Progress): Promise<Progress> {
    const pending = await this.kv.get<Progress>(this.PENDING);
    const base = pending ? mergeProgress(local, pending) : local;
    try {
      const server = await this.api.getProgress();
      const merged = mergeProgress(base, server);
      merged.profile = server.profile ?? base.profile;
      if (progressKey(merged) !== progressKey(server)) await this.push(merged);
      else this.set('synced');
      return merged;
    } catch (e) {
      this.handleError(e);
      if (pending) void this.flush();
      return base;
    }
  }

  /** Yangi holatni navbatga qo'yadi va yuborishga urinadi. */
  async push(p: Progress): Promise<void> {
    const pending = await this.kv.get<Progress>(this.PENDING);
    await this.kv.set(this.PENDING, pending ? mergeProgress(pending, p) : p);
    await this.flush();
  }

  flush(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    // bitta yuborish ketayotgan bo'lsa, tugagach yana bir marta (yangi o'zgarishlar uchun)
    if (this.inflight) return this.inflight.then(() => this.flush());
    this.inflight = this.doFlush().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doFlush() {
    const pending = await this.kv.get<Progress>(this.PENDING);
    if (!pending) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.set('syncing');
    try {
      const merged = await this.api.putProgress(pending);
      // yuborish paytida yangi o'zgarish qo'shilmagan bo'lsa — navbatni tozalaymiz
      const now = await this.kv.get<Progress>(this.PENDING);
      if (now && progressKey(now) === progressKey(pending)) await this.kv.del(this.PENDING);
      else if (now) await this.kv.set(this.PENDING, mergeProgress(now, merged));
      this.backoffMs = this.opts.minBackoffMs ?? 2000;
      this.onMerged(merged);
      this.set((await this.kv.get(this.PENDING)) ? 'syncing' : 'synced');
      if (await this.kv.get(this.PENDING)) this.schedule(0);
    } catch (e) {
      this.handleError(e);
    }
  }

  private handleError(e: unknown) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      this.set('auth-error');
      return;
    }
    this.set('offline');
    this.schedule(this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs ?? 60_000);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  async hasPending() {
    return !!(await this.kv.get(this.PENDING));
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
  }
}
