/**
 * Client for the FastAPI backend.
 *
 * Production builds talk to the deployed API and development builds to a
 * local one. Set VITE_API_URL (frontend/.env.local, or the Vercel project's
 * environment variables) to point somewhere else.
 */
const PRODUCTION_API = 'https://stomatalworld-api.vercel.app'
const DEVELOPMENT_API = 'http://localhost:8000'

const BASE_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PRODUCTION_API : DEVELOPMENT_API)
).replace(/\/$/, '')

const TOKEN_KEY = 'stomatalworld.token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { auth = false, raw, ...options } = {}) {
  const headers = { ...options.headers }

  // A content type says what a request is sending, so only a request that sends
  // something gets one. On a plain read it is not just pointless: the API is a
  // different address from the page, and a browser will not send a cross-site
  // request with that header until it has first asked the server's permission in
  // a separate round trip. That cost about a quarter of a second before the plant
  // list or any plant's page could start loading.
  if (!raw && options.body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}/api/v1${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      // FastAPI validation errors arrive as a list of field problems
      else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((e) => `${(e.loc ?? []).filter((part) => part !== 'body').join(' › ')}: ${e.msg}`)
          .join('\n')
      }
    } catch {
      /* keep the status-line fallback */
    }
    throw new ApiError(response.status, detail)
  }

  return response.status === 204 ? null : response.json()
}

const body = (data) => JSON.stringify(data)

/**
 * Where to load an image from. Supabase URLs are already absolute; local
 * development stores paths like /media/x.webp on the API server. The stored
 * value is left untouched, so saving never bakes localhost into the database.
 */
export const imageSrc = (url) => (!url || /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`)

/* ---------------- public ---------------- */

/**
 * Plants already fetched this visit, so tapping a suggestion shows the page
 * at once instead of spending another round trip on a bad connection.
 * Cleared on reload, which is as long as anyone's shop visit lasts.
 */
const visited = new Map()

/**
 * One plant, with everything its page needs.
 *
 * Visitors get a copy the CDN keeps for a minute, which is what makes a QR scan
 * open quickly. The dashboard's editor passes `fresh` so that it always works on
 * what was last saved, never on a copy from a minute ago.
 */
export function getPlant(slug, { fresh = false } = {}) {
  if (!fresh) {
    const cached = visited.get(slug)
    if (cached) return Promise.resolve(cached)
  }

  return request(`/plants/${encodeURIComponent(slug)}${fresh ? '?fresh=1' : ''}`).then((plant) => {
    visited.set(slug, plant)
    return plant
  })
}

/**
 * Warm the cache for a plant we expect to be opened next, quietly.
 *
 * Skipped when the phone says the connection is slow or the visitor asked to
 * save data: on those exact connections an extra request is the problem, not
 * the fix. Failures are ignored — this is an optimisation, not a feature.
 */
export function prefetchPlant(slug) {
  if (visited.has(slug)) return

  const link = navigator.connection
  if (link?.saveData || /2g/.test(link?.effectiveType ?? '')) return

  // Fetching a plant is not counted as a view (a page counts itself when it is
  // shown, see recordView), so nothing needs marking, and with no special header
  // the browser does not have to ask the server's permission first either.
  request(`/plants/${encodeURIComponent(slug)}`)
    .then((plant) => visited.set(slug, plant))
    .catch(() => {})
}

/** A plant's page changed, so what we remembered about it is stale. */
export const forgetPlant = (slug) => visited.delete(slug)

/**
 * Tell the server something happened, without waiting for an answer.
 *
 * A beacon is finished by the browser in the background, even if the page is left
 * in the same moment, and it cannot slow anything down or show anyone an error.
 */
function beacon(path) {
  const url = `${BASE_URL}/api/v1${path}`
  try {
    if (navigator.sendBeacon?.(url)) return
    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    /* counting is never worth a broken page */
  }
}

/** Count one press of a plant's WhatsApp order button. */
export const recordTap = (slug) => beacon(`/plants/${encodeURIComponent(slug)}/tap`)

// Plants already counted during this page's life, so shuffling back and forth
// between pages in one visit is one scan, as it was when scans were counted by
// fetching the data (which a visit did once per plant).
const counted = new Set()

/**
 * Count a plant's page as shown to someone: this is a scan.
 *
 * Called once the page is on screen. It used to be counted by the request that
 * fetched the plant's data, but that data is now kept at the CDN for speed, and a
 * request the CDN answers never reaches the server to be counted.
 */
export function recordView(slug) {
  if (counted.has(slug)) return
  counted.add(slug)
  beacon(`/plants/${encodeURIComponent(slug)}/view`)
}

/**
 * Every plant, A–Z, as small summaries.
 *
 * Visitors get a copy the CDN keeps for a minute, which is what makes the shop
 * open quickly. The dashboard passes `fresh` so that what has just been saved is
 * never hidden behind it.
 */
export const listPlants = ({ fresh = false } = {}) => request(fresh ? '/plants?fresh=1' : '/plants')

/* ---------------- auth ---------------- */

export async function login(email, password) {
  // OAuth2 password flow expects form encoding, not JSON.
  const form = new URLSearchParams({ username: email, password })
  let response
  try {
    response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 401) throw new ApiError(401, 'Incorrect email or password')

    // The lockout after repeated wrong guesses says how long to wait, which
    // is the one thing worth repeating back; anything else gets a plain line.
    let detail = 'Could not sign in'
    if (response.status === 429) {
      try {
        const body = await response.json()
        if (typeof body.detail === 'string') detail = body.detail
      } catch {
        detail = 'Too many failed sign-in attempts. Try again later.'
      }
    }
    throw new ApiError(response.status, detail)
  }

  const { access_token } = await response.json()
  setToken(access_token)
  return access_token
}

export const logout = () => setToken(null)

export const getMe = () => request('/auth/me', { auth: true })

/* ---------------- admin ---------------- */

export const createPlant = (data) =>
  request('/plants', { method: 'POST', body: body(data), auth: true })

export function updatePlant(slug, data) {
  // What we remembered about this plant is now out of date.
  forgetPlant(slug)
  return request(`/plants/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: body(data),
    auth: true,
  })
}

export function deletePlant(slug) {
  forgetPlant(slug)
  return request(`/plants/${encodeURIComponent(slug)}`, { method: 'DELETE', auth: true })
}

/** How often each plant has been looked at. Admin only. */
export const listViewCounts = (days = 30) => request(`/views?days=${days}`, { auth: true })

/** Upload a photo; returns { url, placeholder, background, width, height, size_bytes }. */
export function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/media', { method: 'POST', body: form, raw: true, auth: true })
}
