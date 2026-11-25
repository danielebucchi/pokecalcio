#!/usr/bin/env python3
"""
Anteprima per i link condivisi (Open Graph): public/og.png, 1200x630.

Testo con i font del gioco (Fredoka + Manrope, scaricati da Google Fonts la prima volta)
e l'icona della Poké Ball del gioco, sui colori del tema scuro. Non finisce nel bundle:
si rilancia a mano quando cambia qualcosa.

    python3 scripts/make-og.py
"""
from pathlib import Path
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'og.png'
ICON = ROOT / 'public' / 'icons' / 'icon-512.png'
W, H = 1200, 630

# palette di style.css (tema scuro)
BG = (26, 19, 38)          # #1a1326
INK = (243, 236, 255)      # #f3ecff
INK_SOFT = (200, 185, 230)  # #c8b9e6
PINK = (232, 121, 168)     # #e879a8
LILAC = (168, 144, 216)    # #a890d8
MINT = (125, 209, 184)     # #7dd1b8
SKY = (142, 197, 216)      # #8ec5d8

FONTS = {
    'Fredoka.ttf': 'https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf',
    'Manrope.ttf': 'https://github.com/google/fonts/raw/main/ofl/manrope/Manrope%5Bwght%5D.ttf',
}


def font_file(name: str) -> Path:
    cache = Path(tempfile.gettempdir()) / 'pokecalcio-og-fonts'
    cache.mkdir(exist_ok=True)
    path = cache / name
    if not path.exists():
        urllib.request.urlretrieve(FONTS[name], path)
    return path


def font(name: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(font_file(name)), size)
    axes = f.get_variation_axes()
    f.set_variation_by_axes([weight if a['name'] in (b'Weight', 'Weight') else a['default'] for a in axes])
    return f


def glow(img: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius // 2)))


def main():
    img = Image.new('RGBA', (W, H), (*BG, 255))
    # le stesse "nuvole" pastello dello sfondo del gioco
    glow(img, (180, 90), 320, LILAC, 90)
    glow(img, (1080, 160), 300, SKY, 70)
    glow(img, (640, 720), 360, MINT, 70)

    # la Poké Ball dell'icona, a destra, in un disco chiaro
    icon = Image.open(ICON).convert('RGBA').resize((380, 380), Image.LANCZOS)
    mask = Image.new('L', icon.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, *icon.size), fill=255)
    disc = Image.new('RGBA', icon.size, (0, 0, 0, 0))
    disc.paste(icon, (0, 0), mask)
    ix, iy = W - 380 - 90, (H - 380) // 2
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((ix + 10, iy + 22, ix + 390, iy + 402), fill=(0, 0, 0, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(disc, (ix, iy))

    d = ImageDraw.Draw(img)
    x = 90
    title = font('Fredoka.ttf', 118, 600)
    d.text((x, 150), 'Poké', font=title, fill=INK)
    d.text((x + d.textlength('Poké', font=title), 150), 'Calcio', font=title, fill=PINK)

    tag = font('Manrope.ttf', 40, 700)
    d.text((x, 300), 'Calcio a 5 con i Pokémon', font=tag, fill=INK)
    sub = font('Manrope.ttf', 30, 500)
    d.text((x, 360), 'Palestre, Lega e Pokédex di Kanto.', font=sub, fill=INK_SOFT)
    d.text((x, 400), 'Gratis, nel browser.', font=sub, fill=INK_SOFT)

    # l'indirizzo in una pillola, come i bottoni del gioco
    url = font('Manrope.ttf', 28, 700)
    label = 'play.nerdnostalgia.store'
    tw = d.textlength(label, font=url)
    d.rounded_rectangle((x, 480, x + tw + 56, 540), radius=30, fill=(*LILAC, 255))
    d.text((x + 28, 510), label, font=url, fill=BG, anchor='lm')

    img.convert('RGB').save(OUT, optimize=True)
    print(f'scritto {OUT.relative_to(ROOT)} ({W}x{H})')


if __name__ == '__main__':
    main()
