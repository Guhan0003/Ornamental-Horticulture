import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import * as api from '../../lib/api.js'
import PlantForm, { pickEditable } from '../components/PlantForm.jsx'

/** View and edit one plant, or delete it. */
export default function EditPlant() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const justCreated = Boolean(location.state?.created)

  const [plant, setPlant] = useState(null)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPlant(null)
    setError(null)
    api
      .getPlant(slug)
      .then((data) => !cancelled && setPlant(data))
      .catch((e) => !cancelled && setError(e.status === 404 ? 'There is no plant at this address.' : e.message))
    return () => {
      cancelled = true
    }
  }, [slug])

  async function remove() {
    const confirmed = window.confirm(
      `Delete “${plant.common_name}”?\n\nIts page will disappear, and the address /${slug} can never be used again, because a QR label may still point at it.`,
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await api.deletePlant(slug)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <>
        <Link to="/admin" className="admin__back">← All plants</Link>
        <p className="form__error" role="alert">{error}</p>
      </>
    )
  }
  if (!plant) return <div className="admin-loading">Loading…</div>

  return (
    <>
      <div className="admin__head">
        <div>
          <Link to="/admin" className="admin__back">← All plants</Link>
          <h1>{plant.common_name}</h1>
        </div>
        <a className="btn btn--ghost" href={`/${slug}`} target="_blank" rel="noreferrer">
          View page ↗
        </a>
      </div>

      {justCreated && (
        <p className="admin-banner" role="status">
          Plant added. Its page is live at <a href={`/${slug}`} target="_blank" rel="noreferrer">/{slug}</a>.
        </p>
      )}

      <PlantForm
        key={slug}
        initial={pickEditable(plant)}
        isNew={false}
        onSave={(payload) => api.updatePlant(slug, payload)}
        footer={
          <button type="button" className="btn btn--danger" onClick={remove} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete plant'}
          </button>
        }
      />
    </>
  )
}
