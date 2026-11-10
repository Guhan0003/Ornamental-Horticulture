import { useLayoutEffect, useMemo, useState } from 'react'
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
import { handOver } from './PlantView.jsx'

const SCROLL_KEY = 'stomatalworld.home-scroll'
const ORDER_KEY = 'stomatalworld.home-order'

/**
 * Every plant, with its price: the shop. Two to a row on a phone, because a
 * photo is how anyone recognises a plant and the price under it is the next
 * thing they look for.
 *
 * By default the cards sit under their family — Philodendron, Pothos, Monstera
 * — because that is how someone holding one asks for the next one. Any price
 * order flattens it back to a single grid, since a cheapest-first list cut into
 * eight sections is not a cheapest-first list.
 *
 * `plants` is null while the list loads.
 */
export default function Catalogue({ plants, failed, onRetry }) {
  const [order, setOrder] = useState(rememberedOrder)
  const sorted = useMemo(() => sortPlants(plants ?? [], order), [plants, order])
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

  return (
    <section className="shop" aria-labelledby="shop-title">
      <header className="shop__head">
        <div>
          <h2 id="shop-title" className="shop__title">
            Our plants
          </h2>
          {plants && (
            <p className="shop__count">
              {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
            </p>
          )}
        </div>

        {plants?.length > 1 && (
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
        )}
      </header>

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
    </section>
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
  )
}
