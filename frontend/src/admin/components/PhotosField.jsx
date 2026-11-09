import { useRef, useState } from 'react'
import * as api from '../../lib/api.js'
import { MAX_PHOTOS } from '../../lib/plantFormat.js'
import { MAX_UPLOAD_BYTES, prepareImage } from '../../lib/prepareImage.js'

/**
 * A plant's photos, as one list in swiping order. The first is the cover — the
 * thumbnail the shop and the search show, and the photo the page opens on.
 *
 * Tap a photo to select it, then make it the cover, move it, describe it or
 * take it out. Adding takes as many photos as the phone's picker will give,
 * uploaded one after another so a weak connection is never asked for six at once.
 *
 * `onChange` receives the new list, or a function from the current list to the
 * new one (an upload finishing later must add to whatever is there by then).
 */
export default function PhotosField({ photos, onChange, invalid }) {
  const inputRef = useRef(null)
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [problems, setProblems] = useState([])

  const last = photos.length - 1
  const current = Math.min(selected, Math.max(last, 0))
  const photo = photos[current]

  async function addFiles(list) {
    const found = Array.from(list ?? [])
    if (found.length === 0) return

    const images = found.filter((file) => file.type.startsWith('image/'))
    const room = Math.max(0, MAX_PHOTOS - photos.length)
    const take = images.slice(0, room)

    const notes = []
    if (images.length < found.length) {
      const n = found.length - images.length
      notes.push(`${n} ${n === 1 ? 'file wasn’t an image' : 'files weren’t images'}.`)
    }
    if (take.length < images.length) {
      const n = images.length - take.length
      notes.push(`A plant holds ${MAX_PHOTOS} photos, so ${n} ${n === 1 ? 'was' : 'were'} left out.`)
    }
    setProblems(notes)

    for (const [index, file] of take.entries()) {
      setBusy(take.length > 1 ? `Uploading ${index + 1} of ${take.length}…` : 'Uploading…')
      try {
        // Big photos are shrunk here first: the server refuses a few MB before it arrives.
        const prepared = await prepareImage(file)
        if (prepared.size > MAX_UPLOAD_BYTES) {
          notes.push(`${file.name} is ${formatBytes(prepared.size)} and couldn’t be made smaller.`)
          continue
        }
        const asset = await api.uploadImage(prepared)
        onChange((now) => [
          ...now,
          { url: asset.url, alt: '', placeholder: asset.placeholder, background: asset.background },
        ])
      } catch (err) {
        notes.push(`${file.name}: ${err.status === 413 ? 'the server found it too large.' : err.message}`)
      }
    }

    setProblems([...notes])
    setBusy(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function move(from, to) {
    const next = [...photos]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
    setSelected(to)
  }

  function remove() {
    onChange(photos.filter((_, index) => index !== current))
    setSelected(Math.max(0, current - 1))
  }

  const describe = (alt) =>
    onChange(photos.map((item, index) => (index === current ? { ...item, alt } : item)))

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const chooser = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      multiple
      onChange={(e) => addFiles(e.target.files)}
      hidden
    />
  )

  return (
    <div
      className="photos"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {photos.length === 0 ? (
        <div
          className={['photo-drop', dragging && 'is-dragging', invalid && 'is-invalid', busy && 'is-busy']
            .filter(Boolean)
            .join(' ')}
        >
          <div className="photo-drop__overlay">
            {busy ? (
              <span className="photo-drop__status">{busy}</span>
            ) : (
              <>
                <span className="photo-drop__hint">
                  Drop photos here
                  <small>JPEG, PNG, WebP or AVIF · pick as many as you like · big photos are shrunk for you</small>
                </span>
                <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                  Choose photos
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* the selected photo, large, as the page will crop it */}
          <div
            className={`photo-stage${dragging ? ' is-dragging' : ''}`}
            style={photo.background ? { backgroundColor: photo.background } : undefined}
          >
            <img src={api.imageSrc(photo.url)} alt="" />
            <span className="photo-stage__tag">
              {current === 0 ? 'Cover photo' : `Photo ${current + 1} of ${photos.length}`}
            </span>
          </div>

          <ul className="photo-grid" aria-label="Photos">
            {photos.map((item, index) => (
              <li key={`${index}-${item.url}`}>
                <button
                  type="button"
                  className={`photo-tile${index === current ? ' is-selected' : ''}`}
                  style={item.background ? { backgroundColor: item.background } : undefined}
                  aria-pressed={index === current}
                  aria-label={index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
                  onClick={() => setSelected(index)}
                >
                  <img src={api.imageSrc(item.url)} alt="" loading="lazy" />
                  <span className="photo-tile__no">{index === 0 ? 'Cover' : index + 1}</span>
                </button>
              </li>
            ))}

            {photos.length < MAX_PHOTOS && (
              <li>
                <button
                  type="button"
                  className="photo-tile photo-tile--add"
                  onClick={() => inputRef.current?.click()}
                  disabled={Boolean(busy)}
                >
                  {busy ? (
                    <span className="photo-tile__busy">{busy}</span>
                  ) : (
                    <>
                      <span className="photo-tile__plus" aria-hidden="true">
                        +
                      </span>
                      Add photos
                    </>
                  )}
                </button>
              </li>
            )}
          </ul>

          <div className="photo-panel">
            <div className="photo-panel__actions">
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => move(current, 0)}
                disabled={current === 0}
              >
                {current === 0 ? 'This is the cover' : 'Make this the cover'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => move(current, current - 1)}
                disabled={current === 0}
                aria-label="Move earlier"
              >
                ← Earlier
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => move(current, current + 1)}
                disabled={current === last}
                aria-label="Move later"
              >
                Later →
              </button>
              <button type="button" className="btn btn--danger btn--small" onClick={remove}>
                Remove
              </button>
            </div>

            <label className="field">
              <span>Describe this photo</span>
              <input
                value={photo.alt}
                onChange={(e) => describe(e.target.value)}
                placeholder="A peace lily in a white pot, with white flowers"
                maxLength={300}
              />
              <small>Read aloud to people using screen readers, and shown if the photo fails to load.</small>
            </label>
          </div>
        </>
      )}

      {chooser}

      {problems.length > 0 && (
        <ul className="form__error photo-problems" role="alert">
          {problems.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
