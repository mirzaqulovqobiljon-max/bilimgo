import levelsRaw from './levels.json';
import itemsRaw from './items.json';
import boboRaw from './bobo.uz.json';
import { PICTURE_KEYS } from './pictures';
import { parseContent, type ContentBundle } from './validate';

/**
 * Yangi bosqich qo'shish = levels.json'ga yozuv + tasks/<id>.json fayl. Kod o'zgarmaydi:
 * tasks/ papkasidagi barcha JSON fayllar avtomatik yig'iladi.
 */
const taskFiles = import.meta.glob<{ default: unknown[] }>('./tasks/*.json', { eager: true });

export const RAW_CONTENT = {
  levels: levelsRaw as unknown,
  items: itemsRaw as unknown,
  bobo: boboRaw as unknown,
  tasks: Object.keys(taskFiles)
    .sort()
    .flatMap((k) => taskFiles[k]!.default) as unknown,
};

let cached: ContentBundle | null = null;

export function loadContent(): ContentBundle {
  if (cached) return cached;
  const { bundle, errors } = parseContent(RAW_CONTENT, PICTURE_KEYS);
  if (!bundle) throw new Error(`Kontentda xatolar:\n- ${errors.join('\n- ')}`);
  cached = bundle;
  return bundle;
}
