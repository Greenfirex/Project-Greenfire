"""Vyřízne jednolité pozadí z fotografií listí a uloží PNG s průhledností.

Používá se pro sprity, které generátor obrázků umí jen s jednolitým pozadím
(typicky purpurovým). Barvu pozadí bere z rohů, udělá měkkou masku, potlačí
barevný lem na okrajích listů a ořízne prázdné okraje. Výsledek zmenší na
zadanou nejdelší stranu.

    python tools/cutout_leaves.py tools/_temp/bush_*.jpg
    python tools/cutout_leaves.py tools/_temp/*.jpg --out public/assets/nature/textures
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DEFAULT_OUT = 'public/assets/nature/textures'
LOW = 55
HIGH = 115
EDGE_SOFTEN = 0.6
PAD = 2
CUT_ALPHA = 16


def corner_key(rgb):
    h, w, _ = rgb.shape
    patch = 8
    samples = np.concatenate([
        rgb[:patch, :patch].reshape(-1, 3),
        rgb[:patch, -patch:].reshape(-1, 3),
        rgb[-patch:, :patch].reshape(-1, 3),
        rgb[-patch:, -patch:].reshape(-1, 3),
    ]).astype(np.float32)
    return np.median(samples, axis=0)


def cutout(image, low=LOW, high=HIGH):
    rgb = np.asarray(image.convert('RGB'), dtype=np.float32)
    key = corner_key(rgb)
    dist = np.linalg.norm(rgb - key[None, None, :], axis=2)
    alpha = np.clip((dist - low) / (high - low), 0.0, 1.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    excess = np.clip(np.minimum(r, b) - g, 0.0, None) * 0.85
    tinted = alpha < 0.98
    rgb[..., 0] = np.where(tinted, r - excess, r)
    rgb[..., 2] = np.where(tinted, b - excess, b)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255.0]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    hull = out.getchannel('A').filter(ImageFilter.GaussianBlur(EDGE_SOFTEN))
    out.putalpha(hull)
    return out


def trim(image, pad=PAD):
    mask = image.getchannel('A').point(lambda a: 255 if a > CUT_ALPHA else 0)
    bbox = mask.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    width, height = image.size
    return image.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    ))


def fit(image, size):
    width, height = image.size
    longest = max(width, height)
    if longest <= size:
        return image
    scale = size / longest
    return image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description='Vyřízne jednolité pozadí a uloží PNG s alfou.')
    parser.add_argument('files', nargs='+', help='vstupní obrázky (jpg/png)')
    parser.add_argument('--out', default=DEFAULT_OUT, help='cílová složka')
    parser.add_argument('--size', type=int, default=1024, help='nejdelší strana výsledku')
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in args.files:
        source = Path(name)
        image = fit(trim(cutout(Image.open(source))), args.size)
        target = out_dir / f'{source.stem}.png'
        image.save(target, optimize=True)
        size_kb = target.stat().st_size / 1024
        print(f'{source.name} -> {target.name} ({image.width}x{image.height}, {size_kb:.0f} kB)')


if __name__ == '__main__':
    main()
