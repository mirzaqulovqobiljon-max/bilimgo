// Node'da (Vite'siz) kontentni yuklash: import.meta.glob o'rniga fs.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PICTURE_KEYS } from '../../src/content/pictures';
import { parseContent, type ContentBundle } from '../../src/content/validate';

export function loadContentForNode(): ContentBundle {
  const dir = fileURLToPath(new URL('../../src/content/', import.meta.url));
  const read = (f: string) => JSON.parse(readFileSync(dir + f, 'utf8'));
  const tasks = readdirSync(dir + 'tasks').sort().flatMap((f) => read('tasks/' + f));
  const { bundle, errors } = parseContent({ levels: read('levels.json'), items: read('items.json'), bobo: read('bobo.uz.json'), tasks }, PICTURE_KEYS);
  if (!bundle) throw new Error(errors.join('\n'));
  return bundle;
}
