import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { imageSrc } from '../lib/api.js'
import {
  SORTS,
  discountPercent,
  formatPrice,
  isSoldOut,
  sortPlants,
} from '../lib/commerce.js'
import { groupPlants } from '../lib/groups.js'
import { CardAdd } from './ListButton.jsx'
import Leaf from './Leaf.jsx'
import { handOver } from './PlantView.jsx'

const SCROLL_KEY = 'stomatalworld.home-scroll'
const ORDER_KEY = 'stomatalworld.home-order'

const normalise = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/** Plants whose common or scientific name contains what was typed. */
function matching(plants, query) {
  const q = normalise(query)
  if (!q) return plants
  return plants.filter((plant) =>
    [plant.common_name, plant.scientific_name].some((name) => normalise(name ?? '').includes(q)),
  )
}

/**
 * Every plant, with its price: the shop. Three to a row on a phone, because a
 * photo is how anyone recognises a plant and the price under it is the next
 * thing they look for.
 *
 * Above the cards sits one small row: a search icon and the sort menu. The icon
 * opens a search field in that same row, and the cards filter as you type.
 *
 * By default the cards sit under their family — Philodendron, Pothos, Monstera
 * — because that is how someone holding one asks for the next one. Any price
 * order flattens it back to a single grid, since a cheapest-first list cut into
 * eight sections is not a cheapest-first list.
 *
 * With ten families the page is eight screens tall, so a row of chips under the
 * bar jumps to any of them and stays at the top while you scroll, and a round
 * button takes you back up once you are well down the page.
 *
 * `plants` is null while the list loads.
 */
export default function Catalogue({ plants, failed, onRetry }) {
  const [order, setOrder] = useState(rememberedOrder)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const found = useMemo(() => matching(plants ?? [], query), [plants, query])
  const sorted = useMemo(() => sortPlants(found, order), [found, order])
  const grouped = order === 'type'
  const sections = useMemo(
    () => (grouped ? groupPlants(sorted) : []),
    [grouped, sorted],
  )

  const chooseOrder = (value) => {
    setOrder(value)
    try {
      sessionStorage.setItem(ORDER_KEY, value)
    } catch {
      /* private mode — it just resets next visit */
    }
  }

  // Coming back from a plant should put you where you were in the list, not at
  // the top of 24 cards.
  useLayoutEffect(() => {
    if (!plants) return
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY))
      sessionStorage.removeItem(SCROLL_KEY)
      if (y > 0) window.scrollTo(0, y)
    } catch {
      /* private mode — it just opens at the top */
    }
  }, [plants])

  const rememberPlace = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    } catch {
      /* nothing to do */
    }
  }

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  const jumpTo = (name) => {
    const shelf = document.getElementById(headingId(name))?.closest('.shelf')
    if (!shelf) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    shelf.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section className="shop" aria-labelledby="shop-title">
      {/* Not shown, but it names the section for screen readers. */}
      <h2 id="shop-title" className="visually-hidden">
        Our plants
      </h2>

      {plants?.length > 1 && (
        <div className="shop__bar">
          {searching ? (
            <div className="shop__search">
              <svg className="shop__search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                type="search"
                placeholder="Search plants"
                aria-label="Search plants"
                autoComplete="off"
                spellCheck="false"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              />
              <button
                type="button"
                className="shop__search-close"
                aria-label="Close search"
                onClick={closeSearch}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="shop__search-open"
                aria-label="Search plants"
                onClick={() => setSearching(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
              </button>

              <label className="shop__sort">
                <span className="visually-hidden">Sort plants</span>
                <select value={order} onChange={(e) => chooseOrder(e.target.value)}>
                  {SORTS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}

      {/* While a search is open the families shown are only the matching ones, so
          the jump row steps aside until it is closed. */}
      {grouped && !searching && sections.length > 1 && (
        <nav className="shop__jump" aria-label="Jump to a plant family">
          {sections.map((section) => (
            <button
              key={section.name}
              type="button"
              className="shop__chip"
              onClick={() => jumpTo(section.name)}
            >
              {section.name}
            </button>
          ))}
        </nav>
      )}

      {failed ? (
        <div className="shop__message" role="alert">
          <p>Couldn’t load the plants. It’s usually the signal.</p>
          <button type="button" className="status" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : plants === null ? (
        <ul className="shop__grid" aria-busy="true" aria-label="Loading plants">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="shop-card shop-card--skeleton" aria-hidden="true">
              <span className="shop-card__frame" />
              <span className="shop-card__body">
                <span className="shop-card__line" />
                <span className="shop-card__line shop-card__line--short" />
              </span>
            </li>
          ))}
        </ul>
      ) : plants.length === 0 ? (
        <p className="shop__message">No plants yet — check back soon.</p>
      ) : found.length === 0 ? (
        <p className="shop__message">No plant called “{query.trim()}” yet</p>
      ) : grouped ? (
        sections.map((section) => (
          <section className="shelf" key={section.name} aria-labelledby={headingId(section.name)}>
            <h3 className="shelf__title" id={headingId(section.name)}>
              {section.name}
              <span className="shelf__count">{section.plants.length}</span>
            </h3>

            <ul className="shop__grid">
              {section.plants.map((plant) => (
                <li key={plant.slug}>
                  <PlantCard plant={plant} onOpen={rememberPlace} />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <ul className="shop__grid">
          {sorted.map((plant) => (
            <li key={plant.slug}>
              <PlantCard plant={plant} onOpen={rememberPlace} />
            </li>
          ))}
        </ul>
      )}

      {plants?.length > 8 && <BackToTop />}
    </section>
  )
}

/** A round button, bottom right, that appears once you are well down the page. */
function BackToTop() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setShown(window.scrollY > window.innerHeight * 1.2))
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      cancelAnimationFrame(frame)
    }
  }, [])

  const goUp = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      className={`to-top${shown ? ' is-shown' : ''}`}
      aria-label="Back to top"
      // Out of the tab order and hidden from readers until it can be used.
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={goUp}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 14 6-6 6 6" />
      </svg>
    </button>
  )
}

/** The order chosen last time, so going back to the shop looks like you left it. */
function rememberedOrder() {
  try {
    const saved = sessionStorage.getItem(ORDER_KEY)
    if (SORTS.some(({ value }) => value === saved)) return saved
  } catch {
    /* private mode — start at the default */
  }
  return 'type'
}

const headingId = (name) => `shelf-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

function PlantCard({ plant, onOpen }) {
  const sold = isSoldOut(plant)
  const off = discountPercent(plant.price_minor, plant.original_price_minor)

  return (
    <div className="shop-card-wrap">
      <Link
        className={`shop-card${sold ? ' shop-card--sold' : ''}`}
        to={`/${plant.slug}`}
        viewTransition
        onClick={(event) => {
          onOpen()
          handOver(event)
        }}
      >
        <span
          className="shop-card__frame"
          style={{
            backgroundColor: plant.image.background || undefined,
            backgroundImage: plant.image.placeholder ? `url("${plant.image.placeholder}")` : undefined,
          }}
        >
          <img src={imageSrc(plant.image.url)} alt="" loading="lazy" decoding="async" />
          {sold ? (
            <span className="shop-card__badge shop-card__badge--sold">Sold out</span>
          ) : off > 0 ? (
            <span className="shop-card__badge">{off}% off</span>
          ) : null}

          {/* The pot logo in the photo is too small to read at this size, so every
              card carries the brand leaf itself. */}
          <span className="shop-card__mark" aria-hidden="true">
            <Leaf className="shop-card__mark-leaf" />
          </span>
        </span>

        <span className="shop-card__body">
          <span className="shop-card__name">{plant.common_name}</span>

          {plant.price_minor == null ? (
            // Sold out already says what the badge needs to; "ask for price" on top is noise.
            !sold && <span className="shop-card__ask">Ask for price</span>
          ) : (
            <span className={`shop-card__price${sold ? ' is-sold' : ''}`}>
              <strong>{formatPrice(plant.price_minor, plant.currency)}</strong>
              {off > 0 && !sold && <s>{formatPrice(plant.original_price_minor, plant.currency)}</s>}
            </span>
          )}

          {plant.price_note && <span className="shop-card__note">{plant.price_note}</span>}
        </span>
      </Link>

      {/* Beside the link, not inside it: a button cannot sit inside a link. This
          layer is the size of the photo, so the button lands on its bottom-right
          corner, opposite the leaf. */}
      {!sold && (
        <div className="shop-card__tools">
          <CardAdd plant={plant} />
        </div>
      )}
    </div>
  )
}
