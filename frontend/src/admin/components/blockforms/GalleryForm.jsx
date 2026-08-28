import ImageUpload from '../ImageUpload.jsx'

export default function GalleryForm({ data, onChange }) {
  const images = data.images ?? []

  const add = (asset) => onChange({ ...data, images: [...images, { url: asset.url, alt: '' }] })

  const update = (index, patch) =>
    onChange({
      ...data,
      images: images.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    })

  const remove = (index) =>
    onChange({ ...data, images: images.filter((_, i) => i !== index) })

  return (
    <div className="block-form block-form--stack">
      <div className="gallery-form">
        {images.map((image, index) => (
          <figure className="gallery-form__item" key={image.url ?? index}>
            <img src={image.url} alt={image.alt ?? ''} />
            <input
              value={image.alt ?? ''}
              onChange={(e) => update(index, { alt: e.target.value })}
              placeholder="Alt text"
              aria-label="Alt text"
            />
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => remove(index)}
              aria-label="Remove image"
            >
              ×
            </button>
          </figure>
        ))}
      </div>

      <ImageUpload label="Add photo" onUploaded={add} />
    </div>
  )
}
