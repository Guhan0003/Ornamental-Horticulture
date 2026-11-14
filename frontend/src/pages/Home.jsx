import { useEffect, useState } from 'react'
import Catalogue from '../components/Catalogue.jsx'
import Leaf from '../components/Leaf.jsx'
import PhotoLine from '../components/PhotoLine.jsx'
import * as api from '../lib/api.js'
import { realPhotoAction } from '../lib/commerce.js'

export default function Home() {
  const [plants, setPlants] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // One small request feeds the shop.
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    api
      .listPlants()
      .then((list) => !cancelled && setPlants(list))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <main className="page page--home">
      <div className="glow" aria-hidden="true" />

      <section className="card home-hero">
        <Leaf />

        <h1 className="title">StomatalWorld</h1>

        <p className="lede">Live plants, ready to take home.</p>
      </section>

      <Catalogue plants={plants} failed={failed} onRetry={() => setAttempt((n) => n + 1)} />

      <footer className="footer">
        <PhotoLine className="footer__photos" action={realPhotoAction(null)} />
        © {new Date().getFullYear()} StomatalWorld
      </footer>
    </main>
  )
}
