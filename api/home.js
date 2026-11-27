'use strict'

/**
 * The home page, for Google and other crawlers that do not run JavaScript.
 *
 * The site draws itself in the browser, so the HTML it serves is an empty div.
 * A person never notices; a crawler sees a page with nothing on it, and has to
 * come back later to render it before it can read anything. This is the page
 * that answers a search for the shop's own name, so that delay is the one that
 * matters most.
 *
 * vercel.json sends only crawlers here — the rule is `/` on its own, because the
 * rule for plants wants a path with something in it and never matches the front
 * door. Everyone else gets the ordinary page from the CDN with nothing in the
 * way.
 *
 * This takes that same page and writes the shop into it: every plant, its price
 * and a link to its own page. Those links are also how a crawler walks from the
 * front door to all of the plants, rather than trusting the sitemap alone.
 */

const {
  DEFAULT_API_URL,
  DEFAULT_SITE_URL,
  injectBody,
  requestOrigin,
  shopBodyHtml,
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
    console.error('home: could not read the page', error)
    res.status(502).send('This page could not be loaded. Please try again.')
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/plants`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!response.ok) throw new Error(`the API answered ${response.status}`)

    const plants = await response.json()
    res.status(200).send(injectBody(html, shopBodyHtml(plants, SITE_URL)))
  } catch (error) {
    // The page's own tags still describe the shop, and a browser would fill the
    // rest in, so a sleeping API costs the crawler the plant list and nothing more.
    console.error('home: could not read the plants', error)
    res.status(200).send(html)
  }
}
