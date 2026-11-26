# Ornamental Horticulture

**by StomatalWorld**

A Wikipedia-style website for ornamental plants, and the shop front for selling them: one
simple page per plant, a home page that lists every plant with its price, and a private
admin dashboard to manage them. Ordering is a WhatsApp message to the shop for now;
see [COMMERCE.md](COMMERCE.md).

**Live at [www.stomatalworld.app](https://www.stomatalworld.app).** `www` is the
canonical host: `stomatalworld.app` redirects to it, and `stomatalworld.vercel.app`,
the address the site launched on, still answers — a printed QR label cannot be
changed, so nothing the site has ever been reached at is switched off.
[DEPLOY.md](DEPLOY.md) lists the places the domain is written down.

---

## The core idea

Every plant gets **one page at a short, permanent address**:

```
https://www.stomatalworld.app/peace-lily
```

That page shows, for that plant, in this order:

| Section | What it holds |
|---|---|
| **Photos** | the cover photo first, then as many more as you like (up to 12 in all), swiped sideways. A phone follows your finger; a mouse can drag, click the arrows or use the dots. |
| **Identity** | common name and scientific name |
| **Price** | the price (with the original struck through and "% off" when there is a discount), what it includes, whether it is in stock, and an **Order on WhatsApp** button that already names the plant |
| **Delivery** | a pincode box that answers with a range of dates: 1–3 working days to Tamil Nadu, Andhra Pradesh, Kerala and Karnataka, 2–5 working days anywhere else. Sundays aren't counted in the dates. |
| **Quick Profile** | environment, light need, landscape use, home use |
| **The Snap** | one or two sentences: the plant at a glance |
| **The Deep Dive** | titled points: origin & habit, key care rule, special feature, pet safety |
| **My list** | **Add to my list**, for someone who wants this plant and others: the whole list goes to the shop as one WhatsApp message. |

Every photo carries a **Reference image** label, because the pictures are illustrations
rather than the exact plant being sent; tapping it explains that and offers to ask on
WhatsApp for a photo of the one in stock.

The home page is the shop: every plant as a card with its photo, name and price, three
to a row on a phone. By default the cards sit under their family — Philodendron, Pothos,
Monstera — worked out from the scientific name, with a row of chips that jumps to any of
them; sorting by price flattens that back into one list. Sold-out plants sink to the end.
A search icon beside the sort menu opens a field that filters the cards as you type.
There are still no accounts.

**My list** is how someone buys more than one plant. The + on a card, or *Add to my
list* on a plant's page, collects them on the phone; one tap sends the shop a single
WhatsApp message with every plant, how many of each, a total and the delivery pincode,
ending in a link to **the order page** (`/order?p=…`) that shows each plant with its
photo. It is a list, not a basket: nothing is charged and no stock is held.
See [COMMERCE.md](COMMERCE.md).

Later, every plant gets a **QR code** that points at its page (see [Phases](#phases)).
Because a printed QR code can never be changed, the page address is designed to be
permanent from day one.

---

## The admin dashboard

A private area at `/admin` for adding and maintaining plants.

**One login only.** A single username and password, set on the server. There is no
signup and no way to create another account, so nobody else can get in. Five wrong
passwords in a row and that device has to wait fifteen minutes, so the one password
can't be guessed at by a machine.

Inside, three tabs:

| Tab | What it does |
|---|---|
| **All plants** | Every plant as a card with its photo, name and address, and how often it was scanned and its WhatsApp button pressed in the last 30 days. Open one to edit it, view its live page, or delete it. |
| **Add plant** | One form, laid out in the same order as the plant page. Save, and the page is live at its address. |
| **Settings** | The shop's call and WhatsApp numbers, email, Instagram handle and the greeting in the contact card. Changing them here changes every button on the site, with nothing to deploy. |

### What the form asks for

| # | Section | Fields | Required? |
|---|---|---|---|
| 1 | **Photos** | as many photos as you like, up to 12 (tap to choose several at once, or drag and drop) · tap a photo to make it the cover, move it earlier or later, describe it, or remove it · the first photo is the cover: the thumbnail in the shop | at least one |
| 2 | **Identity** | common name, scientific name, page address (filled in from the name) | common name and address |
| 3 | **Price & availability** | price in rupees · an optional original price (shows the discount) · what the price includes, e.g. *with white decor pot* · *In stock*, *Ask us* or *Sold out* | all optional; with no price the page says "Ask for the price" |
| 4 | **Quick Profile** | environment: tap *Indoor*, *Outdoor* or *Indoor & outdoor* · light need: a summary, a tolerance note, and a 4-step light scale (tap each step: ideal → tolerates → clear) · landscape uses and home uses: type each one and press Enter · an optional note under each | all optional; empty cards are hidden on the page |
| 5 | **The Snap** | one or two sentences, up to 600 characters | required |
| 6 | **The Deep Dive** | titled points, each with an icon picked from 8. A new plant starts with *Origin & Habit*, *Key Care Rule*, *Special Feature* and *Pet Safety*; add more, remove any, or reorder them. Points left blank are skipped. | at least one point |

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
| `image` | the cover photo, its description, a blurred preview and a backdrop colour. It is the thumbnail in the shop and in suggestions. |
| `gallery` | more photos after the cover, each shaped like `image`, in swiping order (up to 11) |
| `profile.environment` | Indoor |
| `profile.light` | a label (*Medium to bright indirect light*), a note (*Tolerates low light*), and where it sits on the scale Low → Medium → Bright indirect → Direct sun, drawn as a meter |
| `profile.landscape_use` | a list (*Shaded tropical borders, Mass groundcover*) and an optional note (*Frost-free zones*) |
| `profile.home_use` | a list (*Tabletop accent, Floor plant, Air-purifying space cleaner*) |
| `price_minor` | `39900`, the price in **paise**, so ₹399. Empty means "ask for the price". |
| `original_price_minor` · `price_note` · `availability` | the price before a discount · *with white decor pot* · `in_stock`, `ask` or `sold_out` |
| `snap` | the short description |
| `deep_dive` | the long description, as titled points, each with an icon |

### The address is permanent

The slug is created from the name when a plant is added and **cannot be edited
afterwards**, even if the name is. Once QR codes are printed, changing an address would
break every label pointing at it. Rules:

- lowercase letters, numbers and single hyphens only: `snake-plant`, `zz-plant-2`
- must be unique; a slug is never reused, even after its plant is deleted
- cannot be a reserved word used by the site itself: `admin`, `api`, `assets`, `order`

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
   builder and categories. Pages and the home shop read from the API.
3. ~~**Admin: Add plant** tab~~
4. ~~**Admin: All plants** tab~~: browse, edit, delete.
5. ~~**Database migrations** (Alembic)~~
6. ~~**Deploy** the frontend to Vercel and the backend to a host, with Supabase for the
   database and images~~: live at [www.stomatalworld.app](https://www.stomatalworld.app),
   the API as a second Vercel project, Supabase for the database and photos.
   See [DEPLOY.md](DEPLOY.md).

Built since, on top of Phase 1: prices and the WhatsApp order button, the delivery
check, *My list* and the order page, the dashboard's *Settings*, family shelves on the
shop, scan and tap counts, and link previews with a sitemap. The reasoning is in
[COMMERCE.md](COMMERCE.md).

### Phase 2 — QR codes *(now)*

7. Generate a QR code for each plant that points at its page. One exists by hand, in
   `brand/instagram/`; nothing generates them in bulk yet.
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
| ~~Where does the **backend** run?~~ | **Decided:** Vercel, as a second project |

COMMERCE.md's §2 holds the open questions about selling: pot sizes, stock counts,
several shops and delivery.

---

## Repository layout

```
frontend/    React 19 + Vite 7 + React Router   →  Vercel (www.stomatalworld.app)
api/         three Vercel functions: link previews for a plant and an order, sitemap.xml
server/      share.js — the meta-tag and sitemap logic those functions share
backend/     FastAPI + SQLAlchemy               →  Vercel (stomatalworld-api.vercel.app)
             Supabase                           →  Postgres database + image storage
brand/       the logo set, icons and Instagram artwork
```

`frontend/`, `backend/` and `brand/` each have their own README with more detail.

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
database and photos. The shop answers at **www.stomatalworld.app** and the API at
**stomatalworld-api.vercel.app**. Step-by-step, and the places the domain is written
down: **[DEPLOY.md](DEPLOY.md)**.
