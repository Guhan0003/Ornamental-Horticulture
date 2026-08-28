import { useEffect, useState } from 'react'
import * as api from '../../lib/api.js'

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listCategories()
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function add(event) {
    event.preventDefault()
    setError(null)
    try {
      const created = await api.createCategory({
        name: name.trim(),
        slug: slugify(name),
        parent_id: parentId === '' ? null : Number(parentId),
      })
      setCategories((current) => [...current, created])
      setName('')
      setParentId('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(category) {
    setError(null)
    try {
      await api.deleteCategory(category.id)
      setCategories((current) => current.filter((c) => c.id !== category.id))
    } catch (err) {
      // The API refuses while plants or sub-categories still point here.
      setError(err.message)
    }
  }

  // Render parents with their children indented beneath them.
  const roots = categories.filter((c) => !c.parent_id)
  const childrenOf = (id) => categories.filter((c) => c.parent_id === id)

  if (loading) return <div className="admin-loading">Loading categories…</div>

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Categories</h1>
          <p className="admin__sub">Folders for organising plants. They can nest.</p>
        </div>
      </div>

      <form className="form form--inline form--panel" onSubmit={add}>
        <label className="field">
          <span>New category</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Indoor plants"
            required
          />
        </label>

        <label className="field field--narrow">
          <span>Inside</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn btn--primary">Add</button>
      </form>

      {error && <p className="form__error" role="alert">{error}</p>}

      {categories.length === 0 ? (
        <div className="admin-empty">
          <h2>No categories yet</h2>
          <p>Plants work fine without one — add categories when you want grouping.</p>
        </div>
      ) : (
        <ul className="category-list">
          {roots.map((category) => (
            <li key={category.id}>
              <CategoryRow category={category} onDelete={remove} />
              {childrenOf(category.id).length > 0 && (
                <ul className="category-list category-list--nested">
                  {childrenOf(category.id).map((child) => (
                    <li key={child.id}>
                      <CategoryRow category={child} onDelete={remove} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CategoryRow({ category, onDelete }) {
  return (
    <div className="category-row">
      <span className="category-row__name">{category.name}</span>
      <code className="category-row__slug">{category.slug}</code>
      <button
        type="button"
        className="btn btn--icon btn--danger"
        onClick={() => onDelete(category)}
        aria-label={`Delete ${category.name}`}
      >
        ×
      </button>
    </div>
  )
}
