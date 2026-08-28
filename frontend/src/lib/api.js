/**
 * Client for the FastAPI backend.
 *
 * Set VITE_API_URL in frontend/.env.local for local development, and in the
 * Vercel project's environment variables for production.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json()
}

/** One plant with its ordered content blocks — what a QR scan resolves to. */
export const getPlant = (slug) => request(`/plants/${slug}`)

export const listPlants = () => request('/plants')

export const listCategories = () => request('/categories')
