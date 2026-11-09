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
  "image": { "url": "…", "alt": "…", "placeholder": "data:image/webp;base64,…", "background": "#bebfc4" },  // the cover: the thumbnail everywhere
  "gallery": [ { "url": "…", "alt": "…", "placeholder": "…", "background": "…" } ],  // more photos, in swiping order, up to 11
  "profile": {                                // every part optional
    "environment": "Indoor",
    "light": { "label": "…", "note": "…", "ideal": [1, 2], "tolerates": [0] },
    "landscape_use": { "items": ["…"], "note": "…" },
    "home_use": { "items": ["…"], "note": "…" }
  },
  "snap": "…",                                // required
  "deep_dive": [ { "icon": "paw", "title": "Pet Safety", "body": "…" } ],  // 1–12 points
  "price_minor": 39900,                       // paise, so ₹399; null = ask for the price
  "original_price_minor": 49900,              // optional; must be above the price
  "price_note": "with white decor pot",
  "availability": "in_stock",                 // in_stock | ask | sold_out
  "currency": "INR"                           // read-only for now
}
```

Money is a whole number of paise, never a float. Send `price_minor: null` in a
`PATCH` to take a price away; a patch that would leave the original price at or
below the price is refused with a `422`. The list endpoint carries the price fields
too, because the home page shows them without a second request.

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

### Guessing the password

One password guards the whole dashboard, so the login endpoint counts failures per
client: **5 wrong guesses and that client waits 15 minutes**, with a `429` and a
`Retry-After` header. The lock refuses the correct password too, so it can't be used
to tell a guesser when they have found it. A successful sign-in clears the count, and
a client that goes quiet for the same 15 minutes is forgotten.

| Setting | Default | |
|---|---|---|
| `LOGIN_MAX_FAILURES` | `5` | wrong guesses before the lock |
| `LOGIN_LOCKOUT_MINUTES` | `15` | how long the lock lasts, and how long a failure is remembered |
| `TRUST_PROXY_HEADERS` | on Vercel | read the client's address from `X-Forwarded-For` |

Counts live in `login_attempts` rather than in memory because the API runs as serverless
functions: a process-local counter would reset whenever a new instance answered the
request. `TRUST_PROXY_HEADERS` matters for the same reason — the real address only
arrives in a header behind Vercel, but a forged header anywhere else would hand a
guesser a fresh allowance per request, so it is off unless a proxy is known to be in
front. It defaults on when `VERCEL` is set.

### What the API gives away

The interactive docs map the whole admin API, so `/docs`, `/redoc` and
`/openapi.json` are **development-only** — with `ENVIRONMENT=production` they
return 404. Every response also carries `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`.

`CORS_ORIGINS` lists the sites allowed to call the API, and
`CORS_ORIGIN_REGEX` matches preview deployments, whose hostname changes every
push. Both are environment variables, so a custom domain needs no code change.

## Photos clean up after themselves

Every upload is a new object in storage, so replacing a plant's photo or
deleting the plant would otherwise strand the old file forever.
`services/photos.py` deletes it — but only after checking no other plant still
shows it, and only when the URL is one we stored, since the photo field accepts
any address an admin pastes. Storage trouble is logged, never raised: the
plant really was deleted, and a stranded file is the smaller problem.

That covers the whole gallery, not just the cover: taking a photo out of a plant, or
deleting the plant, clears every photo no plant shows any more. A photo that only
moved — made the cover, say, with the old cover joining the gallery — is still shown
and stays.

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

Migration `0002` adds `login_attempts`, which holds the failed-login counts.

Migration `0004` adds the price columns **and moves data**: a Deep Dive point titled
like `Price-399/- with white decor pot` becomes `price_minor=39900` and
`price_note="with white decor pot"`, and the point is removed from the page. Anything
the point's body said besides "." is kept in the note, and a title that doesn't read
as a price is left alone and named in the output. Downgrading puts each price back as
a Deep Dive point. Take a backup first (`python scripts/backup.py`) and run it before
deploying the code that reads the new columns.

Migration `0005` adds `plants.gallery` (more photos after the cover) with an empty list
for every plant that exists, so the site looks the same until someone adds a second photo.
It only adds a column, so the old code keeps working against it: run it before deploying
the code that reads it.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

Each test runs against a fresh in-memory database, so they are isolated and fast.

## Structure

```
app/
├── main.py               create_app: CORS, security headers, media, health
├── core/
│   ├── config.py         settings from environment
│   └── security.py       password hashing + JWT
├── db/                   declarative base, engine, get_db
├── models/
│   ├── plant.py          Plant and RetiredSlug
│   └── login_attempt.py  failed-login counts, per client
├── schemas/              request/response shapes and validation
├── api/v1/endpoints/
│   ├── auth.py           login, me
│   ├── plants.py         public reads, admin add/edit/delete
│   └── media.py          photo upload
└── services/
    ├── images.py         resize, WebP, blurred preview, backdrop colour
    ├── login_guard.py    failed-login lockout
    ├── photos.py         delete a photo nothing points at any more
    └── storage.py        Supabase Storage (upload, delete, list, download), or local disk in development
migrations/               Alembic
scripts/
├── seed.py               load seed/*.json
├── backup.py             copy the Supabase database and photos to backups/
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

## Backing up Supabase

```bash
python scripts/backup.py
```

Copies the production database and every photo to this computer. Each run makes a new
folder under `backups/` (gitignored), named for when it ran:

```
backups/2026-11-09_153012/
├── manifest.json     when, from where, row counts, and a checksum per photo
├── database/         one JSON file per table, every row
└── images/           every file in the plant-images bucket, under its own name
```

It reads the settings in `.env.production` (`ENV_FILE=… python scripts/backup.py` picks
another file) and changes nothing in Supabase: the database is read in a read-only
transaction and photos are only downloaded. A run that fails part-way removes its
half-finished folder, so every folder in `backups/` is a whole copy. Any plant whose photo
the backup could not hold — missing from the bucket, or pasted in from another website —
is listed as a warning, and in `manifest.json`.

`--out DIR` puts the backup somewhere else, such as a synced or external drive. Old
backups are never deleted; remove the folders you don't want.

The free Supabase plan pauses a project after a week with no activity, so a backup is
worth taking before that happens.

## Image handling

Uploads are resized to fit `IMAGE_MAX_DIMENSION` and re-encoded to WebP before being
stored. A 7.5MB phone photo comes out around 64KB. This is not polish: the whole
product is someone standing in a shop on bad Wi-Fi, and an unoptimised photo is the
fastest way to lose them. EXIF rotation is applied first, then metadata is dropped —
which also removes any GPS location from the original.

The upload also returns a ~20px blurred preview (a few hundred bytes, shown while the
photo loads) and a backdrop colour averaged from the photo's edges, so the page around
the photo matches it.
