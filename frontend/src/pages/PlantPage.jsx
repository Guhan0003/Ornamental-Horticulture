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

  return (
    <main className="page">
      <section className="card">
        {state.status === 'loading' ? (
          <p className="lede" role="status">
            Loading plant…
          </p>
        ) : (
          <>
            <h1 className="title">Couldn’t load</h1>
            <p className="lede">
              The connection dropped while fetching this plant. It’s usually the signal.
            </p>
            <button type="button" className="status" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  )
}
