# Frontend — Ornamental Horticulture

React 19 + Vite 7 + React Router.

## Running

```bash
npm install
cp .env.example .env.local
npm run dev
```

Opens on http://localhost:5173

Tests: `npm test` runs the price and delivery maths with Node's built-in runner
(nothing extra to install).

## Structure

```
src/
├── main.jsx                  entry point, router provider
├── App.jsx                   route table
├── pages/
│   ├── Home.jsx              landing page: the shop
│   ├── PlantPage.jsx         /<slug> — fetches one plant
│   └── NotFound.jsx
├── components/
│   ├── PlantView.jsx         the plant page design, rendered from API data
│   ├── Gallery.jsx           the photos at the top: a scroll-snap row, dots, mouse drag
│   ├── Catalogue.jsx         the home page shop: every plant with its price, sortable
│   ├── DeliveryCheck.jsx     pincode box on the plant page: gives a delivery date range
│   ├── Icon.jsx              line icons (quick profile, deep dive)
│   └── Leaf.jsx
├── lib/
│   ├── api.js                backend client + token handling
│   ├── commerce.js           prices, stock, the WhatsApp order link, sorting
│   ├── delivery.js           pincode → delivery window (1–3 / 2–5 working days) and dates
│   └── plantFormat.js        light scale, icons, empty plant — shared by page and admin
├── admin/                    the dashboard (not linked from anywhere public)
│   ├── AuthContext.jsx       session state
│   ├── RequireAuth.jsx       route guard
│   ├── admin.css
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── AllPlants.jsx     tab 1: every plant as a card
│   │   ├── AddPlant.jsx      tab 2: new plant
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
    └── plant.css             the plant page
```

## Admin

At `/admin`, behind a single login. It is deliberately not linked from any public page.
Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` configured on the backend. The two tabs
are **All plants** and **Add plant**.

## Plant pages

Every plant uses the same design. `PlantView` renders whatever the API returns and skips
sections that are empty — no scientific name, no quick profile cards, a different set of
Deep Dive points — so a sparse plant still reads as a finished page.

## Deploying

Vercel, with **Root Directory set to `frontend`**.
The Vercel project builds from the repository root using the root `vercel.json`, which rewrites all routes to `index.html` so plant addresses like `/peace-lily` resolve. Production builds call `https://stomatalworld-api.vercel.app` unless `VITE_API_URL` is set. The backend is a separate Vercel project with Root Directory `backend` and its own `backend/vercel.json`.
