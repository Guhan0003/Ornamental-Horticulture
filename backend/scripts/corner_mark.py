"""
Put the StomatalWorld mark in a corner of a photo.

    python scripts/corner_mark.py PHOTO [--corner left|right] [--out FILE]

The fallback for photos that brand_pot.py cannot handle — a plant in a plain
nursery pot, or a shot cropped so close that no pot face is in frame.

Prefer brand_pot.py wherever there is a pot to print on. On the pot the mark
reads as the product being branded; in a corner it reads as a watermark on a
photograph, which is a different thing, and running both styles across the
catalogue is a compromise rather than a choice.
"""

import argparse
from pathlib import Path

from PIL import Image

LOGO = Path(__file__).resolve().parent.parent.parent / "brand" / "png" / "logo-lockup-forest-2048.png"

WIDTH = 0.30    # of the photo's width
OPACITY = 0.72  # present without competing with the plant
MARGIN = 0.04


def corner_mark(photo_path, corner="left", out=None):
    photo = Image.open(photo_path).convert("RGBA")
    art = Image.open(LOGO).convert("RGBA")

    w = int(photo.width * WIDTH)
    h = max(1, round(art.height * w / art.width))
    art = art.resize((w, h), Image.LANCZOS)
    art.putalpha(art.getchannel("A").point(lambda v: int(v * OPACITY)))

    pad = int(photo.width * MARGIN)
    x = pad if corner == "left" else photo.width - w - pad
    y = photo.height - h - pad

    layer = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    layer.paste(art, (x, y), art)

    result = Image.alpha_composite(photo, layer).convert("RGB")
    out = out or photo_path
    result.save(out, quality=95)
    print(f"mark {w}x{h}px in the {corner} corner -> {out}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo")
    parser.add_argument("--corner", choices=("left", "right"), default="left")
    parser.add_argument("--out", help="defaults to overwriting the photo")
    args = parser.parse_args()

    corner_mark(args.photo, args.corner, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
