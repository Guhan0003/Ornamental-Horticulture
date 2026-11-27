'use strict'

/**
 * A plant's page, for WhatsApp, Google and other link readers.
 *
 * vercel.json sends only those crawlers here. Everyone else — every person
 * scanning a label — gets the ordinary page straight from the CDN, with no
 * function in the way.
 *
 * This takes that same page, looks the plant up, and writes its name, price,
 * description and photo into the <head>. The app still loads from it exactly
 * as before; the crawler just gets something to read before it does.
 */

const {
  DEFAULT_API_URL,
  DEFAULT_SITE_URL,
  injectBody,
  injectMeta,
  plantBodyHtml,
  plantMeta,
  requestOrigin,
} = require('../server/share.js')

const API_URL = (process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '')
const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')

// "bot" is in the name on purpose: the API does not count a visit from anything
// that looks like a crawler, and this is one. Without it every link preview
// would add a view to the plant's scan count.
const USER_AGENT = 'StomatalWorld-share-bot/1.0'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TIMEOUT = 8000

module.exports = async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').toLowerCase()
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  let html
  try {
    const page = await fetch(`${requestOrigin(req.headers, SITE_URL)}/index.html`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!page.ok) throw new Error(`index.html answered ${page.status}`)
    html = await page.text()
  } catch (error) {
    console.error('share: could not read the page', error)
    res.status(502).send('This page could not be loaded. Please try again.')
    return
  }

  // Not the shape of a plant's address (/admin, say): the app decides what to show.
  if (!SLUG.test(slug)) {
    res.status(404).send(html)
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/plants/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
    })

    if (response.status === 404) {
      res.status(404).send(html)
      return
    }
    if (!response.ok) throw new Error(`the API answered ${response.status}`)

    const plant = await response.json()
    const meta = plantMeta(plant, { siteUrl: SITE_URL, apiUrl: API_URL })
    // The tags say what the page is; the body says what it actually reads, so a
    // crawler that runs no JavaScript gets the plant itself and not an empty div.
    const page = injectMeta(html, meta, plant.snap)
    res.status(200).send(injectBody(page, plantBodyHtml(plant, SITE_URL)))
  } catch (error) {
    // A generic preview is better than none, so a slow or sleeping API still
    // gets the crawler the page.
    console.error('share: could not read the plant', slug, error)
    res.status(200).send(html)
  }
}
