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

## Instagram

Live in `instagram/`. 1080×1080, solid forest square, green leaf. Instagram crops profile
pictures to a circle, so the artwork stays well inside the middle and the corners are
plain forest.

- `instagram-profile-mark` — the leaf alone. Use this one: it stays clear down to the
  32px size used in comments.
- `instagram-profile-name` — leaf over the StomatalWorld wordmark. Fine at the 110px
  profile size, but the name is unreadable below about 80px.

The `.svg` files are the source; the `-1080.png` files are what to upload.

## QR codes

`instagram/qr-philodendron-pink-princess.svg` (and its PNG) is the one QR code made so
far, by hand, for a post. **It encodes the old address**,
`https://stomatalworld.vercel.app/philodendron-pink-princess`, which still resolves — so
it works, and anything already printed from it keeps working. Any new one should encode
the domain instead: `https://www.stomatalworld.app/<slug>`. Generating them for the whole
catalogue is Phase 2 in the [README](../README.md#phases).

## Regenerating

The wordmark outlines were produced by instantiating the Fraunces variable font at
`opsz=144, wght=600, SOFT=0, WONK=0` and extracting glyph paths with `fontTools`.
The PNGs were rendered from the SVGs with `sharp` at 600 DPI.
