# Ornamental Horticulture

**by StomatalWorld**

A Wikipedia-style reference page for ornamental plants. Every plant in the store carries a
QR code — scan it and land straight on that plant's page.

See [PROJECT_STATEMENT.md](PROJECT_STATEMENT.md) for the full problem statement and roadmap.

## Status

Pre-launch. This repo currently holds the placeholder landing page.
Target: **live within a month.**

## Stack

React 19 + Vite 7. No backend yet.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Other commands

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Deploying

Configured for Vercel. It auto-detects Vite — no settings to change.
`vercel.json` rewrites all routes to `index.html` so that per-plant URLs
(e.g. `/plant/monstera-deliciosa`) work once routing is added.

## Layout

```
index.html            page shell, fonts, meta
src/main.jsx          React entry point
src/App.jsx           landing page
src/index.css         styles
PROJECT_STATEMENT.md  what this is and why
```
