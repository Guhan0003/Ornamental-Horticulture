import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PlantView from '../components/PlantView.jsx'
import * as api from '../lib/api.js'
import NotFound from './NotFound.jsx'

/**
 * /<slug> — almost always the first and only page a visitor sees, so it has
 * to stand completely on its own.
 */
export default function PlantPage() {
  const { slug } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    // Suggestions sit at the bottom of the page, and the router keeps the
    // scroll position, so without this the next plant opens halfway down.
    window.scrollTo(0, 0)

    api
      .getPlant(slug)
      .then((plant) => !cancelled && setState({ status: 'ready', plant }))
      .catch((error) => {
        if (cancelled) return
        setState({ status: error.status === 404 ? 'missing' : 'failed', error })
      })

    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  if (state.status === 'ready') return <PlantView plant={state.plant} />
  if (state.status === 'missing') return <NotFound />
  if (state.status === 'loading') return <PlantSkeleton />

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Couldn’t load</h1>
        <p className="lede">
          The connection dropped while fetching this plant. It’s usually the signal.
        </p>
        <button type="button" className="status" onClick={() => setAttempt((n) => n + 1)}>
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
    <div className="pl pl-skeleton" role="status" aria-label="Loading plant">
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
    </div>
  )
}
