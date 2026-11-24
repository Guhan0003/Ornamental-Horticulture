'use strict'

/**
 * An order's page, for WhatsApp and other link readers.
 *
 * A customer's "My list" message ends with a link to /order?p=... , a page that shows
 * every plant they chose with its photo. WhatsApp does not run JavaScript, so left
 * alone that link would show the same generic card as the home page. This writes
 * what the order really is into the page's <head>: how many plants, what they come
 * to, their names, and the first plant's photo.
 *
 * vercel.json sends only those crawlers here; a person opening the link gets the
 * ordinary page from the CDN with nothing in the way. The page itself reads the same
 * link, so the card and the page always describe the same order.
 */

const {
  DEFAULT_API_URL,
  DEFAULT_SITE_URL,
  injectOrderMeta,
  orderMeta,
  parseOrder,
  requestOrigin,
} = require('../server/share.js')

const API_URL = (process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '')
const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')

// "bot" is in the name so the API never mistakes this for a person (see api/plant.js).
const USER_AGENT = 'StomatalWorld-share-bot/1.0'
const TIMEOUT = 8000

module.exports = async function handler(req, res) {
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
    console.error('order: could not read the page', error)
    res.status(502).send('This page could not be loaded. Please try again.')
    return
  }

  try {
    const wanted = parseOrder(req.query && req.query.p)
    if (wanted.length === 0) {
      res.status(200).send(html)
      return
    }

    const response = await fetch(`${API_URL}/api/v1/plants`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!response.ok) throw new Error(`the API answered ${response.status}`)

    const plants = await response.json()
    const meta = orderMeta(wanted, plants, { siteUrl: SITE_URL, apiUrl: API_URL })
    res.status(200).send(injectOrderMeta(html, meta))
  } catch (error) {
    // A generic card is better than none, so a slow or sleeping API still gets the
    // crawler the page.
    console.error('order: could not read the plants', error)
    res.status(200).send(html)
  }
}
