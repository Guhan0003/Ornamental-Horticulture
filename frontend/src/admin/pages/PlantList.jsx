import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../lib/api.js'

export default function PlantList() {
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listPlants({ includeDrafts: true })
      .then(setPlants)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="admin-loading">Loading plants…</div>
  if (error) return <p className="form__error" role="alert">{error}</p>

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Plants</h1>
          <p className="admin__sub">
            {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
          </p>
        </div>
        <Link className="btn btn--primary" to="/admin/plants/new">
          Add plant
        </Link>
      </div>

      {plants.length === 0 ? (
        <div className="admin-empty">
          <h2>No plants yet</h2>
          <p>Add your first one and it gets its own page and QR-ready URL.</p>
        </div>
      ) : (
        <ul className="plant-list">
          {plants.map((plant) => (
            <li key={plant.id}>
              <Link to={`/admin/plants/${plant.slug}`} className="plant-row">
                <div className="plant-row__main">
                  <span className="plant-row__name">{plant.common_name}</span>
                  {plant.scientific_name && (
                    <em className="plant-row__latin">{plant.scientific_name}</em>
                  )}
                  <code className="plant-row__slug">/{plant.slug}</code>
                </div>
                <span
                  className={`pill ${plant.is_published ? 'pill--live' : 'pill--draft'}`}
                >
                  {plant.is_published ? 'Live' : 'Draft'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
