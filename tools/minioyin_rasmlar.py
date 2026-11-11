"""5 ta yangi mini-o'yin uchun rasmlar: foydalanuvchi bergan PNG paketidan WebP yasaydi.
Ishlatish:  python3 -I tools/minioyin_rasmlar.py <ochilgan_paket_papkasi>
Natija:     public/img/minigames/<o'yin>/*.webp

- sahnalar 960x540 (fon); yashirin buyumlar sahnasi 1280x720 (yaqinlashtirganda ham tiniq);
- ot yugurishi: chavandozli ot, xoda va yulduz OpenCV GrabCut bilan fondan ajratiladi,
  fon esa sahnaning ot yo'q o'ng qismidan (yulduzlar o'chirilib) va pastki tosh yo'lakdan olinadi.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

PKG = Path(sys.argv[1]) / 'PNG_rasmlar'
OUT = Path(__file__).resolve().parents[1] / 'public/img/minigames'


def save(img: Image.Image, rel: str, size=None, q=80):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.save(p, 'WEBP', quality=q, method=6)
    print(f'{rel:32} {img.size[0]}x{img.size[1]} {p.stat().st_size // 1024} KB')


def scene(folder: str, rel: str, size=(960, 540), q=78):
    save(Image.open(PKG / folder / '02_sahna_1600x900.png').convert('RGB'), rel, size, q)


scene('01_sirli_labirint', 'labirint/sahna.webp')
scene('02_yashirin_buyumlar', 'yashirin/sahna.webp', (1280, 720), 82)
scene('04_sehrli_sandiq', 'sandiq/sahna.webp')
scene('05_dev_yakuniy_jang', 'jang/sahna.webp')

# ---------- Ot bilan to'siqlar ----------
src = cv2.imread(str(PKG / '03_ot_bilan_tosiqlar/02_sahna_1600x900.png'))
H, W = src.shape[:2]
b, g, r = [src[:, :, i].astype(int) for i in range(3)]
sky = (b > r + 25) & (b > 140)


def to_pil(bgra):
    return Image.fromarray(cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA))


def cutout(mask_init, iters=10, kill=None):
    bgd = np.zeros((1, 65)); fgd = np.zeros((1, 65))
    m0 = mask_init.copy()
    cv2.grabCut(src, m0, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
    m = np.where((m0 == 1) | (m0 == 3), 255, 0).astype(np.uint8)
    if kill is not None:
        m[kill] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    ff = m.copy(); fm = np.zeros((H + 2, W + 2), np.uint8); cv2.floodFill(ff, fm, (0, 0), 255); m = m | cv2.bitwise_not(ff)
    m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(src, cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = m
    x, y, w, h = cv2.boundingRect((m > 10).astype(np.uint8))
    return to_pil(rgba[y:y + h, x:x + w]), m


def rect_mask(x0, y0, x1, y1, inside=cv2.GC_PR_FGD):
    m = np.full((H, W), cv2.GC_BGD, np.uint8); m[y0:y1, x0:x1] = inside; return m


# chavandozli ot: osmon va barglar aniq fon, tana/oyoqlarga ishoralar
m = rect_mask(215, 20, 975, 670, cv2.GC_PR_BGD)
inside = np.zeros((H, W), bool); inside[20:670, 215:975] = True
leaves = (g > r + 10) & (g > b) & (np.arange(H)[:, None] < 250)
m[inside & (sky | leaves)] = cv2.GC_BGD
for v, rects in [
    (cv2.GC_FGD, [(590, 70, 700, 180), (470, 190, 640, 420), (700, 190, 880, 300), (380, 360, 760, 470)]),
    (cv2.GC_PR_FGD, [(780, 360, 930, 520), (270, 480, 430, 660), (225, 350, 420, 520), (560, 30, 740, 110), (420, 160, 480, 330)]),
]:
    for (a, c, d, e) in rects: m[c:e, a:d] = v
horse, _ = cutout(m, kill=sky | ((b > r + 12) & (b > 170)))
save(horse, 'ot/ot.webp', (300, round(horse.size[1] * 300 / horse.size[0])), 85)

logs, _ = cutout(rect_mask(490, 560, 1140, 790), 8)
save(logs, 'ot/xoda.webp', (220, round(logs.size[1] * 220 / logs.size[0])), 85)
star, _ = cutout(rect_mask(935, 380, 1050, 495), 8)
save(star, 'ot/yulduz.webp', (64, 60), 88)

# fon: otdan o'ngdagi qism (qal'a, qumtepalar); 3 ta yulduz faqat o'z joyida o'chiriladi
X0, Y0, X1, Y1 = 985, 0, 1600, 560
STAR_BOXES = [(935, 370, 1050, 482), (1062, 296, 1186, 410), (1222, 246, 1372, 378)]
star_mask = np.zeros((H, W), np.uint8)
yellow = (r > 200) & (g > 140) & (r - b > 35)
for (a0, c0, d0, e0) in STAR_BOXES:
    box_m = np.zeros((H, W), bool); box_m[c0:e0, a0:d0] = True
    star_mask[box_m & yellow] = 255
star_mask = cv2.dilate(star_mask, np.ones((13, 13), np.uint8))
clean = cv2.inpaint(src, star_mask, 5, cv2.INPAINT_NS)
bg = clean[Y0:Y1, X0:X1]
save(Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB)), 'ot/fon.webp', (615, 560), 78)

# yer: pastki tosh yo'lak, ko'zgu nusxasi bilan choksiz takrorlanadi
strip = Image.fromarray(cv2.cvtColor(src[790:900, 480:1600], cv2.COLOR_BGR2RGB))
tile = Image.new('RGB', (strip.size[0] * 2, strip.size[1]))
tile.paste(strip, (0, 0)); tile.paste(strip.transpose(Image.FLIP_LEFT_RIGHT), (strip.size[0], 0))
save(tile, 'ot/yer.webp', (1120, 55), 78)
