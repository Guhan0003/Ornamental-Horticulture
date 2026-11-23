'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  clip,
  escapeHtml,
  formatPrice,
  injectMeta,
  plantMeta,
  productJsonLd,
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
