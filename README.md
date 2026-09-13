# Ornamental Horticulture

**by StomatalWorld**

A Wikipedia-style website for ornamental plants: one simple page per plant, and a private
admin dashboard to manage them.

---

## The core idea

Every plant gets **one page at a short, permanent address**:

```
https://<our-domain>/peace-lily
```

That page shows, for that plant, in this order:

| Section | What it holds |
|---|---|
| **Photo** | one photo of the plant |
| **Identity** | common name and scientific name |
| **Quick Profile** | environment, light need, landscape use, home use |
| **The Snap** | one or two sentences: the plant at a glance |
| **The Deep Dive** | titled points: origin & habit, key care rule, special feature, pet safety |

The home page has a **search bar** at the top: tap it to see each plant as a small photo
and its name, type to narrow the list, and tap a plant to open its page. Beyond that
there are no categories, no accounts and nothing to browse.

Later, every plant gets a **QR code** that points at its page (see [Phases](#phases)).
Because a printed QR code can never be changed, the page address is designed to be
permanent from day one.

---

## The admin dashboard

A private area at `/admin` for adding and maintaining plants.

**One login only.** A single username and password, set on the server. There is no
signup and no way to create another account, so nobody else can get in.

Inside, two tabs:

| Tab | What it does |
|---|---|
| **All plants** | Every plant as a card with its photo, name and address. Open one to edit it, view its live page, or delete it. |
| **Add plant** | One form, laid out in the same order as the plant page. Save, and the page is live at its address. |

### What the form asks for

| # | Section | Fields | Required? |
|---|---|---|---|
| 1 | **Photo** | the photo (tap to choose, or drag and drop), and a one-line description of it | photo required |
| 2 | **Identity** | common name, scientific name, page address (filled in from the name) | common name and address |
| 3 | **Quick Profile** | environment: tap *Indoor*, *Outdoor* or *Indoor & outdoor* · light need: a summary, a tolerance note, and a 4-step light scale (tap each step: ideal → tolerates → clear) · landscape uses and home uses: type each one and press Enter · an optional note under each | all optional; empty cards are hidden on the page |
| 4 | **The Snap** | one or two sentences, up to 600 characters | required |
| 5 | **The Deep Dive** | titled points, each with an icon picked from 8. A new plant starts with *Origin & Habit*, *Key Care Rule*, *Special Feature* and *Pet Safety*; add more, remove any, or reorder them. Points left blank are skipped. | at least one point |

Every plant uses the same page design; only the content changes. A plant without pet
information simply has no Pet Safety point, and a plant that needs an extra point, say
*Pruning*, gets one.

---

## How it works

### A plant

Plants live in the database and are served by the API; the page and the admin form
both follow the same shape. The Peace Lily is loaded by `backend/scripts/seed.py` from
[`backend/seed/peace-lily.json`](backend/seed/peace-lily.json), which is a complete
example. The exact API format is in [backend/README.md](backend/README.md#a-plant).

| Field | Example |
|---|---|
| `slug` | `peace-lily`, the address. **Set once, never changed** (see below). |
| `common_name` | Peace Lily |
| `scientific_name` | *Spathiphyllum wallisii* |
| `image` | the photo, its description, a blurred preview and a backdrop colour |
| `profile.environment` | Indoor |
| `profile.light` | a label (*Medium to bright indirect light*), a note (*Tolerates low light*), and where it sits on the scale Low → Medium → Bright indirect → Direct sun, drawn as a meter |
| `profile.landscape_use` | a list (*Shaded tropical borders, Mass groundcover*) and an optional note (*Frost-free zones*) |
| `profile.home_use` | a list (*Tabletop accent, Floor plant, Air-purifying space cleaner*) |
| `snap` | the short description |
| `deep_dive` | the long description, as titled points, each with an icon |

### The address is permanent

The slug is created from the name when a plant is added and **cannot be edited
afterwards**, even if the name is. Once QR codes are printed, changing an address would
break every label pointing at it. Rules:

- lowercase letters, numbers and single hyphens only: `snake-plant`, `zz-plant-2`
- must be unique; a slug is never reused, even after its plant is deleted
- cannot be a reserved word used by the site itself: `admin`, `api`, `assets`

### Images

Photos are resized and converted to WebP when uploaded (a 7.5 MB phone photo comes out
around 60 KB) and stored in Supabase Storage. Location data in the original photo is
removed. Pages load fast even on a poor mobile connection.

---

## Phases

### Phase 1 — plant pages and admin dashboard *(now)*

1. ~~**Plant page template** at `/<slug>`~~: mobile-first, animated, pinned photo on
   wide screens, "not found" page for unknown addresses.
2. ~~**Data model and API** matching the template~~, replacing the block-based page
   builder and categories. Pages and the home search read from the API.
3. ~~**Admin: Add plant** tab~~
4. ~~**Admin: All plants** tab~~: browse, edit, delete.
5. ~~**Database migrations** (Alembic)~~
6. **Deploy** the frontend to Vercel and the backend to a host, with Supabase for the
   database and images.

### Phase 2 — QR codes *(later)*

7. Generate a QR code for each plant that points at its page.
8. Download or print QR labels from the admin dashboard.

---

## Open questions

Decisions still to confirm. The defaults are what Phase 1 will build unless decided
otherwise.

| Question | Default |
|---|---|
| A **Notes** section for extra remarks? (in the first idea, not in the Peace Lily sample) | Not shown |
| **Draft / published** switch, so a half-written plant isn't public? | No, a plant is live as soon as it's saved |
| **Formatting** in the long description (bold, lists, headings)? | No, plain text with paragraphs |
| Where does the **backend** run? | Vercel, as a second project (free plan for now) |

---

## Repository layout

```
frontend/    React 19 + Vite 7 + React Router   →  Vercel
backend/     FastAPI + SQLAlchemy               →  container host
             Supabase                           →  Postgres database + image storage
```

Each folder has its own README with more detail.

## Running locally

Two terminals.

```bash
# terminal 1 — backend on :8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set ADMIN_EMAIL and ADMIN_PASSWORD
alembic upgrade head        # create the tables
python scripts/seed.py      # add the Peace Lily
uvicorn app.main:app --reload
```

```bash
# terminal 2 — frontend on :5173
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

- Site: http://localhost:5173
- Admin: http://localhost:5173/admin
- API docs: http://localhost:8000/docs

## Deploying

Frontend and backend are two Vercel projects from this repository, with Supabase for the
database and photos. Step-by-step: **[DEPLOY.md](DEPLOY.md)**.
