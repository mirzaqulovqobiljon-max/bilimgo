"""Eski qo'pol tuya/"otcha" rasmlarini foydalanuvchi bergan tuyalar bilan almashtiradi.
Manba: tools/manba/tuya-ikkita.png (chap — tuyaga mingan bola, o'ng — meshli tuya),
asl rasmlar: tools/manba/asl/ (har safar asldan quriladi — skriptni qayta ishga tushirish xavfsiz).

  karvon-belgi.webp      -> tuyaga mingan bola (xaritadagi karvon belgisi, labirint qahramoni)
  xarita.webp            -> cho'ldagi tuya o'rniga meshli tuya
  puzzle/chol.webp       -> cho'l puzzle rasmidagi tuya o'rniga meshli tuya
  sertifikat-ramka.webp  -> tepadagi ikki qo'pol tuya o'rniga meshli tuya
Ishlatish: python3 -I tools/tuya_almashtir.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASL = ROOT / 'tools/manba/asl'
IMG = ROOT / 'public/img'

# ---- foydalanuvchi rasmidan ikki tuyani ajratish (tools/tuya.py bilan bir xil usul) ----
from scipy import ndimage  # noqa: E402

src = np.array(Image.open(ROOT / 'tools/manba/tuya-ikkita.png').convert('RGBA'))
lab, n = ndimage.label(src[:, :, 3] > 20)
centers = ndimage.center_of_mass(np.ones_like(lab), lab, range(1, n + 1))
mid = src.shape[1] / 2
xs = np.arange(src.shape[1])[None, :]
soft = (src[:, :, 3] > 0) & (src[:, :, 3] <= 20)


def part(right: bool) -> Image.Image:
    ids = [i + 1 for i, c in enumerate(centers) if (c[1] >= mid) == right]
    mask = np.isin(lab, ids) | (soft & ((xs >= mid) == right))
    a = src.copy()
    a[~mask, 3] = 0
    rgb = a[:, :, :3].astype(int)
    # pastdagi kulrang soyani olib tashlaymiz — har sahnada o'z rangidagi soya chiziladi
    grey = (rgb.max(axis=2) - rgb.min(axis=2) < 55) & (rgb.min(axis=2) > 140)  # iliq kulrang soya
    rows = np.arange(a.shape[0])[:, None] > a.shape[0] * 0.85
    a[grey & rows, 3] = 0
    im = Image.fromarray(a)
    return im.crop(im.getbbox())


RIDER = part(False)
MESH = part(True)


def fit_h(im: Image.Image, h: int) -> Image.Image:
    return im.resize((round(im.size[0] * h / im.size[1]), h), Image.LANCZOS)


def remove(scene: Image.Image, rect, extra_bg=(), dark_extra=None) -> Image.Image:
    """rect ichidagi eski tuyani GrabCut bilan topib, atrofidagi fon bilan to'ldiradi (inpaint)."""
    bgr = cv2.cvtColor(np.array(scene.convert('RGB')), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    b1, b2 = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(bgr, mask, rect, b1, b2, 8, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    if dark_extra:  # ingichka qorong'i qismlar (dum uchi) GrabCut'dan qochib qolmasin
        x0, y0, x1, y1 = dark_extra
        lum = bgr[y0:y1, x0:x1].astype(int).sum(axis=2)
        m[y0:y1, x0:x1][lum < 330] = 255
    for (x0, y0, x1, y1) in extra_bg:
        m[y0:y1, x0:x1] = 0
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    out = cv2.inpaint(bgr, m, 9, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).convert('RGBA')


def put(scene: Image.Image, sprite: Image.Image, x: int, bottom: int, shadow=(120, 80, 40, 90)):
    """Spraytni oyoqlari 'bottom' chizig'ida turadigan qilib qo'yadi, ostiga yumshoq soya."""
    w, h = sprite.size
    layer = Image.new('RGBA', scene.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((x + w * 0.08, bottom - h * 0.05, x + w * 0.92, bottom + h * 0.05), fill=shadow)
    scene.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(2, h // 40))))
    scene.alpha_composite(sprite, (x, bottom - h))


# 1) Karvon belgisi: tuyaga mingan bola, 160x160 shaffof
S = 160
r = fit_h(RIDER, S - 8) if RIDER.size[1] >= RIDER.size[0] else RIDER.resize((S - 8, round(RIDER.size[1] * (S - 8) / RIDER.size[0])), Image.LANCZOS)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.alpha_composite(r, ((S - r.size[0]) // 2, S - 4 - r.size[1]))
icon.save(IMG / 'karvon-belgi.webp', 'WEBP', quality=88, method=6)
print('karvon-belgi.webp', icon.size)

# 2) Xarita: tuya taxminan (152..305, 443..536); daraxt chapda — unga tegmaymiz
xarita = Image.open(ASL / 'xarita.webp').convert('RGBA')
xarita = remove(xarita, (148, 436, 164, 106), extra_bg=[(0, 470, 146, 640)], dark_extra=(146, 470, 200, 520))
put(xarita, fit_h(MESH, 104), 170, 538, shadow=(150, 95, 40, 80))
xarita.convert('RGB').save(IMG / 'xarita.webp', 'WEBP', quality=82, method=6)
print('xarita.webp', xarita.size)

# 3) Cho'l puzzle: tuya (0..385, 395..720)
chol = Image.open(ASL / 'puzzle_chol.webp').convert('RGBA')
chol = remove(chol, (0, 388, 392, 335), extra_bg=[(300, 630, 480, 720)])
put(chol, fit_h(MESH, 340), 18, 718, shadow=(150, 95, 40, 90))
chol.convert('RGB').save(IMG / 'puzzle/chol.webp', 'WEBP', quality=82, method=6)
print('puzzle/chol.webp', chol.size)

# 4) Sertifikat: ikki qo'pol tuya -> fon rangi bilan yopib, meshli tuya
cert = Image.open(ASL / 'sertifikat-ramka.webp').convert('RGBA')
bg = cert.getpixel((640, 400))
d = ImageDraw.Draw(cert)
small = fit_h(MESH, 96)
for x0 in (290, 855):
    d.rectangle((x0, 172, x0 + 115, 266), fill=bg)
    cert.alpha_composite(small, (x0 + (115 - small.size[0]) // 2, 266 - small.size[1]))
cert.convert('RGB').save(IMG / 'sertifikat-ramka.webp', 'WEBP', quality=85, method=6)
print('sertifikat-ramka.webp', cert.size)
