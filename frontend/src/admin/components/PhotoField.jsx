import { useRef, useState } from 'react'
import * as api from '../../lib/api.js'

/**
 * The plant photo: pick or drop a file, see it as the page will show it.
 * The backend resizes it, converts it to WebP, and returns the blurred
 * preview and backdrop colour the plant page uses while it loads.
 */
export default function PhotoField({ image, onChange, invalid }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [savedNote, setSavedNote] = useState(null)

  async function upload(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file isn’t an image.')
      return
    }

    setError(null)
    setSavedNote(null)
    setBusy(true)
    try {
      const asset = await api.uploadImage(file)
      onChange({
        ...image,
        url: asset.url,
        placeholder: asset.placeholder,
        background: asset.background,
      })
      setSavedNote(
        `${formatBytes(file.size)} photo optimised to ${formatBytes(asset.size_bytes)} (${asset.width}×${asset.height})`,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    upload(event.dataTransfer.files?.[0])
  }

  const hasPhoto = Boolean(image.url)

  return (
    <div className="photo-field">
      <div
        className={[
          'photo-drop',
          hasPhoto && 'has-photo',
          dragging && 'is-dragging',
          invalid && 'is-invalid',
          busy && 'is-busy',
        ]
          .filter(Boolean)
          .join(' ')}
        style={hasPhoto && image.background ? { backgroundColor: image.background } : undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {hasPhoto && <img src={api.imageSrc(image.url)} alt="" />}

        <div className="photo-drop__overlay">
          {busy ? (
            <span className="photo-drop__status">Uploading and optimising…</span>
          ) : (
            <>
              {!hasPhoto && (
                <span className="photo-drop__hint">
                  Drop a photo here
                  <small>JPEG, PNG, WebP or AVIF · up to 15 MB</small>
                </span>
              )}
              <button
                type="button"
                className={`btn ${hasPhoto ? 'btn--glass' : 'btn--primary'}`}
                onClick={() => inputRef.current?.click()}
              >
                {hasPhoto ? 'Replace photo' : 'Choose photo'}
              </button>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => upload(e.target.files?.[0])}
          hidden
        />
      </div>

      {error && <p className="form__error" role="alert">{error}</p>}
      {savedNote && <p className="field__ok">{savedNote}</p>}

      <label className="field">
        <span>Describe the photo</span>
        <input
          value={image.alt}
          onChange={(e) => onChange({ ...image, alt: e.target.value })}
          placeholder="A peace lily in a white pot, with white flowers"
          maxLength={300}
        />
        <small>Read aloud to people using screen readers, and shown if the photo fails to load.</small>
      </label>
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
