import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Glyph } from './ContactButton.jsx'
import * as api from '../lib/api.js'
import { formatPrice } from '../lib/commerce.js'
import {
  estimateDelivery,
  formatRange,
  isPincode,
  savePincode,
  savedPincode,
} from '../lib/delivery.js'
import { MAX_ITEMS, MAX_QTY, listAction, totals } from '../lib/list.js'
import {
  changeQty,
  clearList,
  closeList,
  openList,
  refreshList,
  removeFromList,
  useList,
} from '../lib/listStore.js'
import '../styles/mylist.css'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * "My list": a pill that appears once there is something on the list, and the
 * sheet it opens — the plants, how many of each, the total, and one button that
 * sends it all to the shop as a single WhatsApp message.
 *
 * Mounted once for the whole site, like the contact button, and hidden in the
 * admin.
 */
export default function MyList() {
  const location = useLocation()
  const titleId = useId()
  const pincodeId = useId()
  const { items, open } = useList()

  const pillRef = useRef(null)
  const panelRef = useRef(null)
  const opener = useRef(null)
  const wasOpen = useRef(false)

  // Keeps the sheet on screen while it slides away.
  const [rendered, setRendered] = useState(false)
  const [draft, setDraft] = useState(() => savedPincode() ?? '')
  const [confirmingClear, setConfirmingClear] = useState(false)

  const onAdmin = location.pathname.startsWith('/admin')
  const pincode = isPincode(draft) ? draft : null
  const sum = useMemo(() => totals(items), [items])
  // The site's own address goes in, so each plant in the message links to its page.
  const action = useMemo(
    () => listAction(items, pincode, window.location.origin),
    [items, pincode],
  )
  const estimate = useMemo(() => (pincode ? estimateDelivery(pincode) : null), [pincode])

  // Going to another page puts the list away.
  useEffect(() => closeList(), [location.pathname])

  useEffect(() => {
    if (open) {
      setRendered(true)
      return
    }
    setConfirmingClear(false)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setRendered(false), reduced ? 0 : 260)
    return () => clearTimeout(timer)
  }, [open])

  // Remember what had focus when the sheet opened, and give it back on close.
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const back = opener.current
    const target = back && back.isConnected && back !== document.body ? back : pillRef.current
    target?.focus?.({ preventScroll: true })
  }, [open])

  // Move focus into the sheet once it is on screen, for keyboards and screen readers.
  useEffect(() => {
    if (open && rendered) panelRef.current?.focus({ preventScroll: true })
  }, [open, rendered])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && closeList()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Prices and stock may have changed since the list was made, so look again
  // whenever it is opened. If the shop cannot be reached the list is left alone.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .listPlants()
      .then((plants) => !cancelled && refreshList(plants))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  if (onAdmin) return null

  const state = open ? 'is-open' : 'is-closing'

  function changePincode(event) {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6)
    setDraft(value)
    if (isPincode(value)) savePincode(value)
  }

  // The same moment the chat opens, count each plant as asked about, so the
  // dashboard's WhatsApp taps include plants that were sent as part of a list.
  function sent() {
    items.filter((item) => item.availability !== 'sold_out').forEach((item) => api.recordTap(item.slug))
  }

  function clear() {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    setConfirmingClear(false)
    clearList()
  }

  return (
    <>
      {items.length > 0 && (
        <button
          ref={pillRef}
          type="button"
          className="my-list-pill"
          aria-haspopup="dialog"
          aria-label={`My list, ${plural(items.length, 'plant')}`}
          onClick={openList}
        >
          <svg className="my-list-pill__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 7h9.5M9.5 12h9.5M9.5 17h9.5" />
            <circle cx="5" cy="7" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="5" cy="17" r="1.1" fill="currentColor" stroke="none" />
          </svg>
          <span>My list</span>
          {/* Keyed on the count, so it pops each time a plant is added. */}
          <span key={items.length} className="my-list-pill__count" aria-hidden="true">
            {items.length}
          </span>
        </button>
      )}

      {rendered && <div className={`my-list-backdrop ${state}`} onClick={closeList} aria-hidden="true" />}

      {rendered && (
        <div
          ref={panelRef}
          className={`my-list ${state}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className="my-list__head">
            <div>
              <h2 id={titleId} className="my-list__title">
                My list
              </h2>
              {items.length > 0 && (
                <p className="my-list__sub">
                  {plural(sum.plants, 'plant')}
                  {sum.soldOut > 0 && ` · ${sum.soldOut} sold out`}
                </p>
              )}
            </div>
            <div className="my-list__actions">
              {items.length > 0 && (
                <button type="button" className="my-list__clear" onClick={clear}>
                  {confirmingClear ? 'Tap again to clear' : 'Clear list'}
                </button>
              )}
              <button type="button" className="my-list__close" aria-label="Close my list" onClick={closeList}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          {items.length === 0 ? (
            <p className="my-list__empty">
              Nothing here yet. Tap the + on any plant to add it, then send them all to us in one go.
            </p>
          ) : (
            <>
              <ul className="my-list__items">
                {items.map((item) => (
                  <ListRow key={item.slug} item={item} />
                ))}
              </ul>

              <footer className="my-list__foot">
                <p className="my-list__total">
                  <span>Total</span>
                  <strong>{sum.priced > 0 ? formatPrice(sum.total, sum.currency) : '—'}</strong>
                </p>
                {sum.unpriced > 0 && (
                  <p className="my-list__note">
                    {sum.priced > 0 ? 'Plus ' : ''}
                    {plural(sum.unpriced, 'plant')} on request — we’ll send the price.
                  </p>
                )}
                {items.length >= MAX_ITEMS && (
                  <p className="my-list__note">The list holds up to {MAX_ITEMS} plants.</p>
                )}

                <div className="my-list__pin">
                  <label className="my-list__label" htmlFor={pincodeId}>
                    Delivery pincode
                  </label>
                  <input
                    id={pincodeId}
                    className="my-list__pincode"
                    value={draft}
                    onChange={changePincode}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="postal-code"
                    maxLength={6}
                    placeholder="optional"
                  />
                </div>
                {estimate && (
                  <p className="my-list__estimate" role="status">
                    Estimated delivery <strong>{formatRange(estimate.earliest, estimate.latest)}</strong>
                  </p>
                )}

                {action ? (
                  <a
                    className="my-list__send"
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={sent}
                  >
                    <Glyph name="whatsapp" className="my-list__send-icon" />
                    Send {sum.plants === 1 ? 'my plant' : `my ${sum.plants} plants`} on WhatsApp
                  </a>
                ) : (
                  <p className="my-list__note">
                    Everything on the list is sold out right now. Take those off, or add something else.
                  </p>
                )}
                <p className="my-list__hint">Typed into WhatsApp for you. Nothing is charged here.</p>
              </footer>
            </>
          )}
        </div>
      )}
    </>
  )
}

/** One plant on the list: photo, name, price, how many, and a way to take it off. */
function ListRow({ item }) {
  const sold = item.availability === 'sold_out'
  const price =
    item.price_minor == null
      ? 'Price on request'
      : `${formatPrice(item.price_minor, item.currency)}${item.qty > 1 ? ' each' : ''}`

  return (
    <li className={`my-list__item${sold ? ' is-sold' : ''}`}>
      <span className="my-list__thumb" style={{ backgroundColor: item.image.background || undefined }}>
        {item.image.url && <img src={api.imageSrc(item.image.url)} alt="" loading="lazy" decoding="async" />}
      </span>

      <span className="my-list__info">
        <span className="my-list__name">{item.name}</span>
        <span className="my-list__price">{sold ? 'Sold out — not included' : price}</span>
      </span>

      {!sold && (
        <span className="my-list__qty" role="group" aria-label={`How many ${item.name}`}>
          <button
            type="button"
            aria-label={`One fewer ${item.name}`}
            disabled={item.qty <= 1}
            onClick={() => changeQty(item.slug, item.qty - 1)}
          >
            −
          </button>
          <span aria-live="polite">{item.qty}</span>
          <button
            type="button"
            aria-label={`One more ${item.name}`}
            disabled={item.qty >= MAX_QTY}
            onClick={() => changeQty(item.slug, item.qty + 1)}
          >
            +
          </button>
        </span>
      )}

      <button
        type="button"
        className="my-list__remove"
        aria-label={`Remove ${item.name} from my list`}
        onClick={() => removeFromList(item.slug)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </li>
  )
}
