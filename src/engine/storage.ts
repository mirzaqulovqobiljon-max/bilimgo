import { ProgressSchema, initialProgress, type Progress } from './progress';

export const STORAGE_KEY = 'ipak-yoli:progress';

/**
 * Prototipda localStorage. Interfeys ataylab kichik: 4-bosqichda shu interfeysni
 * IndexedDB + server sinxronlash bilan almashtiramiz, o'yin kodi o'zgarmaydi.
 */
export interface ProgressStore {
  load(): Progress;
  save(p: Progress): void;
  reset(): void;
}

export function createLocalStore(storage: Storage = window.localStorage): ProgressStore {
  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return initialProgress(); // storage blocked (private mode, eski brauzer)
      }
      if (!raw) return initialProgress();
      try {
        const parsed = ProgressSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        /* fallthrough */
      }
      // Buzilgan ma'lumotni o'chirib yubormaymiz — keyin tiklash uchun zaxiraga olamiz.
      try {
        storage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw);
      } catch {
        /* ignore */
      }
      return initialProgress();
    },
    save(p) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(ProgressSchema.parse(p)));
      } catch (e) {
        // Quota yoki bloklangan storage: o'yin davom etadi, faqat saqlanmaydi.
        console.warn('Progress saqlanmadi', e);
      }
    },
    reset() {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
