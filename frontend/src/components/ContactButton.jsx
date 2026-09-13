import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Leaf from './Leaf.jsx'
import { contact } from '../data/contact.js'
import '../styles/contact.css'

const digits = (value) => value.replace(/[^\d]/g, '')

/** One entry per way of getting in touch; empty details are left out. */
function channels(details) {
  const list = []

  if (details.phone) {
    list.push({
      key: 'phone',
      label: 'Call',
      value: details.phone,
      href: `tel:+${digits(details.phone)}`,
    })
  }

  if (details.whatsapp) {
    const message = details.whatsappMessage
    list.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      value: 'Chat with us',
      href: `https://wa.me/${digits(details.whatsapp)}${message ? `?text=${encodeURIComponent(message)}` : ''}`,
      external: true,
    })
  }

  if (details.email) {
    list.push({
      key: 'email',
      label: 'Email',
      value: details.email,
      href: `mailto:${details.email}`,
    })
  }

  if (details.instagram) {
    const handle = details.instagram.replace(/^@/, '')
    list.push({
      key: 'instagram',
      label: 'Instagram',
      value: `@${handle}`,
      href: `https://instagram.com/${encodeURIComponent(handle)}`,
      external: true,
    })
  }

  return list
}

/**
 * Round button at the bottom left of every public page. It opens a small
 * card with a description and links to call, WhatsApp, email and Instagram.
 */
export default function ContactButton() {
  const location = useLocation()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  // Keeps the card mounted while its closing animation plays.
  const [rendered, setRendered] = useState(false)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  const onAdmin = location.pathname.startsWith('/admin')

  // Close when navigating to another page.
  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (open) {
      setRendered(true)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setRendered(false), reduced ? 0 : 260)
    return () => clearTimeout(timer)
  }, [open])

  // Move focus into the card once it is on screen, for keyboard and screen readers.
  useEffect(() => {
    if (open && rendered) panelRef.current?.focus({ preventScroll: true })
  }, [open, rendered])

  useEffect(() => {
    if (!open) return

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (onAdmin) return null

  const items = channels(contact)
  const state = open ? 'is-open' : 'is-closing'

  return (
    <>
      {rendered && (
        <div className={`contact-backdrop ${state}`} onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {rendered && (
        <div
          ref={panelRef}
          className={`contact-card ${state}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <button
            type="button"
            className="contact-card__close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <Glyph name="close" />
          </button>

          <header className="contact-card__head">
            <span className="contact-card__avatar">
              {contact.avatar ? <img src={contact.avatar} alt="" /> : <Leaf className="contact-card__leaf" />}
            </span>
            <div>
              <h2 id={titleId} className="contact-card__name">
                {contact.name}
              </h2>
              {contact.tagline && <p className="contact-card__tagline">{contact.tagline}</p>}
            </div>
          </header>

          {(contact.heading || contact.description || contact.highlight) && (
            <div className="contact-card__intro">
              {contact.heading && <h3 className="contact-card__heading">{contact.heading}</h3>}
              {contact.description && <p className="contact-card__desc">{contact.description}</p>}
              {contact.highlight && <p className="contact-card__highlight">{contact.highlight}</p>}
            </div>
          )}

          <ul className="contact-card__list">
            {items.map((item, index) => (
              <li key={item.key} style={{ '--i': index }}>
                <a
                  className={`contact-link contact-link--${item.key}`}
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  <span className="contact-link__icon">
                    <Glyph name={item.key} />
                  </span>
                  <span className="contact-link__text">
                    <span className="contact-link__label">{item.label}</span>
                    <span className="contact-link__value">{item.value}</span>
                  </span>
                  <Glyph name="arrow" className="contact-link__arrow" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        className={`contact-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close contact details' : 'Contact us'}
      >
        <span className="contact-fab__face contact-fab__face--avatar">
          {contact.avatar ? <img src={contact.avatar} alt="" /> : <Glyph name="chat" />}
        </span>
        <span className="contact-fab__face contact-fab__face--close">
          <Glyph name="close" />
        </span>
      </button>
    </>
  )
}

function Glyph({ name, className }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'phone':
      return (
        <svg {...common}>
          <path d="M5.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 7.2 7.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2Z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M4 20l1.2-4.2A8.5 8.5 0 1 1 8.4 19L4 20Z" />
          <path d="M9.2 8.3c.2-.4.5-.4.8-.4h.5l.9 2.1-.6.8a5.4 5.4 0 0 0 2.4 2.4l.8-.6 2.1.9v.5c0 .3 0 .6-.4.8-.6.4-1.5.6-2.6.1a8.5 8.5 0 0 1-4-4c-.5-1.1-.3-2 .1-2.6Z" />
        </svg>
      )
    case 'email':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12Z" />
          <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.4" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      )
    default:
      return null
  }
}
