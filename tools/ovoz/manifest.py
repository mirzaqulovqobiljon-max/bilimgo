"""O'yinda ovozlanadigan barcha iboralar ro'yxati (manifest).

Har bir yozuv: id, text (ekrandagi matn), voice (bobo|dev), out (fayl nomi).
O'yin audio faylni matn bo'yicha topadi (src/content/audio.uz.json), shuning uchun
bobo.uz.json va topshiriq fayllarini o'zgartirish shart emas.
"""
import glob, hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / 'src' / 'content'

ITEMS_ACC = ['kalit', "mash'al", 'qayiq', 'ot va suv meshi', 'arqon', 'qilich va qalqon', 'sehrli kalit-tumor']
LETTERS = list("ABDEFGHIJKLMNOPQRSTUVXYZ") + ["O'", "G'"]

# Dev gaplari (DevBattle.tsx dagi matnlar bilan bir xil bo'lishi shart — test tekshiradi)
DEV_LINES = [
    "Ho-ho! Bilim kitobini olmoqchimisan? Avval savollarimga javob ber!",
    "Kechiring! Kitobni qaytaraman, endi yaxshi bo'laman!",
    "Voy-voy! Bilimning kuchi mendan ham kuchli ekan!",
]


def slug(text: str) -> str:
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:10]


def build():
    out = []
    seen = set()

    def add(text, voice, group):
        key = (text, voice)
        if key in seen:
            return
        seen.add(key)
        out.append({'id': f'{voice}-{slug(text)}', 'text': text, 'voice': voice, 'group': group})

    bobo = json.loads((C / 'bobo.uz.json').read_text())
    for k, v in bobo.items():
        for line in (v if isinstance(v, list) else [v]):
            add(line['text'], 'bobo', 'bobo')

    levels = json.loads((C / 'levels.json').read_text())
    tasks = [t for f in sorted(glob.glob(str(C / 'tasks' / '*.json'))) for t in json.loads(Path(f).read_text())]
    # Kichik sayyohlar uchun: savollarni o'qib berish va maslahatlar (rejaga ko'ra 7-10 yoshga ovoz)
    for t in tasks:
        c = t['tiers'].get('kichik')
        if not c:
            continue
        for q in c.get('questions', []):
            add(q['q'], 'bobo', 'savol')
            add(q['hint'], 'bobo', 'maslahat')
        for w in c.get('words', []):
            add(w['q'], 'bobo', 'savol')
        for f in ('prompt', 'hint'):
            if f in c:
                add(c[f], 'bobo', 'maslahat' if f == 'hint' else 'savol')
    # Dev jangi: barcha darajadagi savollar dev ovozida (ovoz kattalarda ixtiyoriy)
    for l in levels:
        b = l['obstacle'].get('battle')
        if b:
            for tier in ('kichik', 'karvon', 'olim'):
                for q in b[tier]['questions']:
                    add(q['q'], 'dev', 'dev-savol')
    for line in DEV_LINES:
        add(line, 'dev', 'dev')
    # Dinamik iboralar (kodda yig'iladigan matnlar)
    add('Endi yonib turgan joyni bos.', 'bobo', 'dinamik')
    add('Yana bir oz yaqinroq olib bor.', 'bobo', 'dinamik')
    for n in ITEMS_ACC:
        add(f'Avval sumkadagi {n}ni ol.', 'bobo', 'dinamik')
    for x in LETTERS:
        add(f'Bu so\'z "{x}" harfi bilan boshlanadi.', 'bobo', 'dinamik')
    add("Hali hech biri o'z joyida emas. Almashtirib ko'r!", 'bobo', 'dinamik')
    for n in range(1, 8):
        add(f"{n} tasi o'z joyida. Qolganini almashtirib ko'r!", 'bobo', 'dinamik')
    return out


if __name__ == '__main__':
    m = build()
    print(len(m), 'ta ibora;', sum(len(x['text']) for x in m), 'belgi')
    odd = [x for x in m if re.search(r'[0-9=+×−√₂²³🔴🔵🟢"]', x['text'])]
    print('\nMaxsus belgili matnlar:', len(odd))
    for x in odd:
        print(f"  [{x['voice']}] {x['text']}")
