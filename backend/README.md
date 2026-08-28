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
- Uploaded images go to local disk. Most hosts give containers an ephemeral
  filesystem, so move media to S3 or Cloudinary before launch.
- `SECRET_KEY` must be overridden in production. Rotating it logs everyone out.
- Plant `slug` is deliberately not editable via the API — printed QR labels
  depend on it never changing.
