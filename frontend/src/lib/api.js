/**
 * Client for the FastAPI backend.
 *
 * Set VITE_API_URL in frontend/.env.local for local development, and in the
 * Vercel project's environment variables for production.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

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
  if (!raw) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}/api/v1${path}`, { ...options, headers })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      // FastAPI validation errors arrive as a list of field problems
      else if (Array.isArray(body.detail)) {
        detail = body.detail.map((e) => `${e.loc?.at(-1) ?? 'field'}: ${e.msg}`).join(', ')
      }
    } catch {
      /* keep the status-line fallback */
    }
    throw new ApiError(response.status, detail)
  }

  return response.status === 204 ? null : response.json()
}

const body = (data) => JSON.stringify(data)

/* ---------------- public ---------------- */

/** One plant with its ordered blocks — what a QR scan resolves to. */
export const getPlant = (slug) => request(`/plants/${slug}`, { auth: true })

export const listPlants = ({ includeDrafts = false } = {}) =>
  request(`/plants${includeDrafts ? '?include_drafts=true' : ''}`, { auth: true })

export const listCategories = () => request('/categories')

/* ---------------- auth ---------------- */

export async function login(email, password) {
  // OAuth2 password flow expects form encoding, not JSON.
  const form = new URLSearchParams({ username: email, password })
  const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })

  if (!response.ok) {
    const detail = response.status === 401 ? 'Incorrect email or password' : 'Could not sign in'
    throw new ApiError(response.status, detail)
  }

  const { access_token } = await response.json()
  setToken(access_token)
  return access_token
}

export const logout = () => setToken(null)

export const getMe = () => request('/auth/me', { auth: true })

/* ---------------- admin: plants ---------------- */

export const createPlant = (data) =>
  request('/plants', { method: 'POST', body: body(data), auth: true })

export const updatePlant = (slug, data) =>
  request(`/plants/${slug}`, { method: 'PATCH', body: body(data), auth: true })

export const deletePlant = (slug) =>
  request(`/plants/${slug}`, { method: 'DELETE', auth: true })

/* ---------------- admin: blocks ---------------- */

export const addBlock = (plantId, block) =>
  request(`/blocks/plant/${plantId}`, { method: 'POST', body: body(block), auth: true })

export const updateBlock = (blockId, block) =>
  request(`/blocks/${blockId}`, { method: 'PATCH', body: body(block), auth: true })

export const deleteBlock = (blockId) =>
  request(`/blocks/${blockId}`, { method: 'DELETE', auth: true })

export const reorderBlocks = (plantId, blockIds) =>
  request(`/blocks/plant/${plantId}/reorder`, {
    method: 'PUT',
    body: body({ block_ids: blockIds }),
    auth: true,
  })

/* ---------------- admin: categories ---------------- */

export const createCategory = (data) =>
  request('/categories', { method: 'POST', body: body(data), auth: true })

export const updateCategory = (id, data) =>
  request(`/categories/${id}`, { method: 'PATCH', body: body(data), auth: true })

export const deleteCategory = (id) =>
  request(`/categories/${id}`, { method: 'DELETE', auth: true })

/* ---------------- admin: media ---------------- */

export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const asset = await request('/media', { method: 'POST', body: form, raw: true, auth: true })
  // The API returns a path like /media/xyz.jpg — make it absolute for <img src>.
  return { ...asset, url: asset.url.startsWith('http') ? asset.url : `${BASE_URL}${asset.url}` }
}

/* ---------------- admin: users ---------------- */

export const listUsers = () => request('/users', { auth: true })

export const createUser = (data) =>
  request('/users', { method: 'POST', body: body(data), auth: true })

export const updateUser = (id, data) =>
  request(`/users/${id}`, { method: 'PATCH', body: body(data), auth: true })

export const deleteUser = (id) => request(`/users/${id}`, { method: 'DELETE', auth: true })
