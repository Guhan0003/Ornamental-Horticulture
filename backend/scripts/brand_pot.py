"""
Print the StomatalWorld mark onto the pot in a plant photo.

    python scripts/brand_pot.py PHOTO --pot LEFT TOP RIGHT BOTTOM [--out FILE]

The pot box is the flat front face of the pot, in pixels, measured off the
photo — not the whole pot, since leaves usually overhang the top of it.

Size is chosen against what a phone actually renders rather than what looks
right at full resolution: the hero photo is about 375px wide on a phone, so a
pot 480px wide in a 1600px image is only ~110px on the screen someone is
holding. The default width is a fraction of the pot for that reason.
"""

import argparse
from pathlib import Path

from PIL import Image

BRAND = Path(__file__).resolve().parent.parent.parent / "brand" / "png"
LOGOS = {
    "lockup": BRAND / "logo-lockup-forest-2048.png",
    "mark": BRAND / "logo-mark-forest-2048.png",
}
# The lockup is wide, so it takes more of the pot than the mark does.
DEFAULT_WIDTH = {"lockup": 0.68, "mark": 0.26}


def brand(photo_path, pot, logo="lockup", width=None, opacity=0.88, out=None):
    left, top, right, bottom = pot
    pot_width = right - left
    centre = ((left + right) // 2, (top + bottom) // 2)

    photo = Image.open(photo_path).convert("RGBA")
    art = Image.open(LOGOS[logo]).convert("RGBA")

    w = int(pot_width * (width or DEFAULT_WIDTH[logo]))
    h = max(1, round(art.height * w / art.width))
    art = art.resize((w, h), Image.LANCZOS)

    # Slightly transparent, so it reads as printed on the pot rather than
    # pasted over the photograph.
    art.putalpha(art.getchannel("A").point(lambda v: int(v * opacity)))

    layer = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    layer.paste(art, (centre[0] - w // 2, centre[1] - h // 2), art)

    result = Image.alpha_composite(photo, layer).convert("RGB")
    out = out or photo_path
    result.save(out, quality=95)
    print(f"{logo} {w}x{h}px centred at {centre} -> {out}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo")
    parser.add_argument(
        "--pot", nargs=4, type=int, required=True, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM")
    )
    parser.add_argument("--logo", choices=sorted(LOGOS), default="lockup")
    parser.add_argument("--width", type=float, help="fraction of the pot's width")
    parser.add_argument("--opacity", type=float, default=0.88)
    parser.add_argument("--out", help="defaults to overwriting the photo")
    args = parser.parse_args()

    brand(args.photo, args.pot, args.logo, args.width, args.opacity, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
