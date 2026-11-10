import levelsRaw from './levels.json';
import itemsRaw from './items.json';
import boboRaw from './bobo.uz.json';
import onaQishloqTasks from './tasks/ona-qishloq.json';
import { PICTURE_KEYS } from './pictures';
import { parseContent, type ContentBundle } from './validate';

/**
 * Yangi bosqich qo'shish = levels.json'ga yozuv + tasks/<id>.json fayl + shu ro'yxatga bitta qator.
 * (2-bosqichda bu ro'yxat ham avtomatik bo'ladi: import.meta.glob yoki serverdan fetch.)
 */
export const RAW_CONTENT = {
  levels: levelsRaw as unknown,
  items: itemsRaw as unknown,
  bobo: boboRaw as unknown,
  tasks: [...onaQishloqTasks] as unknown,
};

let cached: ContentBundle | null = null;

export function loadContent(): ContentBundle {
  if (cached) return cached;
  const { bundle, errors } = parseContent(RAW_CONTENT, PICTURE_KEYS);
  if (!bundle) throw new Error(`Kontentda xatolar:\n- ${errors.join('\n- ')}`);
  cached = bundle;
  return bundle;
}
