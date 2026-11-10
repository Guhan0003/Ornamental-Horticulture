"""
Push a seed file's words to a plant that already exists.

    python scripts/retext.py philodendron-micans      # show what would change
    python scripts/retext.py philodendron-micans --apply
    python scripts/retext.py --all --apply

seed.py only ever adds: a slug already in the database is skipped, so running
it twice is harmless but it cannot correct anything. This is the other half —
it takes the text from seed/<slug>.json and writes it over the plant that is
already there.

Only the words move. The photo, the gallery, the price and the availability are
left exactly as they are, so nothing is re-uploaded, no stored object is
orphaned, and a price changed in the dashboard is not quietly rolled back to
whatever the seed file last said. The cover photo's alt text does come from the
seed file, since that is words about the photo rather than the photo itself.

Nothing is written without --apply.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.models.plant import Plant  # noqa: E402
from app.schemas.plant import PlantUpdate  # noqa: E402

SEED_DIR = ROOT / "seed"

# What a seed file is allowed to overwrite. Everything outside this list
# belongs to whoever last touched the dashboard.
WORDS = ("common_name", "scientific_name", "profile", "snap", "deep_dive")


def short(value: object, width: int = 220) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= width else text[: width - 1] + "…"


def retext(db, slug: str, apply: bool) -> bool:
    """True when the plant differs from its seed file."""
    path = SEED_DIR / f"{slug}.json"
    if not path.exists():
        print(f"skip   {slug} (no seed file)")
        return False

    plant = db.query(Plant).filter_by(slug=slug).first()
    if plant is None:
        print(f"skip   {slug} (not in the database — seed.py adds it)")
        return False

    raw = json.loads(path.read_text())
    patch = {field: raw[field] for field in WORDS if field in raw}
    # Keep the live photo; take only its alt text from the seed file.
    patch["image"] = {**plant.image, "alt": raw["image"]["alt"]}

    # The same validation the dashboard goes through. Dumping the whole model
    # and then picking out the fields we sent fills in the defaults inside the
    # profile — a seed file that leaves out an empty `note` should not strip
    # that key off the stored row and call it a change.
    dumped = PlantUpdate.model_validate(patch).model_dump()
    clean = {field: dumped[field] for field in patch}
    changes = {f: v for f, v in clean.items() if getattr(plant, f) != v}

    if not changes:
        print(f"same   {slug}")
        return False

    print(f"{'write ' if apply else 'would '} {slug}: {', '.join(sorted(changes))}")
    for field, value in sorted(changes.items()):
        print(f"         was {short(getattr(plant, field))}")
        print(f"         now {short(value)}")
        if apply:
            setattr(plant, field, value)

    if apply:
        db.commit()
    return True


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--apply"]
    apply = "--apply" in sys.argv

    if args == ["--all"]:
        slugs = sorted(p.stem for p in SEED_DIR.glob("*.json"))
    elif args and not args[0].startswith("-"):
        slugs = args
    else:
        print(__doc__)
        return 2

    db = SessionLocal()
    try:
        changed = sum(retext(db, slug, apply) for slug in slugs)
    finally:
        db.close()

    print(f"\n{changed} of {len(slugs)} differ")
    if changed and not apply:
        print("nothing written; pass --apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
