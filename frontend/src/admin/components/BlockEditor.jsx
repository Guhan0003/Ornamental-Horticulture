import { useState } from 'react'
import * as api from '../../lib/api.js'
import FactsForm from './blockforms/FactsForm.jsx'
import GalleryForm from './blockforms/GalleryForm.jsx'
import HeadingForm from './blockforms/HeadingForm.jsx'
import ImageForm from './blockforms/ImageForm.jsx'
import TextForm from './blockforms/TextForm.jsx'

/**
 * Editing surface for the dynamic page format.
 *
 * Mirrors the public BlockRenderer: adding a block type means adding a form
 * here, a renderer there, and a value to BlockType on the backend.
 */
const TYPES = [
  { type: 'heading', label: 'Heading', blank: { text: '', level: 2 }, Form: HeadingForm },
  { type: 'text', label: 'Text', blank: { body: '' }, Form: TextForm },
  { type: 'image', label: 'Image', blank: { url: '', alt: '' }, Form: ImageForm },
  { type: 'gallery', label: 'Gallery', blank: { images: [] }, Form: GalleryForm },
  { type: 'facts', label: 'Care details', blank: { items: [] }, Form: FactsForm },
]

const definitionFor = (type) => TYPES.find((t) => t.type === type)

export default function BlockEditor({ plantId, blocks, onChange }) {
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  async function run(action, fallbackMessage) {
    setError(null)
    try {
      return await action()
    } catch (err) {
      setError(err.message || fallbackMessage)
      return null
    }
  }

  async function addBlock(type) {
    const definition = definitionFor(type)
    const created = await run(
      () =>
        api.addBlock(plantId, {
          type,
          position: blocks.length,
          data: definition.blank,
        }),
      'Could not add that block',
    )
    if (created) onChange([...blocks, created])
  }

  // Typing updates local state immediately; the write happens on blur so we
  // aren't firing a request per keystroke.
  function editLocally(id, data) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, data } : b)))
  }

  async function persist(block) {
    setSavingId(block.id)
    await run(() => api.updateBlock(block.id, { data: block.data }), 'Could not save')
    setSavingId(null)
  }

  async function removeBlock(id) {
    const ok = await run(() => api.deleteBlock(id).then(() => true), 'Could not delete')
    if (ok) onChange(blocks.filter((b) => b.id !== id))
  }

  async function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return

    const reordered = [...blocks]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    // Show the new order straight away, then confirm with the server.
    onChange(reordered)
    const saved = await run(
      () => api.reorderBlocks(plantId, reordered.map((b) => b.id)),
      'Could not reorder',
    )
    if (!saved) onChange(blocks) // put it back if the server refused
  }

  return (
    <section className="blocks">
      <div className="blocks__head">
        <h2>Page content</h2>
        <p className="admin__sub">
          The page is built from these blocks, in this order. Drag-free: use the arrows.
        </p>
      </div>

      {error && <p className="form__error" role="alert">{error}</p>}

      {blocks.length === 0 && (
        <div className="admin-empty admin-empty--inline">
          <p>No content yet. Add a block below.</p>
        </div>
      )}

      <ol className="blocks__list">
        {blocks.map((block, index) => {
          const definition = definitionFor(block.type)
          if (!definition) {
            return (
              <li className="block-card" key={block.id}>
                <p className="form__error">
                  Unknown block type “{block.type}” — this admin is older than the data.
                </p>
              </li>
            )
          }

          const { Form, label } = definition
          return (
            <li className="block-card" key={block.id}>
              <header className="block-card__head">
                <span className="block-card__type">{label}</span>
                <div className="block-card__actions">
                  {savingId === block.id && <span className="block-card__saving">Saving…</span>}
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => move(index, 1)}
                    disabled={index === blocks.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon btn--danger"
                    onClick={() => removeBlock(block.id)}
                    aria-label={`Delete ${label} block`}
                  >
                    ×
                  </button>
                </div>
              </header>

              <div onBlur={() => persist(block)}>
                <Form data={block.data ?? {}} onChange={(data) => editLocally(block.id, data)} />
              </div>
            </li>
          )
        })}
      </ol>

      <div className="blocks__add">
        <span>Add a block:</span>
        {TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className="btn btn--ghost"
            onClick={() => addBlock(type)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
