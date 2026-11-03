import { useEffect, useLayoutEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, m } from 'motion/react'
import PlantView from '../components/PlantView.jsx'
import * as api from '../lib/api.js'
import NotFound from './NotFound.jsx'

/** What to show for a slug before any request: the plant, if we already have it. */
function fromCache(slug) {
  const plant = api.peekPlant(slug)
  return plant ? { slug, status: 'ready', plant } : { slug, status: 'loading' }
}

/**
 * /<slug> — almost always the first and only page a visitor sees, so it has
 * to stand completely on its own.
 */
export default function PlantPage() {
  const { slug } = useParams()
  const [state, setState] = useState(() => fromCache(slug))
  const [attempt, setAttempt] = useState(0)

  // Moving to another plant re-renders this same component with a new slug.
  // A plant already fetched (every suggestion is, once it's on screen) shows
  // in that very render, with no loading frame in between.
  const current = state.slug === slug ? state : fromCache(slug)

  // Suggestions sit at the bottom of the page, and the router keeps the
  // scroll position, so without this the next plant opens halfway down.
  // Before paint, so the photo hand-over captures the top of the new page.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  useEffect(() => {
    const cached = fromCache(slug)
    if (cached.status === 'ready') {
      setState(cached)
      return
    }

    let cancelled = false
    setState(cached)

    api
      .getPlant(slug)
      .then((plant) => !cancelled && setState({ slug, status: 'ready', plant }))
      .catch((error) => {
        if (cancelled) return
        setState({ slug, status: error.status === 404 ? 'missing' : 'failed', error })
      })

    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  // The skeleton fades out before the page arrives, rather than being cut
  // away. Moving between two plants keeps the same key, so nothing waits.
  return (
    <AnimatePresence mode="wait" initial={false}>
      {current.status === 'loading' ? (
        <PlantSkeleton key="loading" />
      ) : (
        <m.div
          key={current.status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {current.status === 'ready' && <PlantView key={slug} plant={current.plant} />}
          {current.status === 'missing' && <NotFound />}
          {current.status === 'failed' && <LoadFailed onRetry={() => setAttempt((n) => n + 1)} />}
        </m.div>
      )}
    </AnimatePresence>
  )
}

function LoadFailed({ onRetry }) {
  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Couldn’t load</h1>
        <p className="lede">
          The connection dropped while fetching this plant. It’s usually the signal.
        </p>
        <button type="button" className="status" onClick={onRetry}>
          Try again
        </button>
      </section>
    </main>
  )
}

/**
 * The page's own shape while it loads, rather than a line of text.
 *
 * This is the screen people see most: a shop's Wi-Fi is slow and the photo is
 * the heavy part. Showing the layout that is about to arrive reads as faster
 * than a spinner does, because nothing jumps when the real thing lands.
 */
function PlantSkeleton() {
  useEffect(() => {
    document.body.classList.add('is-plant')
    return () => document.body.classList.remove('is-plant')
  }, [])

  return (
    <m.div
      className="pl pl-skeleton"
      role="status"
      aria-label="Loading plant"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="pl-hero pl-skeleton__hero" />
      <div className="pl-sheet">
        <span className="pl-skeleton__line pl-skeleton__line--chip" />
        <span className="pl-skeleton__line pl-skeleton__line--title" />
        <span className="pl-skeleton__line pl-skeleton__line--latin" />
        <div className="pl-skeleton__tiles">
          <span className="pl-skeleton__tile" />
          <span className="pl-skeleton__tile" />
        </div>
        <span className="pl-skeleton__line pl-skeleton__line--label" />
        <span className="pl-skeleton__line" />
        <span className="pl-skeleton__line pl-skeleton__line--short" />
      </div>
    </m.div>
  )
}
