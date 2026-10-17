"""
Photos are left behind when a plant is edited or deleted, unless something
clears them up. Storage is billed by the gigabyte and nothing else reads it.
"""

import httpx
import pytest

from app.core.config import settings
from app.services import photos
from app.services.storage import LocalStorage, StorageError, SupabaseStorage
from tests.test_plants import plant_data

BUCKET = "https://example.supabase.co/storage/v1/object/public/plant-images/"


@pytest.fixture
def plant(client, admin_headers):
    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data())
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def deleted(monkeypatch):
    """Record what storage was asked to delete, without touching a disk."""
    seen = []

    class Recorder:
        def delete(self, url):
            seen.append(url)

    monkeypatch.setattr(photos, "get_storage", Recorder)
    return seen


def test_deleting_a_plant_discards_its_photo(client, admin_headers, plant, deleted):
    client.delete(f"/api/v1/plants/{plant['slug']}", headers=admin_headers)
    assert deleted == [plant["image"]["url"]]


def test_replacing_a_photo_discards_the_old_one(client, admin_headers, plant, deleted):
    response = client.patch(
        f"/api/v1/plants/{plant['slug']}",
        headers=admin_headers,
        json={"image": {**plant["image"], "url": f"{BUCKET}new.webp"}},
    )
    assert response.status_code == 200
    assert deleted == [plant["image"]["url"]]


def test_editing_something_else_keeps_the_photo(client, admin_headers, plant, deleted):
    client.patch(
        f"/api/v1/plants/{plant['slug']}",
        headers=admin_headers,
        json={"common_name": "Renamed"},
    )
    assert deleted == []


def test_a_photo_another_plant_still_shows_is_kept(client, admin_headers, plant, deleted):
    """Two plants can point at one photo, so the last one out turns the light off."""
    shared = plant["image"]["url"]
    second = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json=plant_data(slug="zz-plant", common_name="ZZ Plant"),
    )
    assert second.status_code == 201

    client.delete(f"/api/v1/plants/{plant['slug']}", headers=admin_headers)
    assert deleted == []

    client.delete("/api/v1/plants/zz-plant", headers=admin_headers)
    assert deleted == [shared]


def test_storage_trouble_does_not_fail_the_delete(client, admin_headers, plant, monkeypatch):
    """The plant really was deleted; a stranded file is the lesser problem."""

    class Broken:
        def delete(self, url):
            raise StorageError("Supabase is having a day")

    monkeypatch.setattr(photos, "get_storage", Broken)

    response = client.delete(f"/api/v1/plants/{plant['slug']}", headers=admin_headers)
    assert response.status_code == 204
    assert client.get(f"/api/v1/plants/{plant['slug']}").status_code == 404


# --------------------------------------------------- what counts as ours

NAME = "0123456789abcdef0123456789abcdef.webp"


@pytest.fixture
def supabase(monkeypatch):
    """A Supabase storage whose DELETE calls are recorded, not sent."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_secret_abc123")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET", "plant-images")

    sent = []

    def record(url, headers, timeout, status=200):
        sent.append(url)
        return httpx.Response(status)

    monkeypatch.setattr(httpx, "delete", record)
    return SupabaseStorage(), sent


@pytest.mark.parametrize(
    "url",
    [
        "https://someone-elses-site.example/photo.webp",
        f"https://example.supabase.co/storage/v1/object/public/other-bucket/{NAME}",
        f"{BUCKET}../../secret.webp",
        f"{BUCKET}..%2F..%2Fsecret.webp",
        f"{BUCKET}nested/path.webp",
        f"{BUCKET}not-a-uuid.webp",
        BUCKET,
        "",
    ],
)
def test_a_url_we_did_not_store_is_never_deleted(url, supabase, monkeypatch, tmp_path):
    """An admin can paste any address into the photo field; we touch only ours."""
    storage, sent = supabase
    storage.delete(url)
    assert sent == []

    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    LocalStorage().delete(url)


def test_a_photo_we_stored_is_deleted_from_its_bucket(supabase):
    storage, sent = supabase
    storage.delete(f"{BUCKET}{NAME}")
    assert sent == [f"https://example.supabase.co/storage/v1/object/plant-images/{NAME}"]


def test_a_refused_delete_is_reported(monkeypatch):
    """Otherwise a photo that was never removed looks like one that was."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_secret_abc123")
    monkeypatch.setattr(
        httpx, "delete", lambda *a, **k: httpx.Response(403, text="row-level security")
    )

    with pytest.raises(StorageError, match="403"):
        SupabaseStorage().delete(f"{BUCKET}{NAME}")


def test_an_already_missing_photo_is_not_an_error(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_secret_abc123")
    monkeypatch.setattr(httpx, "delete", lambda *a, **k: httpx.Response(404))

    SupabaseStorage().delete(f"{BUCKET}{NAME}")


def test_local_storage_deletes_a_file_it_saved(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    storage = LocalStorage()

    url = storage.save(b"not-really-a-photo", ".webp", "image/webp")
    name = url.rsplit("/", 1)[-1]
    assert (tmp_path / name).exists()

    storage.delete(url)
    assert not (tmp_path / name).exists()

    # Deleting twice is not an error: the file is already gone.
    storage.delete(url)
