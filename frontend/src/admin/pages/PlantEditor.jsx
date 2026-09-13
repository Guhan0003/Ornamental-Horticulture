import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../../lib/api.js'
import BlockEditor from '../components/BlockEditor.jsx'

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const EMPTY = {
  slug: '',
  common_name: '',
  scientific_name: '',
  summary: '',
  category_id: '',
  is_published: false,
}

export default function PlantEditor() {
  const { slug } = useParams()
  const isNew = !slug
  const navigate = useNavigate()

  const [plant, setPlant] = useState(EMPTY)
  const [blocks, setBlocks] = useState([])
  const [categories, setCategories] = useState([])
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    let cancelled = false

    api
      .getPlant(slug)
      .then((data) => {
        if (cancelled) return
        setPlant({ ...data, category_id: data.category_id ?? '' })
        setBlocks(data.blocks ?? [])
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [slug, isNew])

  const set = (patch) => setPlant((current) => ({ ...current, ...patch }))

  function setName(value) {
    // Derive the slug until the user edits it themselves.
    set({ common_name: value, ...(isNew && !slugTouched ? { slug: slugify(value) } : {}) })
  }

  async function save(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)

    const payload = {
      ...plant,
      category_id: plant.category_id === '' ? null : Number(plant.category_id),
    }

    try {
      if (isNew) {
        const created = await api.createPlant(payload)
        navigate(`/admin/plants/${created.slug}`, { replace: true })
      } else {
        // slug is deliberately not sent — printed QR labels depend on it.
        const { slug: _ignored, ...editable } = payload
        const updated = await api.updatePlant(slug, editable)
        setPlant({ ...updated, category_id: updated.category_id ?? '' })
        setNotice('Saved')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${plant.common_name}” and all its content?`)) return
    try {
      await api.deletePlant(slug)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="admin-loading">Loading…</div>

  return (
    <>
      <div className="admin__head">
        <div>
          <Link to="/admin" className="admin__back">← All plants</Link>
          <h1>{isNew ? 'New plant' : plant.common_name}</h1>
        </div>
        {!isNew && plant.is_published && (
          <a className="btn btn--ghost" href={`/${plant.slug}`} target="_blank" rel="noreferrer">
            View live page
          </a>
        )}
      </div>

      <form className="form form--panel" onSubmit={save}>
        <label className="field">
          <span>Common name</span>
          <input value={plant.common_name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="field">
          <span>Scientific name</span>
          <input
            value={plant.scientific_name ?? ''}
            onChange={(e) => set({ scientific_name: e.target.value })}
            placeholder="Monstera deliciosa"
          />
        </label>

        <label className="field">
          <span>URL</span>
          {isNew ? (
            <>
              <input
                value={plant.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set({ slug: slugify(e.target.value) })
                }}
                required
              />
              <small className="field__warn">
                This becomes the QR code’s address and <strong>cannot be changed later</strong> —
                a printed label can’t be edited. Get it right now.
              </small>
            </>
          ) : (
            <>
              <input value={`/${plant.slug}`} readOnly disabled />
              <small>Permanent, because QR labels point here.</small>
            </>
          )}
        </label>

        <label className="field">
          <span>Summary</span>
          <textarea
            rows={2}
            value={plant.summary ?? ''}
            onChange={(e) => set({ summary: e.target.value })}
            placeholder="One line shown near the top of the page"
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={plant.category_id}
            onChange={(e) => set({ category_id: e.target.value })}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={plant.is_published}
            onChange={(e) => set({ is_published: e.target.checked })}
          />
          <span>
            Published
            <small>Unpublished plants are visible only to you, not to a customer scanning.</small>
          </span>
        </label>

        {error && <p className="form__error" role="alert">{error}</p>}
        {notice && <p className="form__notice" role="status">{notice}</p>}

        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create plant' : 'Save details'}
          </button>
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={remove}>
              Delete plant
            </button>
          )}
        </div>
      </form>

      {isNew ? (
        <p className="admin__hint">Create the plant first, then build its page content.</p>
      ) : (
        <BlockEditor plantId={plant.id} blocks={blocks} onChange={setBlocks} />
      )}
    </>
  )
}
