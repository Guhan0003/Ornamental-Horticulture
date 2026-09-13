# Backend — Ornamental Horticulture

FastAPI + SQLAlchemy. Serves the public plant pages and the admin dashboard's API.

## Running

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set ADMIN_EMAIL and ADMIN_PASSWORD
alembic upgrade head          # create or update the database tables
python scripts/seed.py        # add the Peace Lily (skipped if it's already there)
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Run all commands from inside `backend/`: the app reads `.env` and the SQLite file from the
current directory.

## The API

| | |
|---|---|
| `GET /api/v1/plants` | Every plant, A–Z, as a summary (name, photo, address). Public. |
| `GET /api/v1/plants/{slug}` | One plant, with everything its page needs. Public. |
| `POST /api/v1/plants` | Add a plant. Admin. |
| `PATCH /api/v1/plants/{slug}` | Edit a plant; omitted fields are left alone. The slug can't change. Admin. |
| `DELETE /api/v1/plants/{slug}` | Delete a plant and retire its address for good. Admin. |
| `POST /api/v1/media` | Upload a photo; returns its URL, a blurred preview and a backdrop colour. Admin. |
| `POST /api/v1/auth/login` · `GET /api/v1/auth/me` | The single admin login. |

## A plant

One row in `plants`, shaped like the page. The nested parts are JSON columns whose shape
is enforced by the Pydantic schemas in `app/schemas/plant.py`:

```jsonc
{
  "slug": "peace-lily",                       // permanent address, set once
  "common_name": "Peace Lily",                // required
  "scientific_name": "Spathiphyllum wallisii",
  "image": { "url": "…", "alt": "…", "placeholder": "data:image/webp;base64,…", "background": "#bebfc4" },
  "profile": {                                // every part optional
    "environment": "Indoor",
    "light": { "label": "…", "note": "…", "ideal": [1, 2], "tolerates": [0] },
    "landscape_use": { "items": ["…"], "note": "…" },
    "home_use": { "items": ["…"], "note": "…" }
  },
  "snap": "…",                                // required
  "deep_dive": [ { "icon": "paw", "title": "Pet Safety", "body": "…" } ]  // 1–12 points
}
```

Light levels index the scale Low (0), Medium (1), Bright indirect (2), Direct sun (3).
Deep Dive icons: `origin`, `water`, `sun`, `sparkle`, `paw`, `pot`, `landscape`, `home`.

`seed/peace-lily.json` is a complete example.

**Addresses are permanent.** A slug can't be edited, can't be `admin`, `api` or `assets`
(plant pages live at the top level of the site), and when a plant is deleted its slug goes
into `retired_slugs` so no other plant can ever take it — an old QR label may still point
there.

## The admin login

There is **no signup and no users table** — a single login, configured by environment
variable. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.

For anything deployed, generate a hash instead so no readable password sits in your
hosting dashboard:

```bash
python scripts/hash_password.py
```

Paste the result as `ADMIN_PASSWORD_HASH` and leave `ADMIN_PASSWORD` empty — the hash
takes precedence when both are set.

## Database migrations

The schema is managed by Alembic, in `migrations/`. After changing a model:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Migration `0001` replaced the earlier block-based page builder. Any tables from that
version (`plants`, `content_blocks`, `categories`, `media_assets`) are **renamed to
`legacy_*`, not dropped**, so nothing is lost. Delete them by hand once you're sure they
aren't needed.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

Each test runs against a fresh in-memory database, so they are isolated and fast.

## Structure

```
app/
├── main.py               app setup, CORS, static media, health
├── core/
│   ├── config.py         settings from environment
│   └── security.py       password hashing + JWT
├── db/                   declarative base, engine, get_db
├── models/plant.py       Plant and RetiredSlug
├── schemas/              request/response shapes and validation
├── api/v1/endpoints/
│   ├── auth.py           login, me
│   ├── plants.py         public reads, admin add/edit/delete
│   └── media.py          photo upload
└── services/
    ├── images.py         resize, WebP, blurred preview, backdrop colour
    └── storage.py        Supabase Storage, or local disk in development
migrations/               Alembic
scripts/
├── seed.py               load seed/*.json
└── hash_password.py      make ADMIN_PASSWORD_HASH
seed/                     starter plants
```

## Notes before launch

- Uploaded images go to Supabase Storage when `SUPABASE_URL` and
  `SUPABASE_SERVICE_KEY` are set, and to local disk otherwise. Local disk is
  development only — most hosts wipe the container filesystem on redeploy.
- `SECRET_KEY` must be overridden in production. With `ENVIRONMENT=production` the
  app refuses to start on a default or short key rather than signing tokens with
  something readable in the source. Rotating it logs everyone out.

## Production setup (Supabase)

**Database.** Supabase dashboard → Connect → Session pooler connection string. Change the
scheme to `postgresql+psycopg://` and set it as `DATABASE_URL`, then run
`alembic upgrade head` and `python scripts/seed.py` against it once.

**Image storage.** Storage → New bucket → name it `plant-images` and mark it
**public** (the app returns public URLs). Then Project Settings → API for
`SUPABASE_URL` and the `service_role` key as `SUPABASE_SERVICE_KEY`.

The service_role key bypasses row-level security. It belongs on the server only —
never in the frontend or in a committed file.

## Image handling

Uploads are resized to fit `IMAGE_MAX_DIMENSION` and re-encoded to WebP before being
stored. A 7.5MB phone photo comes out around 64KB. This is not polish: the whole
product is someone standing in a shop on bad Wi-Fi, and an unoptimised photo is the
fastest way to lose them. EXIF rotation is applied first, then metadata is dropped —
which also removes any GPS location from the original.

The upload also returns a ~20px blurred preview (a few hundred bytes, shown while the
photo loads) and a backdrop colour averaged from the photo's edges, so the page around
the photo matches it.
