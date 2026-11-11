"""Rassom/generator rasmlarini o'yin uchun tayyorlash: kichraytirish, WebP, ortiqcha bo'laklarni tozalash.

Ishlatish:  python3 tools/rasmlar.py <asl-rasmlar-papkasi>
Natija:     public/img/...  (asl PNG'lar repoga kirmaydi)
Talab:      Python 3 + Pillow
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'img'


def clean_islands(im: Image.Image, min_share=0.01) -> Image.Image:
    """Rasm chetiga tegib turgan, asosiy shakldan uzilgan mayda bo'laklarni (generator qoldiqlarini) o'chiradi.
    Ichkaridagi mayda bezaklar (uchqun, yulduzcha) saqlanadi."""
    im = im.convert('RGBA')
    small = im.copy()
    small.thumbnail((200, 200))
    w, h = small.size
    a = small.getchannel('A').load()
    seen = [[False] * h for _ in range(w)]
    comps = []
    for x in range(w):
        for y in range(h):
            if seen[x][y] or a[x, y] < 20:
                continue
            q, comp = deque([(x, y)]), []
            seen[x][y] = True
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and a[nx, ny] >= 20:
                        seen[nx][ny] = True
                        q.append((nx, ny))
            comps.append(comp)
    if len(comps) <= 1:
        return im
    total = sum(len(c) for c in comps)
    sx, sy = im.width / w, im.height / h
    alpha = im.getchannel('A')
    px = alpha.load()
    removed = 0
    for comp in comps:
        touches_edge = any(cx in (0, w - 1) or cy in (0, h - 1) for cx, cy in comp)
        if touches_edge and len(comp) / total < min_share:
            removed += 1
            for cx, cy in comp:
                for dx in range(int(sx) + 2):
                    for dy in range(int(sy) + 2):
                        X, Y = int(cx * sx) + dx - 1, int(cy * sy) + dy - 1
                        if 0 <= X < im.width and 0 <= Y < im.height:
                            px[X, Y] = 0
    im.putalpha(alpha)
    if removed:
        print(f'    tozalandi: {removed} ta mayda bo\'lak')
    return im


def save(name: str, out: str, size, quality=80, clean=False, fmt='webp', erase_left=0.0):
    im = Image.open(SRC / name)
    im = clean_islands(im) if clean else im.convert('RGBA' if fmt == 'webp' else 'RGB')
    if erase_left:  # figuradan chapdagi qoldiq bo'lakni o'chirish (bobo-korsatadi)
        a = im.getchannel('A')
        a.paste(0, (0, 0, int(im.width * erase_left), im.height))
        im.putalpha(a)
    im.thumbnail(size, Image.LANCZOS)
    dst = OUT / out
    dst.parent.mkdir(parents=True, exist_ok=True)
    if fmt == 'webp':
        im.save(dst, 'WEBP', quality=quality, method=6)
    else:
        im.convert('RGB').save(dst, 'PNG', optimize=True)
    print(f'{name:30} -> {out:34} {im.size[0]}x{im.size[1]} {dst.stat().st_size // 1024} KB')


for mood in ('gapiradi', 'korsatadi', 'maqtaydi', 'oylaydi'):
    save(f'bobo-{mood}.png', f'bobo/{mood}.webp', (240, 280), 85, clean=True, erase_left=0.28 if mood == 'korsatadi' else 0)
for st in ('oddiy', 'zarba', 'kechirim', 'tutun'):
    save(f'dev-{st}.png', f'dev/{st}.webp', (320, 400), 82, clean=True)
for f in sorted(SRC.glob('buyum-*.png')):
    save(f.name, f'buyum/{f.stem[6:]}.webp', (160, 160), 85, clean=True)
for f in sorted(SRC.glob('qism-*.png')):
    save(f.name, f'qism/{f.stem[5:]}.webp', (160, 160), 85, clean=True)
for f in sorted(SRC.glob('puzzle-*.png')):
    save(f.name, f'puzzle/{f.stem[7:]}.webp', (800, 800), 80)
for f in sorted(SRC.glob('tosiq-*.png')):
    save(f.name, f'tosiq/{f.stem[6:]}.webp', (900, 780), 78)
save('xarita.png', 'xarita.webp', (720, 1280), 80)
save('karvon-belgi.png', 'karvon-belgi.webp', (128, 128), 85, clean=True)
save('karta-orqasi.png', 'karta-orqasi.webp', (240, 320), 80)
save('sertifikat-ramka.png', 'sertifikat-ramka.webp', (1240, 1754), 82)
# Ilova ikonkalari (PNG — PWA talabi)
for s in (192, 512):
    im = Image.open(SRC / 'ilova-ikonka.png').convert('RGB').resize((s, s), Image.LANCZOS)
    im.save(OUT.parent / f'icon-{s}.png', optimize=True)
    print(f'ilova-ikonka.png -> icon-{s}.png')
