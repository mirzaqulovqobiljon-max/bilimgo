"""Manifestdagi, lekin hali yozilmagan iboralar (harf maslahatlari ataylab tashlab ketiladi).
Ishlatish: python3 -I tools/ovoz/missing.py /tmp/ovoz/todo2.json
Natija formati import_results.py kutgani bilan bir xil (bobo avval, keyin dev)."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from manifest import build  # noqa: E402
from speak import speak  # noqa: E402

done = json.loads((Path(__file__).parent / 'done.json').read_text())
LETTER_HINT = 'Bu so\'z "'  # krossvord harf maslahatlari ataylab ovozlanmaydi
todo = [x for x in build() if x['id'] not in done and not x['text'].startswith(LETTER_HINT)]
todo.sort(key=lambda x: x['voice'] != 'bobo')
for x in todo:
    x['speak'] = speak(x['text'])
Path(sys.argv[1]).write_text(json.dumps(todo, ensure_ascii=False, indent=1))
for i, x in enumerate(todo):
    print(i, x['voice'], x['group'], repr(x['speak']))
