import { useState } from 'react'
import * as api from '../../lib/api.js'

/** Shared uploader — the backend resizes and re-encodes whatever it is given. */
export default function ImageUpload({ onUploaded, label = 'Upload image' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setBusy(true)
    try {
      const asset = await api.uploadImage(file)
      onUploaded(asset)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      event.target.value = '' // let the same file be picked again after an error
    }
  }

  return (
    <div className="upload">
      <label className="btn btn--ghost">
        {busy ? 'Uploading…' : label}
        <input type="file" accept="image/*" onChange={handleChange} disabled={busy} hidden />
      </label>
      {error && <p className="form__error" role="alert">{error}</p>}
    </div>
  )
}
