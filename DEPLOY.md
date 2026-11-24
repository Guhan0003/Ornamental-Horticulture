# Deploying

Two Vercel projects from this one repository, and one Supabase project:

```
stomatalworld.vercel.app          frontend   Vercel project, builds from the repo root via vercel.json
stomatalworld-api.vercel.app      backend    Vercel project, Root Directory: backend, backend/vercel.json
Supabase                          Postgres database + plant-images bucket
```

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

- `https://stomatalworld.vercel.app/peace-lily` — the full page
- `https://stomatalworld.vercel.app/` — the shop shows the Peace Lily
- `https://stomatalworld.vercel.app/admin` — sign in with the password from step 2

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
- **Custom domain:** add it to the frontend project, then add it to the backend's
  allowed origins, e.g. `CORS_ORIGINS=["https://plants.example.com","https://stomatalworld.vercel.app"]`.
  Preview deployments are already covered by `CORS_ORIGIN_REGEX`. Then point the link
  previews at it (see the next point).
- **Link previews and the sitemap:** a plant's link pasted into WhatsApp shows its photo,
  name and price, and Google gets a sitemap, because of two small functions in `api/`.
  `vercel.json` sends only crawlers (WhatsApp, Google, Facebook, Telegram and the like)
  to `api/plant.js`, which writes the plant's own tags into the page; people scanning a
  label get the normal page with nothing in the way. `/sitemap.xml` is built from the
  plant list by `api/sitemap.js`, so a plant added in the dashboard appears there on its
  own. Both read the plant list from the API, and the logic lives in `server/share.js`
  (`node --test server/share.test.js`).
  - To check one: `curl -A "WhatsApp/2.23" https://stomatalworld.vercel.app/peace-lily`
    should show that plant's `og:title` and `og:image`.
  - WhatsApp remembers a preview for a while. To see a changed one straight away, paste
    the link into Facebook's Sharing Debugger and press *Scrape Again*.
  - With a custom domain, set `SITE_URL` (for example `https://plants.example.com`) in
    the frontend project's environment variables, and change the address in
    `frontend/index.html` (`og:image`) and `frontend/public/robots.txt` (`Sitemap:`).
    `API_URL` can be set the same way if the API ever moves.
- **Speed:** the shop's plant list (`GET /api/v1/plants`) is kept at Vercel's CDN for a
  minute, and for an hour more it is served instantly while a fresh copy is fetched, so the
  shop opens in a fraction of a second instead of waiting on the server in Sydney, and
  never waits for that server to wake up (it sleeps after a few quiet minutes, and waking
  it was measured at up to 11 seconds). The cost: a change made in the dashboard shows on
  the shop within a minute when it is busy, but when it has been quiet the first visitor
  sees the old list once and the next visitor sees the new one, so after editing, open the
  shop twice to check. The dashboard asks with `?fresh=1` and is always current.
  - A plant's own page is deliberately **not** cached: a scan is counted when the request
    reaches the server, and a cached page would never get there. Do not add `s-maxage` to
    it without first moving the counting somewhere else (a beacon, as the order-button
    taps use).
  - The list answers with `Vary: Origin`, so the cache keeps one copy per website that
    asks. Keep that if the CORS settings change or a custom domain is added.
  - To see it working: `curl -sI -H "Origin: https://stomatalworld.vercel.app"
    https://stomatalworld-api.vercel.app/api/v1/plants` twice; the second answer should
    say `x-vercel-cache: HIT`.
  - Two smaller things keep the first load quick. The site sends a `Content-Type` only on
    requests that carry data, because on a plain read the browser would otherwise ask the
    API's permission first (an extra round trip of about a quarter of a second, for every
    plant page). And `frontend/index.html` opens the connection to the API early
    (`preconnect`); if the API ever moves, change that address too.
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
