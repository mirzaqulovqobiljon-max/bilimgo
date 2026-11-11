"""done.json dan o'yin ishlatadigan indeksni yasaydi: src/content/audio.uz.json

Kalit — ekranda ko'rinadigan aniq matn; qiymat — {file, voice}.
Shu sababli bobo.uz.json va topshiriq fayllariga tegilmaydi: yangi ibora qo'shilsa,
manifest -> TTS -> import -> shu skript, kod o'zgarmaydi.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

done = json.loads((ROOT / 'tools' / 'ovoz' / 'done.json').read_text())
index = {}
for v in sorted(done.values(), key=lambda v: (v['voice'], v['text'])):
    key = f"{v['voice']}|{v['text']}"
    index[key] = v['file']
out = ROOT / 'src' / 'content' / 'audio.uz.json'
out.write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n')
print(f'{len(index)} ta yozuv -> {out.relative_to(ROOT)}')
