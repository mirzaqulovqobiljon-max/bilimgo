"""Foydalanuvchi bergan "tuya" rasmidan (tools/manba/tuya-ikkita.png) ikki asset yasaydi:
  - o'ng tuya (meshli)      -> public/img/buyum/ot-mesh.webp   (sumkadagi buyum ikonkasi, 160x160)
  - chap tuya (bola mingan)  -> public/img/tosiq/chol-keyin.webp (cho'ldan o'tilgandan keyingi sahna)
Sahna "oldin" rasmi (chol-oldin.webp) ustiga qurladi, shuning uchun ikkalasi bir-biriga mos.
Ishlatish: python3 -I tools/tuya.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
src = Image.open(ROOT / 'tools/manba/tuya-ikkita.png').convert('RGBA')
arr = np.array(src)
lab, n = ndimage.label(arr[:, :, 3] > 20)
centers = ndimage.center_of_mass(np.ones_like(lab), lab, range(1, n + 1))
mid = arr.shape[1] / 2
xs = np.arange(arr.shape[1])[None, :]
soft = (arr[:, :, 3] > 0) & (arr[:, :, 3] <= 20)


def part(right: bool) -> Image.Image:
    ids = [i + 1 for i, c in enumerate(centers) if (c[1] >= mid) == right]
    mask = np.isin(lab, ids) | (soft & ((xs >= mid) == right))
    out = arr.copy()
    out[~mask, 3] = 0
    im = Image.fromarray(out)
    return im.crop(im.getbbox())


def without_shadow(im: Image.Image) -> Image.Image:
    """Rasm ostidagi kulrang soyani olib tashlaydi (sahnada o'zimiz qum rangida soya chizamiz)."""
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    grey = (rgb.max(axis=2) - rgb.min(axis=2) < 30) & (rgb.min(axis=2) > 120)  # och, rangsiz = soya
    rows = np.arange(a.shape[0])[:, None] > a.shape[0] * 0.82
    a[grey & rows, 3] = 0
    out = Image.fromarray(a)
    return out.crop(out.getbbox())


# 1) Buyum ikonkasi
right = part(True)
S, pad = 160, 6
k = (S - 2 * pad) / max(right.size)
small = right.resize((round(right.size[0] * k), round(right.size[1] * k)), Image.LANCZOS)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.alpha_composite(small, ((S - small.size[0]) // 2, S - pad - small.size[1]))
icon.save(ROOT / 'public/img/buyum/ot-mesh.webp', 'WEBP', quality=88, method=6)

# 2) Sahna: cho'l + bola mingan tuya + izlar
scene = Image.open(ROOT / 'public/img/tosiq/chol-oldin.webp').convert('RGBA')
W, H = scene.size
rider = without_shadow(part(False))
tw = int(W * 0.5)
rider = rider.resize((tw, round(rider.size[1] * tw / rider.size[0])), Image.LANCZOS)
x = int(W * 0.40)
y = int(H * 0.86) - rider.size[1]

# izlar: tuya orqasidan chapga qarab, kichrayib boradi
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
for i in range(7):
    px = x + int(tw * 0.12) - i * int(W * 0.055)
    py = int(H * 0.85) - i * int(H * 0.012) + (8 if i % 2 else -6)
    r = max(6, 15 - i)
    d.ellipse((px - r * 1.6, py - r * 0.6, px + r * 1.6, py + r * 0.6), fill=(105, 62, 25, 170 - i * 18))
# yumshoq soya
d.ellipse((x + tw * 0.08, H * 0.845, x + tw * 0.92, H * 0.895), fill=(110, 70, 30, 90))
layer = layer.filter(ImageFilter.GaussianBlur(3))
scene.alpha_composite(layer)
scene.alpha_composite(rider, (x, y))
scene.convert('RGB').save(ROOT / 'public/img/tosiq/chol-keyin.webp', 'WEBP', quality=82, method=6)
print('ot-mesh.webp va chol-keyin.webp yangilandi')
