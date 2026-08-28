# Ornamental Horticulture

**by StomatalWorld**

A Wikipedia-style reference page for ornamental plants. Every plant in the store carries a
QR code — scan it and land straight on that plant's page.

See [PROJECT_STATEMENT.md](PROJECT_STATEMENT.md) for the full problem statement and roadmap.

## Repository layout

```
frontend/    React 19 + Vite 7 + React Router  →  deployed to Vercel
backend/     FastAPI + SQLAlchemy              →  deployed separately
```

Each folder has its own README with setup instructions.

## Quick start

Two terminals.

```bash
# terminal 1 — backend on :8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

```bash
# terminal 2 — frontend on :5173
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## How it fits together

| | |
|---|---|
| `/` | Landing page |
| `/plant/:slug` | The QR-code target — one plant, one permanent URL |
| `GET /api/v1/plants/:slug` | Returns the plant plus its ordered content blocks in one request |
| `/docs` (backend) | Interactive API documentation |

**Plant slugs are permanent.** Once a QR label is printed and stuck on a shelf it cannot be
changed, so slugs must never be reused or repointed at a different plant. The API deliberately
does not expose slug editing.

## The dynamic page format

A plant page is **not** a fixed template. It is an ordered list of **blocks** composed in the
admin panel — heading, text, image, gallery, facts. Each block carries its content in a JSON
column, so editors can restructure a page without a migration, and new section types cost one
React component plus one registry entry.

Backend: `backend/app/models/block.py`
Frontend: `frontend/src/components/blocks/BlockRenderer.jsx`

## Deploying

**Frontend** — Vercel, with **Root Directory set to `frontend`**. Set `VITE_API_URL` to the
deployed backend URL in the Vercel project's environment variables.

**Backend** — any container host (Render, Railway, Fly). Before launch:
switch to Alembic migrations, move uploads off local disk to S3/Cloudinary,
and set a real `SECRET_KEY`.
