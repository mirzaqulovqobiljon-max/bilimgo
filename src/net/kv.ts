/**
 * Kichik IndexedDB kalit-qiymat ombori (offline navbat uchun).
 * IndexedDB yo'q yoki bloklangan bo'lsa (eski brauzer, maxfiy rejim) — xotiradagi zaxira.
 */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
  };
}

export function indexedKV(dbName = 'ipak-yoli', store = 'kv', idb: IDBFactory | undefined = globalThis.indexedDB): KV {
  if (!idb) return memoryKV();
  let opening: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = idb.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(store);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  const fallback = memoryKV();
  let broken = false;
  const guard = async <T,>(f: () => Promise<T>, alt: () => Promise<T>) => {
    if (broken) return alt();
    try {
      return await f();
    } catch {
      broken = true;
      return alt();
    }
  };
  return {
    get: <T,>(k: string) => guard(() => run<T | undefined>('readonly', (s) => s.get(k)), () => fallback.get<T>(k)),
    set: (k, v) => guard(() => run<void>('readwrite', (s) => s.put(v, k)).then(() => undefined), () => fallback.set(k, v)),
    del: (k) => guard(() => run<void>('readwrite', (s) => s.delete(k)).then(() => undefined), () => fallback.del(k)),
  };
}
