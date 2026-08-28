import ImageUpload from '../ImageUpload.jsx'

export default function ImageForm({ data, onChange }) {
  return (
    <div className="block-form block-form--stack">
      {data.url && <img className="block-form__preview" src={data.url} alt={data.alt ?? ''} />}

      <ImageUpload
        label={data.url ? 'Replace image' : 'Upload image'}
        onUploaded={(asset) => onChange({ ...data, url: asset.url })}
      />

      <label className="field">
        <span>Alt text</span>
        <input
          value={data.alt ?? ''}
          onChange={(e) => onChange({ ...data, alt: e.target.value })}
          placeholder="A monstera leaf with deep splits"
        />
        <small>Describes the photo for screen readers and when images fail to load.</small>
      </label>

      <label className="field">
        <span>Caption</span>
        <input
          value={data.caption ?? ''}
          onChange={(e) => onChange({ ...data, caption: e.target.value })}
          placeholder="Shown under the photo"
        />
      </label>
    </div>
  )
}
