# Backend — Ornamental Horticulture

FastAPI + SQLAlchemy. Serves the public plant pages and the admin content API.

## Running

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

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
├── db/
│   ├── base.py           declarative base
│   └── session.py        engine and get_db dependency
├── models/               SQLAlchemy tables
│   ├── user.py           admin/editor accounts
│   ├── category.py       the folder tree (Plants, Trees, ...)
│   ├── plant.py          one plant = one QR code = one URL
│   ├── block.py          the dynamic page format
│   └── media.py          uploaded images
├── schemas/              Pydantic request/response models
├── api/
│   ├── deps.py           db session, current user, admin guard
│   └── v1/
│       ├── router.py
│       └── endpoints/
│           ├── auth.py         login, me
│           ├── plants.py       public reads + admin CRUD
│           ├── categories.py
│           ├── blocks.py       add/edit/delete/reorder
│           └── media.py        image upload
└── services/             business logic as it grows
```

## The dynamic page format

`ContentBlock` is the key design decision. A plant page is an **ordered list of
blocks**, not a fixed template. Each block has a `type` and a JSON `data` column,
so editors can restructure a page — and we can add new section types — without a
database migration.

The frontend's `BlockRenderer` maps each `type` to a component. Adding a new kind
of section costs one component plus one registry entry.

## Notes before launch

- `Base.metadata.create_all()` in `main.py` is a development shortcut. Switch to
  Alembic migrations before production.
- Uploaded images go to Supabase Storage when `SUPABASE_URL` and
  `SUPABASE_SERVICE_KEY` are set, and to local disk otherwise. Local disk is
  development only — most hosts wipe the container filesystem on redeploy.
- `SECRET_KEY` must be overridden in production. With `ENVIRONMENT=production` the
  app refuses to start on a default or short key rather than signing tokens with
  something readable in the source. Rotating it logs everyone out.
- Plant `slug` is deliberately not editable via the API — printed QR labels
  depend on it never changing.


## Production setup (Supabase)

**Database.** Supabase dashboard → Project Settings → Database → Connection string →
URI. Change the scheme to `postgresql+psycopg://` and set it as `DATABASE_URL`.

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
