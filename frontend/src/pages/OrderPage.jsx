import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Leaf from '../components/Leaf.jsx'
import * as api from '../lib/api.js'
import { availabilityLabel, formatPrice, isSoldOut } from '../lib/commerce.js'
import { parseOrder, snapshot, totals } from '../lib/list.js'
import '../styles/order.css'

/**
 * /order?p=philodendron-birkin.2,neon-pothos — every plant in one customer's order,
 * with its photo.
 *
 * A WhatsApp message can only carry text, so when someone sends their list the
 * message ends with a link to this page. The shop opens it to see exactly which
 * plants were meant, how many of each and what it adds up to, instead of
 * working it out from names.
 *
 * It holds nothing of its own: the link says which plants and how many, and the
 * names, photos and prices come from the shop's plant list, so it is always the
 * plant as it is now. Nothing private is in the link.
 */
export default function OrderPage() {
  const [params] = useSearchParams()
  const wanted = useMemo(() => parseOrder(params.get('p')), [params])

  const [plants, setPlants] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const previous = document.title
    document.title = 'Plant order — StomatalWorld'
    // One person's order is not something for a search engine to list.
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    window.scrollTo(0, 0)

    return () => {
      document.title = previous
      robots.remove()
    }
  }, [])

  useEffect(() => {
    if (wanted.length === 0) return
    let cancelled = false
    setFailed(false)
    api
      .listPlants()
      .then((list) => !cancelled && setPlants(list))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt, wanted.length])

  const { rows, missing, sum } = useMemo(() => {
    const bySlug = new Map((plants ?? []).map((plant) => [plant.slug, plant]))
    const found = wanted
      .filter(({ slug }) => bySlug.has(slug))
      .map(({ slug, qty }) => ({ plant: bySlug.get(slug), qty }))
    return {
      rows: found,
      missing: wanted.length - found.length,
      sum: totals(found.map(({ plant, qty }) => ({ ...snapshot(plant), qty }))),
    }
  }, [plants, wanted])

  return (
    <main className="order">
      <Link to="/" className="order__brand">
        <Leaf className="order__leaf" />
        StomatalWorld
      </Link>

      <h1 className="order__title">Plant order</h1>

      {wanted.length === 0 ? (
        <Empty>This link does not name any plants.</Empty>
      ) : failed ? (
        <Empty>
          The connection dropped while loading the plants.
          <button type="button" className="order__retry" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </Empty>
      ) : !plants ? (
        <Skeleton count={wanted.length} />
      ) : rows.length === 0 ? (
        <Empty>None of the plants in this link are on the site any more.</Empty>
      ) : (
        <>
          <p className="order__sub">
            {rows.length} {rows.length === 1 ? 'plant' : 'plants'}
            {sum.pieces !== rows.length && ` · ${sum.pieces} pieces`}
          </p>

          <ul className="order__grid">
            {rows.map(({ plant, qty }, index) => (
              <li key={plant.slug}>
                <Tile plant={plant} qty={qty} first={index < 4} />
              </li>
            ))}
          </ul>

          <section className="order__total" aria-label="Total">
            <span>Total</span>
            <strong>
              {sum.priced > 0 ? formatPrice(sum.total, sum.currency) : 'On request'}
            </strong>
            {sum.priced > 0 && sum.unpriced > 0 && (
              <small>plus {sum.unpriced} on request</small>
            )}
          </section>

          {(missing > 0 || sum.soldOut > 0) && (
            <p className="order__note">
              {sum.soldOut > 0 &&
                `${sum.soldOut} sold out ${sum.soldOut === 1 ? 'plant is' : 'plants are'} not counted. `}
              {missing > 0 &&
                `${missing} ${missing === 1 ? 'plant is' : 'plants are'} no longer on the site.`}
            </p>
          )}

          <p className="order__foot">
            Prices and stock are as on the shop right now. Tap a plant to open its page.
          </p>
        </>
      )}

      <Link to="/" className="order__shop">
        Back to the shop
      </Link>
    </main>
  )
}

function Tile({ plant, qty, first }) {
  const sold = isSoldOut(plant)
  const price = formatPrice(plant.price_minor, plant.currency)

  return (
    <Link to={`/${plant.slug}`} className={`order-tile${sold ? ' is-sold' : ''}`}>
      <span
        className="order-tile__photo"
        style={{
          backgroundColor: plant.image.background || undefined,
          backgroundImage: plant.image.placeholder ? `url("${plant.image.placeholder}")` : undefined,
        }}
      >
        <img
          src={api.imageSrc(plant.image.url)}
          alt={plant.image.alt || plant.common_name}
          loading={first ? 'eager' : 'lazy'}
          decoding="async"
        />
        {qty > 1 && <span className="order-tile__qty">× {qty}</span>}
        {sold && <span className="order-tile__badge">Sold out</span>}
      </span>

      <span className="order-tile__name">{plant.common_name}</span>
      <span className="order-tile__price">
        {price ? (
          <>
            <b>{formatPrice(plant.price_minor * qty, plant.currency)}</b>
            {qty > 1 && <small> {price} each</small>}
          </>
        ) : (
          <b>Price on request</b>
        )}
      </span>
      {plant.availability === 'ask' && (
        <span className="order-tile__ask">{availabilityLabel(plant.availability)} — check availability</span>
      )}
    </Link>
  )
}

function Skeleton({ count }) {
  return (
    <ul className="order__grid" role="status" aria-label="Loading the plants">
      {Array.from({ length: Math.min(count, 6) }, (_, n) => (
        <li key={n}>
          <span className="order-tile order-tile--skeleton">
            <span className="order-tile__photo" />
            <span className="order-tile__line" />
            <span className="order-tile__line order-tile__line--short" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }) {
  return <p className="order__empty">{children}</p>
}
