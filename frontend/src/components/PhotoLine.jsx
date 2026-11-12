import { photoNotice } from '../data/photos.js'

/**
 * The one-line version of the photo notice, for footers and the contact popup.
 * The words of `photoNotice.lineLink` inside it are the WhatsApp link; with no
 * link (no number set) the line is plain text.
 */
export default function PhotoLine({ action, className }) {
  const { line, lineLink } = photoNotice
  const at = lineLink ? line.indexOf(lineLink) : -1

  if (!action || at === -1) return <p className={className}>{line}</p>

  return (
    <p className={className}>
      {line.slice(0, at)}
      <a href={action.href} target="_blank" rel="noreferrer">
        {lineLink}
      </a>
      {line.slice(at + lineLink.length)}
    </p>
  )
}
