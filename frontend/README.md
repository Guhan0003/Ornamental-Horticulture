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
├── main.jsx              entry point, router provider
├── App.jsx               route table
├── pages/
│   ├── Home.jsx          landing page
│   ├── PlantPage.jsx     /plant/:slug — the QR-code target
│   └── NotFound.jsx
├── components/
│   ├── Leaf.jsx
│   └── blocks/           renderers for the dynamic page format
│       ├── BlockRenderer.jsx   dispatches on block.type
│       ├── Heading.jsx
│       ├── Text.jsx
│       ├── Image.jsx
│       ├── Gallery.jsx
│       └── Facts.jsx     care details (light, water, soil, pet safety)
├── lib/
│   └── api.js            backend client
└── styles/
    └── index.css
```

## The dynamic page format

A plant page is **not** a fixed template. The backend returns an ordered list of
blocks and `BlockRenderer` maps each one to a component. To support a new kind of
section, add a component in `components/blocks/` and register it in
`BlockRenderer.jsx` — no page rewrite needed.

Unknown block types are skipped rather than thrown, so an admin saving a block type
the deployed frontend doesn't know about yet degrades gracefully instead of showing
a blank page to someone standing in a store.

## Deploying

Vercel, with **Root Directory set to `frontend`**.
`vercel.json` rewrites all routes to `index.html` so `/plant/:slug` resolves.
