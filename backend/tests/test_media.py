import io

import pytest
from PIL import Image

from app.core.config import settings


@pytest.fixture(autouse=True)
def local_media(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "")


def photo(width=4000, height=3000, fmt="JPEG"):
    """Stand-in for a photo straight off a phone."""
    image = Image.new("RGB", (width, height))
    # Noise, so the encoder can't trivially compress it to nothing.
    for x in range(0, width, 40):
        for y in range(0, height, 40):
            image.putpixel((x, y), (x % 256, y % 256, (x + y) % 256))
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, quality=95)
    return buffer.getvalue()


def test_upload_requires_auth(client):
    response = client.post(
        "/api/v1/media", files={"file": ("x.jpg", photo(80, 80), "image/jpeg")}
    )
    assert response.status_code == 401


def test_large_photo_is_shrunk_and_converted_to_webp(client, admin_headers):
    original = photo()
    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("holiday.jpg", original, "image/jpeg")},
    )

    assert response.status_code == 201
    asset = response.json()
    assert asset["url"].endswith(".webp")
    # The whole point: what a customer downloads is far smaller than the upload.
    assert asset["size_bytes"] < len(original)


def test_oversized_dimensions_are_capped(client, admin_headers, tmp_path):
    client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("big.jpg", photo(4000, 3000), "image/jpeg")},
    )

    stored = next(tmp_path.glob("*.webp"))
    with Image.open(stored) as image:
        assert max(image.size) == settings.IMAGE_MAX_DIMENSION


def test_disallowed_content_type_is_rejected(client, admin_headers):
    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("notes.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 415


def test_a_file_that_only_claims_to_be_an_image_is_rejected(client, admin_headers):
    """Content-Type is caller-supplied, so the bytes must be checked too."""
    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("fake.jpg", b"this is not an image", "image/jpeg")},
    )
    assert response.status_code == 400


def test_upload_returns_a_preview_and_backdrop_colour(client, admin_headers):
    """The plant page shows these while the real photo loads on a slow connection."""
    image = Image.new("RGB", (600, 800), (195, 196, 201))
    image.paste((40, 110, 60), (200, 200, 400, 600))  # a "plant" in the middle
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("lily.png", buffer.getvalue(), "image/png")},
    )
    asset = response.json()

    assert asset["placeholder"].startswith("data:image/webp;base64,")
    assert len(asset["placeholder"]) < 1000
    # Taken from the edges, so it matches the backdrop rather than the plant.
    assert asset["background"] == "#c3c4c9"
    assert (asset["width"], asset["height"]) == (600, 800)


def test_uploaded_image_is_accepted_by_a_plant(client, admin_headers):
    """The upload response must slot straight into a plant without edits."""
    asset = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("x.png", photo(100, 100, "PNG"), "image/png")},
    ).json()

    response = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={
            "slug": "fern",
            "common_name": "Fern",
            "image": {k: asset[k] for k in ("url", "placeholder", "background")},
            "snap": "A fern.",
            "deep_dive": [{"title": "Care", "body": "Humid."}],
        },
    )
    assert response.status_code == 201, response.text
