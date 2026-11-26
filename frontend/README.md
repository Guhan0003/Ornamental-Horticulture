# Frontend — Ornamental Horticulture

React 19 + Vite 7 + React Router.

## Running

```bash
npm install
cp .env.example .env.local
npm run dev
```

Opens on http://localhost:5173

Tests: `npm test` runs the price, delivery, My list, family-shelf and contact-detail
logic with Node's built-in runner (nothing extra to install). The link-preview and
sitemap logic has its own suite one level up: `node --test server/share.test.js`.

## Structure

```
src/
├── main.jsx                  entry point, router provider
├── App.jsx                   route table; fetches the saved contact details once
├── pages/
│   ├── Home.jsx              landing page: the shop
│   ├── PlantPage.jsx         /<slug> — fetches one plant
│   ├── OrderPage.jsx         /order?p=slug.qty,… — one customer's order, with photos
│   └── NotFound.jsx
├── components/
│   ├── PlantView.jsx         the plant page design, rendered from API data
│   ├── Gallery.jsx           the photos at the top: a scroll-snap row, dots, mouse drag
│   ├── Catalogue.jsx         the home page shop: search, sort, family shelves, back to top
│   ├── DeliveryCheck.jsx     pincode box on the plant page: gives a delivery date range
│   ├── MyList.jsx            the "My list" pill and its sheet: send several plants at once
│   ├── ListButton.jsx        the + on a card, and "Add to my list" on a plant's page
│   ├── ContactButton.jsx     the round contact button on every public page, and its card
│   ├── PhotoNote.jsx         the "Reference image" label on a photo, and the note it opens
│   ├── PhotoLine.jsx         the one-line version of that notice, for footers
│   ├── ErrorBoundary.jsx     a render error becomes a page with a Try again button
│   ├── Icon.jsx              line icons (quick profile, deep dive)
│   └── Leaf.jsx
├── data/
│   ├── contact.js            the contact details built in: the starting point and fallback
│   └── photos.js             the words of the reference-image notice, in one place
├── lib/
│   ├── api.js                backend client, token handling, the scan and tap beacons
│   ├── commerce.js           prices, stock, the WhatsApp order message, sorting
│   ├── groups.js             genus → the family shelf a plant sits on in the shop
│   ├── delivery.js           pincode → delivery window (1–3 / 2–5 working days) and dates
│   ├── list.js               My list: the rules, the totals, the WhatsApp message (tested)
│   ├── listStore.js          that list as the phone keeps it (localStorage)
│   ├── contact.js            the built-in details with the saved ones laid over (tested)
│   ├── contactStore.js       the result, and who to tell when it changes
│   ├── prepareImage.js       shrink a photo in the browser before uploading it
│   └── plantFormat.js        light scale, icons, empty plant — shared by page and admin
├── admin/                    the dashboard (not linked from anywhere public)
│   ├── AdminRoutes.jsx       everything behind /admin, in one lazily loaded module
│   ├── AuthContext.jsx       session state
│   ├── RequireAuth.jsx       route guard
│   ├── admin.css
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── AllPlants.jsx     tab 1: every plant as a card, with its scans and taps
│   │   ├── AddPlant.jsx      tab 2: new plant
│   │   ├── Settings.jsx      tab 3: the shop's phone, WhatsApp, email and Instagram
│   │   └── EditPlant.jsx     edit or delete one plant
│   └── components/
│       ├── AdminLayout.jsx
│       ├── PlantForm.jsx     the form, section by section like the page
│       ├── PhotosField.jsx   many photos: upload, choose the cover, order, describe, remove
│       ├── LightLevels.jsx   the 4-step light scale
│       ├── ChipsInput.jsx    landscape and home uses
│       └── DeepDiveEditor.jsx
└── styles/
    ├── index.css             landing page and shop
    ├── plant.css             the plant page
    ├── mylist.css            the My list pill, sheet and add buttons
    ├── order.css             the order page
    └── contact.css           the contact button and its card
```

## Admin

At `/admin`, behind a single login. It is deliberately not linked from any public page.
Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` configured on the backend. The three
tabs are **All plants**, **Add plant** and **Settings**. The whole dashboard is one lazy
chunk (`AdminRoutes.jsx`), so a customer scanning a label in a shop never downloads it.

## Plant pages

Every plant uses the same design. `PlantView` renders whatever the API returns and skips
sections that are empty — no scientific name, no quick profile cards, a different set of
Deep Dive points — so a sparse plant still reads as a finished page.

## Deploying

Vercel, at **[www.stomatalworld.app](https://www.stomatalworld.app)**, with the project's
**Root Directory left at the repository root** — not `frontend`. The root `vercel.json`
is what builds this folder (`npm --prefix frontend run build`, output `frontend/dist`),
because the three functions in `api/` live outside it and have to be deployed with it. It
also rewrites every other route to `index.html`, so a plant address like `/peace-lily`
resolves.

Production builds call `https://stomatalworld-api.vercel.app` unless `VITE_API_URL` is
set; the API has no domain of its own. The backend is a separate Vercel project, with
Root Directory `backend` and its own `backend/vercel.json`. Full steps, and the places
the domain is written down, are in [DEPLOY.md](../DEPLOY.md).
