# Brand assets — StomatalWorld

## Colours

| Token | Hex | Use |
|---|---|---|
| Forest | `#0c1f14` | Brand dark. Backgrounds, and the logo on light surfaces. |
| Green | `#7fd6a2` | Accent. The leaf mark on dark surfaces. |
| Cream | `#f2efe4` | Brand light. Text on dark surfaces. |

## Typeface

**Fraunces** (SIL Open Font License) — the wordmark is Fraunces at optical size 144,
weight 600.

In these files the wordmark is **converted to vector outlines**, so the logo renders
identically everywhere and needs no font installed.

## Files

### Vector — use these wherever possible

| File | What |
|---|---|
| `logo-mark-forest.svg` | Leaf alone, forest green — for light backgrounds |
| `logo-mark-green.svg` | Leaf alone, accent green — for dark backgrounds |
| `logo-mark-cream.svg` | Leaf alone, cream — for photos or coloured backgrounds |
| `logo-lockup-forest.svg` | Leaf + StomatalWorld, all forest — for light backgrounds |
| `logo-lockup-dark-bg.svg` | Green leaf + cream wordmark — for dark backgrounds |

### Raster — `png/`, transparent background

Mark: 1024px and 2048px square.
Lockup: 2048px and 4096px wide (roughly 5.85:1).

Use the largest that fits and scale down. Never scale a PNG up — go back to the SVG.

## Website icons

Live in `frontend/public/`, wired up in `frontend/index.html`:

- `favicon.svg` — scalable, preferred by modern browsers
- `favicon-32.png` — fallback
- `apple-touch-icon.png` — 180px, iOS home screen
- `favicon-192.png`, `favicon-512.png` — Android / PWA, via `site.webmanifest`

These use a solid forest square with the green leaf, so the icon stays visible against
both light and dark browser chrome.

## Regenerating

The wordmark outlines were produced by instantiating the Fraunces variable font at
`opsz=144, wght=600, SOFT=0, WONK=0` and extracting glyph paths with `fontTools`.
The PNGs were rendered from the SVGs with `sharp` at 600 DPI.
