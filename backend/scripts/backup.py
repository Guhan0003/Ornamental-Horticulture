"""
Copy everything in Supabase to this computer.

    python scripts/backup.py

Each run makes a new folder under backups/, named for the moment it ran:

    backups/2026-11-09_153012/
        manifest.json    when, from where, how much, and a checksum per photo
        database/        one JSON file per table, every row
        images/          every file in the storage bucket, under its own name

The settings come from .env.production; ENV_FILE=... picks another file.

Nothing in Supabase is changed: the database is read in a read-only
transaction and photos are only downloaded. A run that fails part-way leaves
no half-finished folder behind, so every folder in backups/ is a whole copy.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Settings are read the moment the app is imported, so choose the file first.
# The default is production: that is the data worth a backup.
os.environ.setdefault("ENV_FILE", str(ROOT / ".env.production"))

from sqlalchemy import MetaData, select  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.services.storage import StorageError, SupabaseStorage  # noqa: E402


def _jsonable(value):
    # Fails on anything it doesn't know rather than guessing: a backup that
    # quietly changed a value on the way out would be worse than none.
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    raise TypeError(f"Can't write a {type(value).__name__} to JSON")


def write_json(path: Path, data) -> None:
    text = json.dumps(data, indent=2, ensure_ascii=False, default=_jsonable)
    path.write_text(text + "\n", encoding="utf-8")


def dump_database(engine: Engine, target: Path) -> dict[str, list[dict]]:
    """Write every table in the public schema to target/<table>.json."""
    target.mkdir()
    tables: dict[str, list[dict]] = {}

    # Read-only for the whole run, so a mistake here can't change what it copies.
    with engine.connect().execution_options(postgresql_readonly=True) as connection:
        metadata = MetaData()
        # Reflected rather than listed, so a table added by a later migration
        # is backed up without anyone remembering to edit this file.
        metadata.reflect(bind=connection)

        for table in sorted(metadata.tables.values(), key=lambda t: t.name):
            # Primary-key order, so two backups of the same data are identical.
            query = select(table).order_by(*table.primary_key.columns)
            rows = [dict(row) for row in connection.execute(query).mappings()]
            write_json(target / f"{table.name}.json", rows)
            tables[table.name] = rows
            print(f"  {table.name:<16}{len(rows):>6} rows")

    return tables


def copy_images(storage: SupabaseStorage, target: Path) -> list[dict]:
    """Download every object in the bucket into target/, keeping its name."""
    target.mkdir()
    copied = []

    for name, size in sorted(storage.list_objects().items()):
        # Object names are whatever was uploaded, so keep one from stepping
        # outside the folder it is being copied into.
        if Path(name).is_absolute() or ".." in Path(name).parts:
            raise StorageError(f"Refusing to copy an object named {name!r}")

        data = storage.download(name)
        if size is not None and len(data) != size:
            raise StorageError(f"{name} came down as {len(data)} bytes, expected {size}")

        path = target / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        copied.append(
            {"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        )

    megabytes = sum(image["bytes"] for image in copied) / 1_000_000
    print(f"  {'images':<16}{len(copied):>6} files, {megabytes:.1f} MB")
    return copied


def photo_problems(plants: list[dict], names: set[str], prefix: str) -> list[str]:
    """Plants whose photo this backup does not hold."""
    problems = []
    for plant in plants:
        url = (plant.get("image") or {}).get("url", "")
        if not url:
            continue
        if not url.startswith(prefix):
            problems.append(f"{plant['slug']}: photo is hosted elsewhere, not copied ({url})")
        elif url[len(prefix) :] not in names:
            problems.append(f"{plant['slug']}: photo is not in the bucket ({url})")
    return problems


def run(engine: Engine, storage: SupabaseStorage, out_root: Path) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    final = out_root / stamp
    # Built under another name and renamed at the end, so a folder only has
    # its final name once it is complete.
    partial = out_root / f".{stamp}.partial"
    partial.mkdir(parents=True)

    try:
        tables = dump_database(engine, partial / "database")
        images = copy_images(storage, partial / "images")

        public_prefix = f"{storage.base}/storage/v1/object/public/{storage.bucket}/"
        warnings = photo_problems(
            tables.get("plants", []), {image["name"] for image in images}, public_prefix
        )
        for warning in warnings:
            print(f"  warning: {warning}")

        write_json(
            partial / "manifest.json",
            {
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "database": engine.url.render_as_string(hide_password=True),
                "storage": f"{storage.base} ({storage.bucket})",
                "tables": {name: len(rows) for name, rows in tables.items()},
                "images": images,
                "warnings": warnings,
            },
        )
        partial.rename(final)
    except BaseException:
        shutil.rmtree(partial, ignore_errors=True)
        raise

    return final


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy the Supabase database and photos to this computer."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "backups",
        help="folder to put the backup in (default: backups/)",
    )
    args = parser.parse_args()

    env_file = os.environ["ENV_FILE"]
    if not Path(env_file).exists():
        print(f"{env_file} not found. It holds the Supabase settings; see DEPLOY.md.")
        return 1

    if not settings.uses_supabase_storage:
        print(f"SUPABASE_URL and SUPABASE_SERVICE_KEY are not set in {env_file}.")
        return 1

    storage = SupabaseStorage()
    print(f"Backing up {engine.url.render_as_string(hide_password=True)}")
    print(f"       and {storage.base} ({storage.bucket})")

    try:
        final = run(engine, storage, args.out)
    except (StorageError, SQLAlchemyError, OSError) as exc:
        print(f"Backup failed: {exc}", file=sys.stderr)
        return 1

    print(f"Saved to {final}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
