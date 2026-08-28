export default function Image({ url, alt = '', caption }) {
  return (
    <figure className="block block--image">
      <img src={url} alt={alt} loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
