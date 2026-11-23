'use strict'

/**
 * /sitemap.xml: the home page and every plant, so Google can find them all.
 *
 * Built from the plant list each time (and kept by the CDN for an hour), so a
 * plant added in the dashboard shows up here without a new deploy.
 */

const { DEFAULT_API_URL, DEFAULT_SITE_URL, sitemapXml } = require('../server/share.js')

const API_URL = (process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '')
const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
const USER_AGENT = 'StomatalWorld-share-bot/1.0'

module.exports = async function handler(req, res) {
  try {
    const response = await fetch(`${API_URL}/api/v1/plants`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`the API answered ${response.status}`)

    const plants = await response.json()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.status(200).send(sitemapXml(plants, SITE_URL))
  } catch (error) {
    console.error('sitemap: could not read the plants', error)
    // 503 tells a crawler to come back later, rather than to believe the shop is empty.
    res.setHeader('Retry-After', '600')
    res.status(503).send('The sitemap is not available right now.')
  }
}
