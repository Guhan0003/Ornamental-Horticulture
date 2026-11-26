# Deploying

Two Vercel projects from this one repository, and one Supabase project:

```
www.stomatalworld.app             frontend   Vercel project, builds from the repo root via vercel.json
stomatalworld-api.vercel.app      backend    Vercel project, Root Directory: backend, backend/vercel.json
Supabase                          Postgres database + plant-images bucket
```

**The shop is live at [https://www.stomatalworld.app](https://www.stomatalworld.app).**
`www` is the canonical host: `stomatalworld.app` redirects to it, and the Vercel
address the site launched on, `stomatalworld.vercel.app`, still answers, so a link
shared or a label printed before the move keeps working. Everything the site writes
about itself — the canonical tag, the link previews, the sitemap — names the `www`
address, so the same page is never offered to Google under two names. The API keeps
its Vercel address; only the shop has a domain of its own.

Everything below is on the free plans. Do the steps in order: the database is ready
before any code that needs it goes live.

---

## 1. Supabase

In the [Supabase dashboard](https://supabase.com/dashboard), open the project (or create
one).

1. **Storage → New bucket.** Name it `plant-images` and switch **Public bucket** on.
2. **Collect these values** — you'll paste them in steps 2 and 3:

   | Name | Where to find it |
   |---|---|
   | `SUPABASE_URL` | Project Settings → Data API → Project URL, e.g. `https://abcd.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | Project Settings → API Keys → a **secret** key (`sb_secret_…`). **Not** the publishable key (`sb_publishable_…`): that one is for browsers and cannot save photos. |
   | Session pooler URL | **Connect** (top bar) → Session pooler. Port **5432**. For step 2. |
   | Transaction pooler URL | **Connect** → Transaction pooler. Port **6543**. For step 3. |

   In both connection strings, replace `[YOUR-PASSWORD]` with the database password and
   change the start from `postgresql://` to **`postgresql+psycopg://`**.

The secret key can write to everything in the project. It goes only into
`backend/.env.production` and the backend's Vercel settings — never into the frontend,
a commit, or a chat.

## 2. Create the tables and add the Peace Lily (your terminal, once)

```bash
cd backend
source .venv/bin/activate
```

Make two secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

```bash
python scripts/hash_password.py
```

The first prints the `SECRET_KEY`. The second asks for the admin password you want to use
on the live site and prints `ADMIN_PASSWORD_HASH`.

Create `backend/.env.production` (it is gitignored) with:

```ini
ENVIRONMENT=production
DATABASE_URL='postgresql+psycopg://postgres.abcd:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres'
SECRET_KEY='…from the first command…'
ADMIN_EMAIL=guhan@stomatalworld.com
ADMIN_PASSWORD=
ADMIN_PASSWORD_HASH='$2b$12$…from the second command…'
SUPABASE_URL=https://abcd.supabase.co
SUPABASE_SERVICE_KEY='sb_secret_…'
```

Keep the single quotes: the hash contains `$` signs. Use the **session pooler (5432)**
URL here. Then:

```bash
ENV_FILE=.env.production alembic upgrade head
ENV_FILE=.env.production python scripts/seed.py
```

The second command should print `added  peace-lily -> https://abcd.supabase.co/storage/…`.
Both are safe to run again.

## 3. Backend on Vercel

The code must be on GitHub first (`git push`).

1. [vercel.com/new](https://vercel.com/new) → import **Guhan0003/Ornamental-Horticulture**.
2. **Root Directory:** `backend`. `backend/vercel.json` pins what matters and overrides
   anything the dashboard pre-fills: framework `fastapi`, the default Python install,
   a no-op build command (an *empty* build command makes Vercel serve the folder as
   static files), and the `syd1` region, beside the Sydney database.
3. **Environment Variables** — the same values as `.env.production`, except
   `DATABASE_URL` uses the **transaction pooler (port 6543)**:

   | Key | Value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | transaction pooler URL, `postgresql+psycopg://…:6543/postgres` |
   | `SECRET_KEY` | from step 2 |
   | `ADMIN_EMAIL` | `guhan@stomatalworld.com` |
   | `ADMIN_PASSWORD_HASH` | from step 2 (no quotes needed here) |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_KEY` | from step 1 |

4. **Deploy.** When it finishes, open these on the new address:
   - `/health` → `{"status":"ok"}`
   - `/api/v1/plants` → a list containing the Peace Lily

If the deployment log shows `ValueError`, a production setting is missing — the message
says which. The backend refuses to start without a real secret key, a password hash,
Supabase storage and a Postgres database.

## 4. The frontend

Nothing to set: production builds call `https://stomatalworld-api.vercel.app` by default
(see `frontend/src/lib/api.js`). If the backend ever moves, set `VITE_API_URL` in the
frontend project's Environment Variables and redeploy.

Then check on a phone:

- `https://www.stomatalworld.app/peace-lily` — the full page
- `https://www.stomatalworld.app/` — the shop shows the Peace Lily
- `https://www.stomatalworld.app/admin` — sign in with the password from step 2

## Afterwards

- Every `git push` to `main` redeploys both projects.
- **Schema changes:** after pulling a new migration, run
  `ENV_FILE=.env.production alembic upgrade head` from `backend/` *before* pushing the
  code that needs it.
- **Backups:** `python scripts/backup.py` from `backend/` copies the database and every
  photo into `backend/backups/`. Run it whenever the content changes, and before any
  schema change.
- **Locked out of `/admin`:** five wrong passwords from one address and that address
  waits 15 minutes; the message on the sign-in form says how long is left. To clear it
  early, delete the row in Supabase → Table editor → `login_attempts`.
- **The domain is already set up**, and these are the four places it is written down,
  should it ever move again:
  1. the frontend Vercel project's **Domains** (`www.stomatalworld.app`, with
     `stomatalworld.app` redirecting to it);
  2. `DEFAULT_SITE_URL` in `server/share.js` — what the link previews and the sitemap
     call the site. `SITE_URL` in the frontend project's environment variables
     overrides it without a deploy, which is the quickest way to move in a hurry;
  3. `og:image` in `frontend/index.html` and `Sitemap:` in `frontend/public/robots.txt`;
  4. the backend's allowed origins — `CORS_ORIGINS` in its Vercel environment
     variables, whose default list is in `backend/app/core/config.py`. A browser sends
     the origin it started on, so the apex belongs on the list beside the `www` host,
     e.g. `CORS_ORIGINS=["https://www.stomatalworld.app","https://stomatalworld.app"]`.
     Preview deployments are already covered by `CORS_ORIGIN_REGEX`.

  Leave the old addresses allowed when you add a new one. A QR label cannot be
  reprinted once it is on a shelf, and the Vercel address is what the earliest ones
  point at.
- **The old addresses redirect, they don't disappear.** `vercel.json` sends every
  request that arrives on `stomatalworld.vercel.app` to the same path on
  `www.stomatalworld.app`, permanently (`308`). It takes two rules, not one:
  `/:path*` matches a path with something in it and not the bare `/`, so the home
  page needs its own rule, and without it the front door is the one address that
  does not move. Check both after any change to this. A label printed with the old address
  still opens the right plant — it just finishes on the domain — and Google is told
  the two are one page rather than two copies of it, which is what decides whether a
  search for the shop's name shows the new address or the old one.
  `ornamental-horticulture.vercel.app` redirects to `stomatalworld.vercel.app` in the
  Vercel project's **Domains**, and then on again, so it takes two hops; point it
  straight at `www.stomatalworld.app` there to make it one.
- **Telling Google**, once the redirect is live:
  1. **Search Console** → add and verify `https://www.stomatalworld.app` as a property
     (the DNS record is the easiest, since the domain is yours).
  2. Submit `https://www.stomatalworld.app/sitemap.xml` under **Sitemaps**. It is built
     from the plant list, so it stays current by itself.
  3. If the old address is already a verified property, run **Settings → Change of
     address** from it to the new one. That, and the redirect, are what move the
     search results across; without them Google keeps showing whichever address it
     indexed first.
  4. **URL Inspection → Request indexing** on the home page hurries the brand search
     along. The rest follows from the sitemap.
  5. The repository's **About → Website** on GitHub, and the link in the Instagram
     profile, are the two places outside this repo that still name an address. Both
     are worth pointing at the domain.

  A search for the shop's name is answered by the home page, so that page carries an
  `Organization` block naming it (in `frontend/index.html`). A plant's page carries a
  `Product` block instead, written by `api/plant.js`, which takes the first one out —
  one page is one thing, never both.
- **Link previews and the sitemap:** a plant's link pasted into WhatsApp shows its photo,
  name and price, and Google gets a sitemap, because of two small functions in `api/`.
  `vercel.json` sends only crawlers (WhatsApp, Google, Facebook, Telegram and the like)
  to `api/plant.js`, which writes the plant's own tags into the page; people scanning a
  label get the normal page with nothing in the way. `/sitemap.xml` is built from the
  plant list by `api/sitemap.js`, so a plant added in the dashboard appears there on its
  own. Both read the plant list from the API, and the logic lives in `server/share.js`
  (`node --test server/share.test.js`).
  - To check one: `curl -A "WhatsApp/2.23" https://www.stomatalworld.app/peace-lily`
    should show that plant's `og:title` and `og:image`, and a `canonical` and `og:url`
    on `www.stomatalworld.app` — never on another host, whichever host was asked.
  - WhatsApp remembers a preview for a while. To see a changed one straight away, paste
    the link into Facebook's Sharing Debugger and press *Scrape Again*.
  - The address they write is `DEFAULT_SITE_URL` in `server/share.js`, and `SITE_URL`
    in the frontend project's environment variables overrides it with no deploy.
    `API_URL` does the same if the API ever moves.
- **Speed:** the shop's plant list (`GET /api/v1/plants`) and each plant's data
  (`GET /api/v1/plants/{slug}`, what a QR scan opens) are kept at Vercel's CDN for a minute,
  and for an hour more they are served instantly while a fresh copy is fetched, so the
  pages open in a fraction of a second instead of waiting on the server in Sydney, and
  never wait for that server to wake up (it sleeps after a few quiet minutes, and waking
  it was measured at up to 11 seconds). The cost: a change made in the dashboard shows on
  the shop within a minute when it is busy, but when it has been quiet the first visitor
  sees the old version once and the next visitor sees the new one, so after editing, open
  the shop twice to check. The dashboard asks with `?fresh=1` (the list, and the plant
  editor) and is always current.
  - **Scans are counted by the page, not by the data request.** A request the CDN answers
    never reaches the server, so the plant page tells the server it was shown with
    `POST /api/v1/plants/{slug}/view` (a beacon, like the order-button taps), once per plant
    per visit. Crawlers and link previews are ignored there, as before, and fetching
    a plant's data (a prefetch for the three suggestions, a link preview) is never a view.
    Never cache the `/view` or `/tap` endpoints, and do not move the counting back to
    `GET /plants/{slug}`: tests guard both.
  - The list and plants answer with `Vary: Origin`, so the cache keeps one copy per website
    that asks. Keep that if the CORS settings change or another domain is added — the shop
    now asks from `www.stomatalworld.app` and the old Vercel address asks as itself, and
    each needs its own cached copy with its own permission in it.
  - To see it working: `curl -sI -H "Origin: https://www.stomatalworld.app"
    https://stomatalworld-api.vercel.app/api/v1/plants` twice; the second answer should
    say `x-vercel-cache: HIT`, and `access-control-allow-origin` should name the origin
    you sent.
  - Two smaller things keep the first load quick. The site sends a `Content-Type` only on
    requests that carry data, because on a plain read the browser would otherwise ask the
    API's permission first (an extra round trip of about a quarter of a second, for every
    plant page). And `frontend/index.html` opens the connection to the API early
    (`preconnect`); if the API ever moves, change that address too.
- **Contact details are edited in the dashboard.** *Settings* changes the call and
  WhatsApp numbers, the email, Instagram and the contact card's greeting for the whole
  shop, with nothing to deploy. They live in the `site_settings` table (migration
  `0007`, so run `alembic upgrade head` before the code goes live, as for any schema
  change) and are served at `GET /api/v1/settings`, kept at the CDN like the plant list
  and read fresh (`?fresh=1`) by the dashboard. `frontend/src/data/contact.js` is only
  what the site uses until something is saved, and if the server cannot be reached; if
  the number ever changes for good, change it there too. A change reaches customers
  within a minute or two, and when the shop has been quiet the very first visitor can
  still see the old numbers once, so after saving, open the shop twice.
- **The order page.** A customer's *My list* message ends with one link,
  `/order?p=slug.qty,slug`, to a page that shows every plant in the order with its
  photo. Like a plant's page, it has a crawler-only function (`api/order.js`, sent there by
  `vercel.json`, before the rule for plants because `order` looks like a plant's
  address) that writes the link-preview card, so WhatsApp shows "Plant order — 3 plants ·
  ₹1,197" with the first plant's photo. To check it:
  `curl -A "WhatsApp/2.23" "https://www.stomatalworld.app/order?p=peace-lily"` should show
  that `og:title`. `order` is a reserved address, so no plant can be given it.
- **If the API ever moves off `*.vercel.app`:** the frontend's
  `Content-Security-Policy` in `vercel.json` allows `connect-src https:`, so a new
  API host keeps working — but tighten it to the exact origin once the address
  settles. `/assets/*` is cached for a year, which is safe because Vite puts a
  content hash in every filename.
- **Replacing the Supabase key:** copy a **secret** key (`sb_secret_…`), not the
  publishable one, into both `backend/.env.production` and the backend's
  `SUPABASE_SERVICE_KEY` on Vercel, then redeploy. With the wrong one, pages still
  load but adding a photo fails with "row-level security policy".
- **Free-plan limits:** Vercel Hobby is for non-commercial use; move to Pro when the
  site is used in the shop. Supabase free projects pause after a week with no activity —
  restore from the dashboard if that happens, or upgrade.
