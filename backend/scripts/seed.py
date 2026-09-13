"""
Load the plants in seed/ into the database.

    python scripts/seed.py

Each seed/<slug>.json is one plant, with `image.file` naming a photo beside it.
The photo goes through the same optimisation and storage as an admin upload,
so it lands in Supabase Storage when that is configured and on local disk
otherwise. Plants whose address is already taken, or retired, are skipped, so
running this twice is harmless.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.models.plant import Plant, RetiredSlug  # noqa: E402
from app.schemas.plant import PlantCreate  # noqa: E402
from app.services.images import optimize  # noqa: E402
from app.services.storage import get_storage  # noqa: E402

SEED_DIR = ROOT / "seed"


def main() -> int:
    db = SessionLocal()
    try:
        for path in sorted(SEED_DIR.glob("*.json")):
            raw = json.loads(path.read_text())
            slug = raw["slug"]

            if db.query(Plant).filter_by(slug=slug).first() or db.get(RetiredSlug, slug):
                print(f"skip   {slug} (address already used)")
                continue

            image = optimize((SEED_DIR / raw["image"].pop("file")).read_bytes())
            url = get_storage().save(image.data, image.extension, image.content_type)
            raw["image"].update(
                url=url, placeholder=image.placeholder, background=image.background
            )

            # Same validation as the admin dashboard.
            plant = PlantCreate.model_validate(raw)
            db.add(Plant(**plant.model_dump()))
            db.commit()
            print(f"added  {slug} -> {url}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
