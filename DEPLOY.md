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
   | `SUPABASE_SERVICE_KEY` | Project Settings → API Keys → a **secret** key (`sb_secret_…`) |
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
- `https://stomatalworld.vercel.app/` — search shows the Peace Lily
- `https://stomatalworld.vercel.app/admin` — sign in with the password from step 2

## Afterwards

- Every `git push` to `main` redeploys both projects.
- **Schema changes:** after pulling a new migration, run
  `ENV_FILE=.env.production alembic upgrade head` from `backend/` *before* pushing the
  code that needs it.
- **Custom domain:** add it to the frontend project, then add it to the backend's
  allowed origins, e.g. `CORS_ORIGINS=["https://plants.example.com","https://stomatalworld.vercel.app"]`.
- **Free-plan limits:** Vercel Hobby is for non-commercial use; move to Pro when the
  site is used in the shop. Supabase free projects pause after a week with no activity —
  restore from the dashboard if that happens, or upgrade.
