import { useEffect, useId, useRef, useState } from 'react'
import { Glyph } from './ContactButton.jsx'
import { photoNotice } from '../data/photos.js'

/**
 * The label in the corner of a plant photo, and the note it opens.
 *
 * Many of the pictures are illustrations or stock images, so every photo says
 * so, and a tap explains it and offers the way out: ask on WhatsApp for a real
 * photo of the plant that is actually in stock.
 *
 * `action` is the WhatsApp link, or null when no number is set, in which case
 * the note still explains and simply has no button.
 */
export default function PhotoNote({ action }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const cardId = useId()

  // Closes on Escape, or a tap anywhere outside it.
  useEffect(() => {
    if (!open) return

    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="pl-note" ref={rootRef}>
      <button
        type="button"
        className="pl-note__chip"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => setOpen((now) => !now)}
      >
        <InfoGlyph />
        {photoNotice.chip}
      </button>

      {open && (
        <div className="pl-note__card" id={cardId} role="dialog" aria-label={photoNotice.title}>
          <h2 className="pl-note__title">{photoNotice.title}</h2>
          <p className="pl-note__body">{photoNotice.body}</p>
          {action && (
            <a
              className="pl-note__ask"
              href={action.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <Glyph name="whatsapp" className="pl-note__ask-icon" />
              {photoNotice.button}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function InfoGlyph() {
  return (
    <svg
      className="pl-note__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}
