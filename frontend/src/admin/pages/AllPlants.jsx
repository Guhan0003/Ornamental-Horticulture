import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../lib/api.js'
import { formatPrice, isSoldOut } from '../../lib/commerce.js'

const matches = (plant, query) =>
  [plant.common_name, plant.scientific_name, plant.slug].some((value) =>
    value.toLowerCase().includes(query),
  )

/**
 * "34 scans · 5 WhatsApp taps in 30 days", plus today's scans when the page is
 * being watched. A scan is the page being opened; a tap is the order button on it
 * being pressed, so the pair says which plants people look at and which they ask about.
 */
const viewsLabel = ({ recent, today, taps_recent: taps = 0 }) => {
  const scans = `${recent} scan${recent === 1 ? '' : 's'}`
  const asked = `${taps} WhatsApp tap${taps === 1 ? '' : 's'}`
  return today > 0 ? `${scans} · ${asked} in 30 days · ${today} today` : `${scans} · ${asked} in 30 days`
}

const updatedLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Tab 1: everything in the database. */
export default function AllPlants() {
  const [plants, setPlants] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [views, setViews] = useState({})

  useEffect(() => {
    // Fresh, not the copy the shop is shown: after saving a plant, this list
    // must say so straight away.
    api
      .listPlants({ fresh: true })
      .then(setPlants)
      .catch((e) => setError(e.message))

    // Scan counts are a nice-to-have on this page: if they don't arrive, the
    // list still works and simply doesn't mention them.
    api
      .listViewCounts()
      .then((rows) => setViews(Object.fromEntries(rows.map((row) => [row.slug, row]))))
      .catch(() => {})
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (plants ?? []).filter((plant) => !q || matches(plant, q))
  }, [plants, query])

  if (error) return <p className="form__error" role="alert">{error}</p>
  if (!plants) return <div className="admin-loading">Loading plants…</div>

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>All plants</h1>
          <p className="admin__sub">
            {plants.length} {plants.length === 1 ? 'plant' : 'plants'} live on the site
          </p>
        </div>
        <Link className="btn btn--primary" to="/admin/new">
          + Add plant
        </Link>
      </div>

      {plants.length === 0 ? (
        <div className="admin-empty">
          <h2>No plants yet</h2>
          <p>Add the first one and it gets its own page straight away.</p>
          <Link className="btn btn--primary" to="/admin/new">
            Add plant
          </Link>
        </div>
      ) : (
        <>
          {plants.length > 6 && (
            <input
              className="admin-filter"
              type="search"
              placeholder="Filter by name or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter plants"
            />
          )}

          {visible.length === 0 ? (
            <p className="admin__hint">No plant matches “{query.trim()}”.</p>
          ) : (
            <ul className="plant-grid">
              {visible.map((plant) => (
                <li key={plant.slug} className="plant-card">
                  <Link to={`/admin/plants/${plant.slug}`} className="plant-card__main">
                    <span
                      className="plant-card__photo"
                      style={{ backgroundColor: plant.image.background || undefined }}
                    >
                      <img src={api.imageSrc(plant.image.url)} alt="" loading="lazy" />
                    </span>
                    <span className="plant-card__text">
                      <span className="plant-card__name">{plant.common_name}</span>
                      {plant.scientific_name && (
                        <em className="plant-card__latin">{plant.scientific_name}</em>
                      )}
                      <span className="plant-card__price">
                        {isSoldOut(plant) ? (
                          <span className="plant-card__sold">Sold out</span>
                        ) : plant.price_minor == null ? (
                          <span className="plant-card__noprice">No price yet</span>
                        ) : (
                          <>
                            <strong>{formatPrice(plant.price_minor, plant.currency)}</strong>
                            {plant.price_note && <small>{plant.price_note}</small>}
                          </>
                        )}
                      </span>
                      <span className="plant-card__meta">
                        /{plant.slug} · edited {updatedLabel(plant.updated_at)}
                        {views[plant.slug] && (
                          <>
                            {' · '}
                            <strong className="plant-card__views">
                              {viewsLabel(views[plant.slug])}
                            </strong>
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                  <div className="plant-card__actions">
                    <Link to={`/admin/plants/${plant.slug}`} className="btn btn--ghost btn--small">
                      Edit
                    </Link>
                    <a
                      href={`/${plant.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--ghost btn--small"
                    >
                      View page ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
