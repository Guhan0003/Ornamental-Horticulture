"""Place the StomatalWorld logo on the pot, as if printed on it."""
from PIL import Image

PHOTO = "seed/parlour-palm-chamaedorea.jpg"
OUT = "/private/tmp/claude-501/-Users-gowsi-Guhan-Projects-Ornamental-Horticulture/a2c68195-74bf-4657-a617-02660ae1ad61/scratchpad"

# The flat front face of the pot, measured off the crop.
POT_LEFT, POT_RIGHT = 610, 980
POT_TOP, POT_BOTTOM = 1200, 1480
POT_W = POT_RIGHT - POT_LEFT
CENTRE_X = (POT_LEFT + POT_RIGHT) // 2


def place(logo_path, width_fraction, centre_y, opacity, out_name):
    photo = Image.open(PHOTO).convert("RGBA")
    logo = Image.open(logo_path).convert("RGBA")

    w = int(POT_W * width_fraction)
    h = max(1, round(logo.height * w / logo.width))
    logo = logo.resize((w, h), Image.LANCZOS)

    # Slightly transparent so it reads as printed on the pot rather than
    # pasted over the photograph.
    alpha = logo.getchannel("A").point(lambda v: int(v * opacity))
    logo.putalpha(alpha)

    layer = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    layer.paste(logo, (CENTRE_X - w // 2, centre_y - h // 2), logo)

    out = Image.alpha_composite(photo, layer).convert("RGB")
    path = f"{OUT}/{out_name}"
    out.save(path, quality=95)
    print(f"{out_name}: logo {w}x{h}px at centre ({CENTRE_X}, {centre_y})")
    return path


# A — the full lockup: leaf plus wordmark, across the pot face.
place("../brand/png/logo-lockup-forest-2048.png", 0.68, 1330, 0.88, "pot-a-lockup.jpg")

# B — the leaf mark alone, larger, the way a pot usually carries a symbol.
place("../brand/png/logo-mark-forest-2048.png", 0.26, 1320, 0.85, "pot-b-mark.jpg")
