# Frontend — Ornamental Horticulture

React 19 + Vite 7 + React Router.

## Running

```bash
npm install
cp .env.example .env.local
npm run dev
```

Opens on http://localhost:5173

## Structure

```
src/
├── main.jsx                  entry point, router provider
├── App.jsx                   route table
├── pages/
│   ├── Home.jsx              landing page with the plant search
│   ├── PlantPage.jsx         /<slug> — fetches one plant
│   └── NotFound.jsx
├── components/
│   ├── PlantView.jsx         the plant page design, rendered from API data
│   ├── PlantSearch.jsx       search box with photo + name suggestions
│   ├── Icon.jsx              line icons (quick profile, deep dive)
│   └── Leaf.jsx
├── lib/
│   ├── api.js                backend client + token handling
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
│       ├── PhotoField.jsx    upload with drag and drop
│       ├── LightLevels.jsx   the 4-step light scale
│       ├── ChipsInput.jsx    landscape and home uses
│       └── DeepDiveEditor.jsx
└── styles/
    ├── index.css             landing page and search
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
`vercel.json` rewrites all routes to `index.html` so `/plant/:slug` resolves.
