"""Foydalanuvchi bergan 14 ta yangi rasm (tools/manba/yangi14) -> public/img/*.webp.

- Personaj rasmlari "shaffof" deb berilgan, lekin ichida oq to'rtburchak fon bor: tashqaridan
  ulangan oq piksellar olib tashlanadi (ichkaridagi oq — ko'z, shox — saqlanadi), cheti yumshatiladi.
- bayram.png da dev oq to'rtburchak ichida yopishtirilgan: oq qism olib tashlanib, fon to'ldiriladi (inpaint).
- Fonlar 1200x900, personajlar ~640 px — arzon telefon uchun yengil.
"""
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools' / 'manba' / 'yangi14'
OUT = ROOT / 'public' / 'img'


def cut_white(path: Path, thr=232) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    mn, mx = rgb.min(-1), rgb.max(-1)
    whiteish = (mn >= thr) & (mx - mn < 22)
    bg = (alpha < 10) | whiteish
    lab, _ = ndi.label(bg)
    # tashqi chegaraga yoki shaffof hududga tegib turgan oq bo'laklar = fon
    outside = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) | set(np.unique(lab[alpha < 10]))
    outside.discard(0)
    mask = np.isin(lab, list(outside))
    # yarim oq chet piksellari (anti-aliasing "oq halqa") ham fonga
    ring = ndi.binary_dilation(mask, iterations=2) & ~mask
    soft = ring & (mn >= 200) & (mx - mn < 40)
    mask |= soft
    new_a = np.where(mask, 0, 255).astype(np.uint8)
    new_a = np.array(Image.fromarray(new_a).filter(ImageFilter.GaussianBlur(0.8)))
    new_a = np.minimum(new_a, np.where(mask, 0, 255)).astype(np.uint8) if False else new_a
    out = np.array(im)
    out[..., 3] = np.minimum(out[..., 3], new_a)
    res = Image.fromarray(out)
    return res.crop(res.getbbox())


def save_sprite(img: Image.Image, dst: str, max_side=512):
    img = img.copy()
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    p = OUT / dst
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, 'WEBP', quality=86, method=6)
    print(dst, img.size, p.stat().st_size // 1024, 'KB')


def save_bg(img: Image.Image, dst: str, size=(1200, 900)):
    img = img.convert('RGB').resize(size, Image.LANCZOS)
    p = OUT / dst
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, 'WEBP', quality=80, method=6)
    print(dst, img.size, p.stat().st_size // 1024, 'KB')


def crop_bayram() -> Image.Image:
    """Dev oq to'rtburchakda yopishtirilgan (o'ng tomon, x>1160) va atrofi xira — o'sha qism kesib tashlanadi.
    Dev videoda alohida (toza) rasm sifatida chiqadi."""
    return Image.open(SRC / 'final' / 'bayram.png').crop((0, 20, 1155, 886))


def fix_bayram() -> Image.Image:
    im = np.array(Image.open(SRC / 'final' / 'bayram.png').convert('RGB'))
    x0, y0, x1, y1 = 1150, 440, 1600, 1060  # dev yopishtirilgan oq to'rtburchak atrofi
    roi = im[y0:y1, x0:x1].astype(np.int16)
    mn, mx = roi.min(-1), roi.max(-1)
    white = (mn >= 228) & (mx - mn < 25)
    lab, _ = ndi.label(white)
    sizes = ndi.sum(white, lab, range(1, lab.max() + 1))
    big = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 400])
    mask = np.zeros(im.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = ndi.binary_dilation(big, iterations=3).astype(np.uint8) * 255
    print('bayram: oq piksellar', int(big.sum()))
    fixed = cv2.inpaint(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), mask, 9, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(fixed, cv2.COLOR_BGR2RGB))


def main():
    for name in ['oddiy', 'kuladi', 'uchadi', 'tutun', 'zarba', 'kechirim']:
        save_sprite(cut_white(SRC / 'dev' / f'{name}.png'), f'dev/{name}.webp')
    save_sprite(cut_white(SRC / 'bobo' / 'chaqiradi.png'), 'bobo/chaqiradi.webp')
    save_sprite(cut_white(SRC / 'intro' / 'kitob.png'), 'intro/kitob.webp', 420)
    for name in ['qishloq', 'kitob-sahna', 'boron', 'homush']:
        save_bg(Image.open(SRC / 'intro' / f'{name}.png'), f'intro/{name}.webp')
    save_bg(crop_bayram(), 'intro/bayram.webp')


if __name__ == '__main__':
    main()
