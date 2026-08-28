export default function Gallery({ images = [] }) {
  return (
    <div className="block block--gallery">
      {images.map((image, i) => (
        <img key={image.url ?? i} src={image.url} alt={image.alt ?? ''} loading="lazy" />
      ))}
    </div>
  )
}
