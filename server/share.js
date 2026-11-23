'use strict'

/**
 * What a link to a plant looks like when it is pasted into WhatsApp, or found by
 * Google.
 *
 * The site is a single page that fills itself in with JavaScript, and neither
 * WhatsApp nor most crawlers run JavaScript. Left alone, every plant's link
 * shows the same title and no photo. These functions take the page the browser
 * would get and write the plant's own name, price, description and photo into
 * its <head>, so the link says what it is.
 *
 * Nothing here touches the network or the page. That keeps it easy to test, and
 * leaves the two functions in /api (which do fetch) as thin as possible.
 */

const SITE_NAME = 'StomatalWorld'
const DEFAULT_SITE_URL = 'https://stomatalworld.vercel.app'
const DEFAULT_API_URL = 'https://stomatalworld-api.vercel.app'

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** 44900 → "₹449", 7550 → "₹75.50". The same rule the shop pages use. */
function formatPrice(minor, currency = 'INR') {
  if (minor == null) return ''
  const digits = minor % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100)
}

/** One line of at most `max` characters, cut at a word, with an ellipsis. */
function clip(text, max) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat

  const cut = flat.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  const trimmed = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${trimmed.replace(/[\s,;:.\-–—]+$/, '')}…`
}

/** The API hands back full links in production, and paths when run locally. */
const absoluteUrl = (url, apiUrl) => (/^https?:\/\//.test(url || '') ? url : `${apiUrl}${url || ''}`)

/** Everything a link preview or a search result needs to know about a plant. */
function plantMeta(plant, { siteUrl = DEFAULT_SITE_URL, apiUrl = DEFAULT_API_URL } = {}) {
  const soldOut = plant.availability === 'sold_out'
  const price = formatPrice(plant.price_minor, plant.currency)

  let ogTitle = plant.common_name
  if (soldOut) ogTitle += ' — Sold out'
  else if (price && plant.availability !== 'ask') ogTitle += ` — ${price}`

  return {
    slug: plant.slug,
    // Same shape the page itself sets once it has loaded.
    title: `${plant.common_name} — ${SITE_NAME}`,
    ogTitle,
    description: clip(plant.snap, 180),
    url: `${siteUrl}/${plant.slug}`,
    image: absoluteUrl(plant.image && plant.image.url, apiUrl),
    imageAlt: (plant.image && plant.image.alt) || plant.common_name,
    priceMinor: plant.price_minor,
    currency: plant.currency || 'INR',
    availability: plant.availability,
    scientificName: plant.scientific_name || '',
  }
}

/** A schema.org Product, so a search result can show the price and stock. */
function productJsonLd(meta, snap) {
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: meta.ogTitle.split(' — ')[0],
    sku: meta.slug,
    url: meta.url,
    description: clip(snap, 300),
  }
  if (meta.image) product.image = [meta.image]

  // "Ask us" means there is no firm price to promise, so say nothing about one.
  if (meta.priceMinor != null && meta.availability !== 'ask') {
    product.offers = {
      '@type': 'Offer',
      url: meta.url,
      price: (meta.priceMinor / 100).toFixed(2),
      priceCurrency: meta.currency,
      availability:
        meta.availability === 'sold_out'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
    }
  }
  return product
}

/** JSON that is safe to put inside a <script> element. */
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

// The tags a plant's own page replaces, wherever the base page put them.
const REPLACED_TAGS = [
  /<title>[\s\S]*?<\/title>/i,
  /<meta\s+name="description"[\s\S]*?\/>/gi,
  /<meta\s+property="og:[^"]*"[\s\S]*?\/>/gi,
  /<meta\s+name="twitter:[^"]*"[\s\S]*?\/>/gi,
  /<link\s+rel="canonical"[^>]*>/gi,
]

/**
 * Put a plant's tags into the page's <head>.
 *
 * The tags the base page already has are taken out first, so a crawler finds
 * exactly one title, one description and one image, and they are the plant's.
 */
function injectMeta(html, meta, snap) {
  let page = html
  for (const tag of REPLACED_TAGS) page = page.replace(tag, '')

  const e = escapeHtml
  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.url)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${e(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    meta.image ? `<meta property="og:image" content="${e(meta.image)}" />` : '',
    meta.image ? `<meta property="og:image:alt" content="${e(meta.imageAlt)}" />` : '',
    meta.priceMinor != null && meta.availability !== 'ask'
      ? `<meta property="product:price:amount" content="${(meta.priceMinor / 100).toFixed(2)}" />\n    <meta property="product:price:currency" content="${e(meta.currency)}" />`
      : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${jsonForScript(productJsonLd(meta, snap))}</script>`,
  ].filter(Boolean)

  return page.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
}

/** sitemap.xml: the home page and every plant, with the day it last changed. */
function sitemapXml(plants, siteUrl = DEFAULT_SITE_URL) {
  const entry = (loc, lastmod) =>
    `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`

  const newest = plants.map((p) => (p.updated_at || '').slice(0, 10)).sort().pop()
  const urls = [
    entry(`${siteUrl}/`, newest),
    ...plants.map((p) => entry(`${siteUrl}/${p.slug}`, (p.updated_at || '').slice(0, 10))),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

module.exports = {
  DEFAULT_API_URL,
  DEFAULT_SITE_URL,
  SITE_NAME,
  absoluteUrl,
  clip,
  escapeHtml,
  formatPrice,
  injectMeta,
  plantMeta,
  productJsonLd,
  sitemapXml,
}
