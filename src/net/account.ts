import { z } from 'zod';

/** Qurilmada saqlanadigan kirish ma'lumoti (faqat token, ism, sinf, maktab). */
export const AccountSchema = z.object({
  token: z.string().min(10),
  studentId: z.string(),
  name: z.string(),
  grade: z.number().int().min(1).max(11),
  className: z.string(),
  school: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

const KEY = 'ipak-yoli:account';

export function loadAccount(storage: Storage | undefined = globalThis.localStorage): Account | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const r = AccountSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account | null, storage: Storage | undefined = globalThis.localStorage) {
  try {
    if (a) storage?.setItem(KEY, JSON.stringify(a));
    else storage?.removeItem(KEY);
  } catch {
    /* storage bloklangan — keyingi safar qayta kiradi */
  }
}
