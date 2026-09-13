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

That is the whole public site. No categories, no search, no accounts, nothing to
browse. A visitor opens a link and reads about one plant.

Later, every plant gets a **QR code** that points at its page (see [Phases](#phases)).
Because a printed QR code can never be changed, the page address is designed to be
permanent from day one.

---

## The admin dashboard

A private area at `/admin` for adding and maintaining plants.

**One login only.** A single username and password, set on the server. There is no
signup and no way to create another account, so nobody else can get in.

Inside, two pages:

| Page | What it does |
|---|---|
| **Add plant** | Upload the photo, then fill in each section of the page: names, quick profile, the snap and the deep dive. Save, and the plant's page goes live at its address. |
| **All plants** | Everything in the database, with the image and name of each plant. Open any plant to view it, edit its details, replace its image, or delete it. |

---

## How it works

### A plant

The first plant, the Peace Lily, is live at `/peace-lily` with its content hardcoded in
[`frontend/src/data/plants.js`](frontend/src/data/plants.js). That file defines the
shape every plant follows; the database and admin dashboard will be built to match it.

| Field | Example |
|---|---|
| `slug` | `peace-lily`, the address. **Set once, never changed** (see below). |
| `commonName` | Peace Lily |
| `scientificName` | *Spathiphyllum wallisii* |
| `image` | the photo, with alt text |
| `profile.environment` | Indoor |
| `profile.light` | a label (*Medium to bright indirect light*), a note (*Tolerates low light*), and where it sits on the scale Low → Medium → Bright indirect → Direct sun, drawn as a meter |
| `profile.landscapeUse` | a list (*Shaded tropical borders, Mass groundcover*) and an optional note (*Frost-free zones*) |
| `profile.homeUse` | a list (*Tabletop accent, Floor plant, Air-purifying space cleaner*) |
| `snap` | the short description |
| `deepDive` | the long description, as titled points, each with an icon: origin & habit, key care rule, special feature, pet safety |

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

1. ~~**Plant page template** at `/<slug>`~~, done with the Peace Lily hardcoded.
   Mobile-first, animated, pinned photo on wide screens, "not found" page for unknown
   addresses.
2. **Data model and API** matching the template. The current backend uses a more
   complex block-based page builder with categories; that is removed, and the page
   reads from the API instead of the hardcoded file.
3. **Admin: Add plant** page.
4. **Admin: All plants** page: browse, view, edit, delete.
5. **Database migrations** (Alembic) so the schema can change safely once there is real
   data.
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
| Where does the **backend** run? (Render, Railway, Fly…) | Not decided |

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

**Frontend** — Vercel. Set `VITE_API_URL` to the deployed backend URL.

**Backend** — any container host. Set `ENVIRONMENT=production`, a real `SECRET_KEY`,
`ADMIN_PASSWORD_HASH` (from `python scripts/hash_password.py`), and the Supabase
`DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. The backend refuses to start
in production with a default key or password. See [backend/README.md](backend/README.md).
