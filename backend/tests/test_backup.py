"""
The Supabase backup: a whole copy or nothing, and never a change to the original.
"""

import hashlib
import importlib.util
import json
from pathlib import Path

import httpx
import pytest

from app.core.config import settings
from app.models.plant import Plant
from app.services.storage import StorageError, SupabaseStorage
from tests.test_plants import plant_data

BACKEND = Path(__file__).resolve().parent.parent
BUCKET = "https://x.supabase.co/storage/v1/object/public/plant-images/"


@pytest.fixture
def backup(monkeypatch):
    """scripts/ isn't a package, so load the script by path."""
    # The script points ENV_FILE at production on import; keep that out of the
    # environment the other tests run in.
    monkeypatch.setenv("ENV_FILE", ".env")
    spec = importlib.util.spec_from_file_location("backup_script", BACKEND / "scripts" / "backup.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def supabase(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_secret_abc123")
    return SupabaseStorage()


class FakeStorage:
    """A bucket held in memory, shaped like SupabaseStorage as the backup uses it."""

    base = "https://x.supabase.co"
    bucket = "plant-images"

    def __init__(self, files: dict[str, bytes], sizes: dict[str, int] | None = None):
        self.files = files
        self.sizes = sizes or {name: len(data) for name, data in files.items()}

    def list_objects(self):
        return dict(self.sizes)

    def download(self, name):
        return self.files[name]


def add_plant(db_session, **overrides):
    db_session.add(Plant(**plant_data(**overrides)))
    db_session.commit()


# ---- the database ----


def test_every_table_is_written_even_when_empty(backup, db_session, tmp_path):
    add_plant(db_session)

    tables = backup.dump_database(db_session.get_bind(), tmp_path / "database")

    assert {"plants", "plant_views", "retired_slugs", "login_attempts"} <= set(tables)
    assert json.loads((tmp_path / "database" / "retired_slugs.json").read_text()) == []

    rows = json.loads((tmp_path / "database" / "plants.json").read_text())
    assert [row["slug"] for row in rows] == ["peace-lily"]
    assert rows[0]["image"]["alt"] == "A peace lily in a white pot"
    # Dates have no JSON form of their own; they come out as text.
    assert isinstance(rows[0]["created_at"], str)


def test_a_value_it_cannot_write_is_an_error_not_a_guess(backup):
    with pytest.raises(TypeError):
        backup._jsonable(b"bytes")


# ---- the photos ----


def test_photos_are_copied_with_a_checksum(backup, tmp_path):
    storage = FakeStorage({"a.webp": b"first", "b.webp": b"second"})

    copied = backup.copy_images(storage, tmp_path / "images")

    assert (tmp_path / "images" / "a.webp").read_bytes() == b"first"
    assert copied[0] == {
        "name": "a.webp",
        "bytes": 5,
        "sha256": hashlib.sha256(b"first").hexdigest(),
    }


def test_a_photo_that_arrives_short_fails_the_backup(backup, tmp_path):
    storage = FakeStorage({"a.webp": b"abc"}, sizes={"a.webp": 3000})

    with pytest.raises(StorageError, match="expected 3000"):
        backup.copy_images(storage, tmp_path / "images")


@pytest.mark.parametrize("name", ["../escape.webp", "/etc/passwd", "ok/../../escape.webp"])
def test_an_object_cannot_write_outside_the_backup(backup, tmp_path, name):
    storage = FakeStorage({name: b"x"})

    with pytest.raises(StorageError, match="Refusing"):
        backup.copy_images(storage, tmp_path / "images")

    assert not (tmp_path / "escape.webp").exists()


def test_photos_the_backup_lacks_are_reported(backup):
    plants = [
        {"slug": "held", "image": {"url": f"{BUCKET}a.webp"}},
        {"slug": "gone", "image": {"url": f"{BUCKET}missing.webp"}},
        {"slug": "pasted", "image": {"url": "https://example.com/p.jpg"}},
        {"slug": "none", "image": {"url": ""}},
    ]

    problems = backup.photo_problems(plants, {"a.webp"}, BUCKET)

    assert len(problems) == 2
    assert problems[0].startswith("gone: photo is not in the bucket")
    assert problems[1].startswith("pasted: photo is hosted elsewhere")


# ---- the whole run ----


def test_a_run_leaves_one_finished_folder(backup, db_session, tmp_path):
    add_plant(db_session, image={**plant_data()["image"], "url": f"{BUCKET}a.webp"})
    storage = FakeStorage({"a.webp": b"photo"})

    final = backup.run(db_session.get_bind(), storage, tmp_path)

    assert [path.name for path in tmp_path.iterdir()] == [final.name]
    manifest = json.loads((final / "manifest.json").read_text())
    assert manifest["tables"]["plants"] == 1
    assert manifest["images"][0]["name"] == "a.webp"
    assert manifest["warnings"] == []
    assert (final / "images" / "a.webp").read_bytes() == b"photo"
    assert (final / "database" / "plants.json").exists()


def test_a_failed_run_leaves_nothing_behind(backup, db_session, tmp_path):
    storage = FakeStorage({"a.webp": b"abc"}, sizes={"a.webp": 1})

    with pytest.raises(StorageError):
        backup.run(db_session.get_bind(), storage, tmp_path)

    assert list(tmp_path.iterdir()) == []


# ---- Supabase Storage, as the backup uses it ----


def listing(*entries):
    return httpx.Response(200, json=list(entries))


def obj(name, size):
    return {"name": name, "id": f"id-{name}", "metadata": {"size": size}}


def test_listing_asks_for_every_page(supabase, monkeypatch):
    monkeypatch.setattr("app.services.storage._LIST_PAGE", 2)
    pages = {
        0: [obj("a.webp", 1), obj("b.webp", 2)],
        2: [obj("c.webp", 3)],
    }
    asked = []

    def post(url, json, headers, timeout):
        asked.append(json["offset"])
        assert url == "https://x.supabase.co/storage/v1/object/list/plant-images"
        assert headers["apikey"] == "sb_secret_abc123"
        return listing(*pages[json["offset"]])

    monkeypatch.setattr(httpx, "post", post)

    assert supabase.list_objects() == {"a.webp": 1, "b.webp": 2, "c.webp": 3}
    assert asked == [0, 2]


def test_listing_follows_folders(supabase, monkeypatch):
    def post(url, json, headers, timeout):
        if json["prefix"] == "":
            return listing(obj("a.webp", 1), {"name": "old", "id": None})
        assert json["prefix"] == "old/"
        return listing(obj("b.webp", 2))

    monkeypatch.setattr(httpx, "post", post)

    assert supabase.list_objects() == {"a.webp": 1, "old/b.webp": 2}


def test_a_refused_listing_says_why(supabase, monkeypatch):
    monkeypatch.setattr(
        httpx, "post", lambda *a, **k: httpx.Response(403, text="not allowed")
    )

    with pytest.raises(StorageError, match="403"):
        supabase.list_objects()


def test_download_returns_the_bytes(supabase, monkeypatch):
    seen = {}

    def get(url, headers, timeout):
        seen.update(url=url, headers=headers)
        return httpx.Response(200, content=b"photo")

    monkeypatch.setattr(httpx, "get", get)

    assert supabase.download("old/a b.webp") == b"photo"
    assert seen["url"] == "https://x.supabase.co/storage/v1/object/plant-images/old/a%20b.webp"
    assert seen["headers"] == {"apikey": "sb_secret_abc123"}


def test_download_of_a_missing_object_is_an_error(supabase, monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: httpx.Response(404, text="gone"))

    with pytest.raises(StorageError, match="404"):
        supabase.download("a.webp")


def test_the_backup_refuses_a_publishable_key(supabase, monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_publishable_abc")

    with pytest.raises(StorageError, match="publishable"):
        SupabaseStorage().list_objects()
