'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  clip,
  escapeHtml,
  formatPrice,
  injectMeta,
  injectOrderMeta,
  orderMeta,
  parseOrder,
  plantMeta,
  productJsonLd,
  requestOrigin,
  sitemapXml,
} = require('./share.js')

const SITE = 'https://shop.example'
const API = 'https://api.example'

const BASE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Ornamental Horticulture — StomatalWorld</title>
    <meta
      name="description"
      content="The generic site description."
    />
    <meta property="og:title" content="Generic title" />
    <meta property="og:image" content="https://shop.example/og-image.png" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="https://shop.example/" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "StomatalWorld"
      }
    </script>
  </head>
  <body><div id="root"></div></body>
</html>`

const birkin = {
  slug: 'philodendron-birkin',
  common_name: 'Philodendron Birkin',
  scientific_name: "Philodendron 'Birkin'",
  snap: 'A compact, self-heading Philodendron whose dark leaves carry fine creamy pinstripes.',
  price_minor: 44900,
  currency: 'INR',
  availability: 'in_stock',
  image: { url: 'https://img.example/birkin.webp', alt: 'Birkin leaves' },
  updated_at: '2026-11-10T13:36:54.455454Z',
}

const meta = (plant = birkin) => plantMeta(plant, { siteUrl: SITE, apiUrl: API })

test('prices read the way the shop pages show them', () => {
  assert.equal(formatPrice(44900), '₹449')
  assert.equal(formatPrice(7550), '₹75.50')
  assert.equal(formatPrice(null), '')
})

test('clip cuts at a word and adds an ellipsis only when it had to cut', () => {
  assert.equal(clip('short text', 50), 'short text')
  const cut = clip('one two three four five six seven', 20)
  assert.ok(cut.length <= 20)
  assert.ok(cut.endsWith('…'))
  assert.ok(!cut.includes('  '))
})

test('escapeHtml neutralises anything that could break out of an attribute', () => {
  assert.equal(escapeHtml(`"><script>x</script>`), '&quot;&gt;&lt;script&gt;x&lt;/script&gt;')
})

test('the preview title carries the price, or says sold out, or says nothing about price', () => {
  assert.equal(meta().ogTitle, 'Philodendron Birkin — ₹449')
  assert.equal(meta({ ...birkin, availability: 'sold_out' }).ogTitle, 'Philodendron Birkin — Sold out')
  assert.equal(meta({ ...birkin, availability: 'ask' }).ogTitle, 'Philodendron Birkin')
  assert.equal(meta({ ...birkin, price_minor: null }).ogTitle, 'Philodendron Birkin')
})

test('the page title matches the one the page sets itself once loaded', () => {
  assert.equal(meta().title, 'Philodendron Birkin — StomatalWorld')
})

test('a photo path from the local API is made into a full link', () => {
  const local = meta({ ...birkin, image: { url: '/media/birkin.webp', alt: '' } })
  assert.equal(local.image, 'https://api.example/media/birkin.webp')
  assert.equal(local.imageAlt, 'Philodendron Birkin')
})

test('injecting leaves exactly one title, description, canonical and image', () => {
  const page = injectMeta(BASE, meta(), birkin.snap)

  assert.equal((page.match(/<title>/g) || []).length, 1)
  assert.match(page, /<title>Philodendron Birkin — StomatalWorld<\/title>/)
  assert.equal((page.match(/name="description"/g) || []).length, 1)
  assert.equal((page.match(/rel="canonical"/g) || []).length, 1)
  assert.equal((page.match(/property="og:image"/g) || []).length, 1)
  assert.equal((page.match(/name="twitter:card"/g) || []).length, 1)

  // The base page says who the shop is; a plant's page says what the plant is.
  // Two blocks would describe one page as both, so the first is taken out.
  assert.equal((page.match(/application\/ld\+json/g) || []).length, 1)
  assert.ok(!page.includes('"@type": "Organization"'))

  assert.ok(!page.includes('The generic site description'))
  assert.ok(!page.includes('Generic title'))
  assert.ok(!page.includes('og-image.png'))

  assert.match(page, /og:title" content="Philodendron Birkin — ₹449"/)
  assert.match(page, /og:image" content="https:\/\/img\.example\/birkin\.webp"/)
  assert.match(page, /href="https:\/\/shop\.example\/philodendron-birkin"/)
  assert.match(page, /product:price:amount" content="449\.00"/)

  // The rest of the page is untouched, so the app still loads from it.
  assert.match(page, /<div id="root"><\/div>/)
  assert.match(page, /<meta charset="UTF-8" \/>/)
})

test('a plant name with quotes or tags cannot break the page', () => {
  const nasty = { ...birkin, common_name: `Evil "><script>alert(1)</script>`, snap: `x "quoted" <b>` }
  const page = injectMeta(BASE, meta(nasty), nasty.snap)

  assert.ok(!page.includes('<script>alert(1)</script>'))
  assert.ok(!/content="Evil "/.test(page))
})

test('the structured data is valid JSON and cannot close its own script tag', () => {
  const tricky = { ...birkin, snap: 'a </script><script>alert(1)</script> b' }
  const page = injectMeta(BASE, meta(tricky), tricky.snap)

  const block = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(block, 'the data block is there and ends where it should')
  const parsed = JSON.parse(block[1])
  assert.equal(parsed['@type'], 'Product')
  assert.equal(parsed.description.includes('alert(1)'), true)
  assert.ok(!block[1].includes('</script>'))
})

test('the structured data carries price and stock, and drops them when there is no firm price', () => {
  const inStock = productJsonLd(meta(), birkin.snap)
  assert.equal(inStock.offers.price, '449.00')
  assert.equal(inStock.offers.priceCurrency, 'INR')
  assert.equal(inStock.offers.availability, 'https://schema.org/InStock')

  const soldOut = productJsonLd(meta({ ...birkin, availability: 'sold_out' }), birkin.snap)
  assert.equal(soldOut.offers.availability, 'https://schema.org/OutOfStock')

  assert.equal(productJsonLd(meta({ ...birkin, availability: 'ask' }), birkin.snap).offers, undefined)
  assert.equal(productJsonLd(meta({ ...birkin, price_minor: null }), birkin.snap).offers, undefined)
})

test('a plant with no price gets no price tags', () => {
  const page = injectMeta(BASE, meta({ ...birkin, price_minor: null }), birkin.snap)
  assert.ok(!page.includes('product:price'))
})

test('the sitemap lists the home page and every plant with its last change', () => {
  const xml = sitemapXml(
    [birkin, { slug: 'peace-lily', updated_at: '2026-11-12T08:00:00Z' }],
    SITE,
  )

  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<loc>https:\/\/shop\.example\/<\/loc><lastmod>2026-11-12<\/lastmod>/)
  assert.match(xml, /<loc>https:\/\/shop\.example\/philodendron-birkin<\/loc><lastmod>2026-11-10<\/lastmod>/)
  assert.match(xml, /<loc>https:\/\/shop\.example\/peace-lily<\/loc><lastmod>2026-11-12<\/lastmod>/)
  assert.equal((xml.match(/<url>/g) || []).length, 3)
})

test('an empty shop still gives a valid sitemap with just the home page', () => {
  const xml = sitemapXml([], SITE)
  assert.equal((xml.match(/<url>/g) || []).length, 1)
  assert.ok(!xml.includes('<lastmod>'))
})

/* ---------------- an order's link preview ---------------- */

const shopList = [
  { ...birkin, slug: 'philodendron-birkin', price_minor: 44900, currency: 'INR', availability: 'in_stock', image: { url: 'https://img.example/birkin.webp', alt: 'A Birkin' } },
  { slug: 'neon-pothos', common_name: 'Neon Pothos', price_minor: 29900, currency: 'INR', availability: 'in_stock', image: { url: '/media/neon.webp' } },
  { slug: 'peace-lily', common_name: 'Peace Lily', price_minor: null, currency: 'INR', availability: 'in_stock', image: { url: 'https://img.example/lily.webp' } },
  { slug: 'gone-plant', common_name: 'Gone Plant', price_minor: 10000, currency: 'INR', availability: 'sold_out', image: { url: 'https://img.example/gone.webp' } },
]

test('an order link is read the same way the page reads it', () => {
  assert.deepEqual(parseOrder('philodendron-birkin.2,neon-pothos'), [
    { slug: 'philodendron-birkin', qty: 2 },
    { slug: 'neon-pothos', qty: 1 },
  ])
  assert.deepEqual(parseOrder('a-plant.2,a-plant.5,b-plant.0,c-plant.99,d-plant.x'), [
    { slug: 'a-plant', qty: 2 },
    { slug: 'b-plant', qty: 1 },
    { slug: 'c-plant', qty: 9 },
    { slug: 'd-plant', qty: 1 },
  ])
  assert.deepEqual(parseOrder('../etc/passwd,<script>,with space,a.b.c,'), [])
  assert.deepEqual(parseOrder(undefined), [])
  assert.equal(parseOrder(Array.from({ length: 40 }, (_, n) => `plant-${n}`).join(',')).length, 15)
})

test('the card says how many plants and what they come to, with the first plant’s photo', () => {
  const meta = orderMeta(parseOrder('philodendron-birkin.2,neon-pothos'), shopList, { siteUrl: SITE, apiUrl: API })

  assert.equal(meta.ogTitle, 'Plant order — 2 plants · ₹1,197')
  assert.equal(meta.image, 'https://img.example/birkin.webp')
  assert.equal(meta.imageAlt, 'A Birkin')
  assert.equal(meta.url, `${SITE}/order?p=philodendron-birkin.2,neon-pothos`)
  assert.ok(meta.description.startsWith('Philodendron Birkin × 2, Neon Pothos.'))
})

test('a plant with no price says the total is not all of it', () => {
  const meta = orderMeta(parseOrder('neon-pothos,peace-lily'), shopList, { siteUrl: SITE, apiUrl: API })
  assert.equal(meta.ogTitle, 'Plant order — 2 plants · ₹299 + more')
})

test('with no priced plant there is no total in the title', () => {
  assert.equal(orderMeta(parseOrder('peace-lily'), shopList).ogTitle, 'Plant order — 1 plant')
})

test('a plant that is sold out or gone is left out, as it is on the page', () => {
  const meta = orderMeta(parseOrder('gone-plant,neon-pothos,not-in-the-shop'), shopList, { siteUrl: SITE, apiUrl: API })

  assert.equal(meta.ogTitle, 'Plant order — 1 plant · ₹299')
  assert.ok(!meta.description.includes('Gone'))
  assert.equal(meta.image, `${API}/media/neon.webp`)
})

test('an order with nothing left in it still gives a plain card', () => {
  const meta = orderMeta(parseOrder('gone-plant'), shopList)
  assert.equal(meta.ogTitle, 'Plant order')
  assert.equal(meta.image, '')
})

test('a long order names the first four and counts the rest', () => {
  const many = Array.from({ length: 6 }, (_, n) => ({ ...shopList[1], slug: `p-${n}`, common_name: `Plant ${n}` }))
  const meta = orderMeta(parseOrder(many.map((p) => p.slug).join(',')), many)
  assert.ok(meta.description.startsWith('Plant 0, Plant 1, Plant 2, Plant 3 and 2 more.'))
})

test('the order’s tags replace the generic ones, and say not to list it', () => {
  const meta = orderMeta(parseOrder('philodendron-birkin.2,neon-pothos'), shopList, { siteUrl: SITE, apiUrl: API })
  const page = injectOrderMeta(BASE, meta)

  assert.equal((page.match(/<title>/g) || []).length, 1)
  assert.equal((page.match(/property="og:title"/g) || []).length, 1)
  assert.equal((page.match(/property="og:image"/g) || []).length, 1)
  assert.equal((page.match(/rel="canonical"/g) || []).length, 1)
  assert.ok(page.includes('<meta name="robots" content="noindex" />'))
  assert.ok(page.includes('content="Plant order — 2 plants · ₹1,197"'))
  assert.ok(page.includes('content="https://img.example/birkin.webp"'))
  assert.ok(!page.includes('Generic title'))
})

test('a plant name with quotes or tags cannot break the order’s card', () => {
  const odd = [{ ...shopList[1], slug: 'odd', common_name: '"><script>alert(1)</script>' }]
  const page = injectOrderMeta(BASE, orderMeta(parseOrder('odd'), odd))

  assert.ok(!page.includes('<script>alert'))
})

test('the address a request arrived on is used only if it looks like an address', () => {
  assert.equal(requestOrigin({ host: 'shop.example' }, 'https://fallback.example'), 'https://shop.example')
  assert.equal(
    requestOrigin({ 'x-forwarded-host': 'a.example, b.example', 'x-forwarded-proto': 'http' }),
    'http://a.example',
  )
  assert.equal(requestOrigin({ host: 'evil.example/../x' }, 'https://fallback.example'), 'https://fallback.example')
  assert.equal(requestOrigin({ host: 'shop.example', 'x-forwarded-proto': 'javascript' }, 'https://fb.example'), 'https://fb.example')
})

test('only crawlers are sent to the order card, and before the rule for plants', () => {
  const { rewrites } = JSON.parse(require('node:fs').readFileSync(`${__dirname}/../vercel.json`, 'utf8'))
  const order = rewrites.findIndex((rule) => rule.source === '/order')
  const plant = rewrites.findIndex((rule) => rule.source.startsWith('/:slug'))

  assert.ok(order >= 0 && plant >= 0)
  // "order" looks like any plant's address, so whichever comes first wins.
  assert.ok(order < plant)
  assert.equal(rewrites[order].destination, '/api/order')
  assert.equal(rewrites[order].has[0].value, rewrites[plant].has[0].value)

  const crawler = new RegExp(`^${rewrites[order].has[0].value}$`)
  assert.ok(crawler.test('WhatsApp/2.23.20.0 A'))
  assert.ok(!crawler.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1'))
})

/* ---------------- the words a crawler gets, since the page draws itself ---------------- */

const { injectBody, plantBodyHtml, shopBodyHtml } = require('./share.js')

const fullBirkin = {
  ...birkin,
  price_note: 'with white decor pot',
  profile: {
    environment: 'Indoor',
    light: { label: 'Bright indirect light', note: 'No direct sun' },
  },
  deep_dive: [
    { icon: 'origin', title: 'Origin & Habit', body: 'A cultivated sport of Philodendron.' },
    { icon: 'water', title: 'Key Care Rule', body: 'Let the top inch dry out.' },
  ],
  related: [{ slug: 'neon-pothos', common_name: 'Neon Pothos' }],
}

test('the body a crawler gets is the page’s own words, not an empty div', () => {
  const page = injectBody(BASE, plantBodyHtml(fullBirkin, SITE))

  assert.ok(!page.includes('<div id="root"></div>'))
  assert.ok(page.includes('<h1>Philodendron Birkin</h1>'))
  assert.ok(page.includes('₹449'))
  assert.ok(page.includes('with white decor pot'))
  assert.ok(page.includes('A compact, self-heading Philodendron'))
  // Every Deep Dive point, in the order the page shows them.
  assert.ok(page.indexOf('Origin &amp; Habit') < page.indexOf('Key Care Rule'))
  assert.ok(page.includes('Let the top inch dry out.'))
  assert.ok(page.includes('Bright indirect light'))
})

test('a plant links on to the ones it suggests, so a crawler can walk the shop', () => {
  const body = plantBodyHtml(fullBirkin, SITE)

  assert.ok(body.includes(`<a href="${SITE}/neon-pothos">Neon Pothos</a>`))
  assert.ok(body.includes(`<a href="${SITE}/">All plants at StomatalWorld</a>`))
})

test('the home page lists every plant, priced, sold out or on request', () => {
  const body = shopBodyHtml(shopList, SITE)

  for (const plant of shopList) {
    assert.ok(body.includes(`href="${SITE}/${plant.slug}"`), `${plant.slug} is not linked`)
    assert.ok(body.includes(plant.common_name), `${plant.common_name} is missing`)
  }
  assert.ok(body.includes('₹449'))
  assert.ok(body.includes('Price on request'))
  assert.ok(body.includes('Sold out'))
  // A sold-out plant shows that it is, rather than a price it cannot be had at.
  assert.ok(!body.includes('₹100'))
})

test('a plant named with markup cannot write its own HTML into the page', () => {
  const nasty = { ...shopList[1], common_name: '<script>alert(1)</script>', scientific_name: '"><b>x' }
  const body = shopBodyHtml([nasty], SITE)

  assert.ok(!body.includes('<script>'))
  assert.ok(!body.includes('<b>'))
  assert.ok(body.includes('&lt;script&gt;'))
})

test('only crawlers are sent to the home card, and the rule is the bare address', () => {
  const { rewrites } = JSON.parse(require('node:fs').readFileSync(`${__dirname}/../vercel.json`, 'utf8'))
  const home = rewrites.findIndex((rule) => rule.source === '/')
  const everythingElse = rewrites.findIndex((rule) => rule.source === '/(.*)')

  assert.ok(home >= 0, 'the home page has no rule of its own')
  assert.equal(rewrites[home].destination, '/api/home')
  // "/:path*" and "/:slug(...)" both want a segment, so the front door needs its own.
  assert.ok(home < everythingElse)

  const crawler = new RegExp(`^${rewrites[home].has[0].value}$`)
  assert.ok(crawler.test('Googlebot/2.1 (+http://www.google.com/bot.html)'))
  assert.ok(!crawler.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1'))
})

test('the old address redirects from its front door as well as its plant pages', () => {
  const { redirects } = JSON.parse(require('node:fs').readFileSync(`${__dirname}/../vercel.json`, 'utf8'))
  const old = 'stomatalworld.vercel.app'
  const sources = redirects.filter((rule) => rule.has[0].value === old).map((rule) => rule.source)

  // The bare "/" is the one a person types, and "/:path*" does not match it.
  assert.ok(sources.includes('/'), 'the old home page does not redirect')
  assert.ok(sources.includes('/:path*'), 'the old inner pages do not redirect')
  for (const rule of redirects) assert.equal(rule.permanent, true)
})
