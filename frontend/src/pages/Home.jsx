import { useEffect, useState } from 'react'
import Catalogue from '../components/Catalogue.jsx'
import Leaf from '../components/Leaf.jsx'
import PlantSearch from '../components/PlantSearch.jsx'
import * as api from '../lib/api.js'

export default function Home() {
  const [plants, setPlants] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // One small request feeds both the search box and the shop below it.
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

      <header className="home-top">
        <PlantSearch plants={plants} failed={failed} />
      </header>

      <section className="card home-hero">
        <Leaf />

        <p className="brand">StomatalWorld</p>

        <h1 className="title">
          Ornamental
          <br />
          Horticulture
        </h1>

        <p className="lede">
          Live plants, ready to take home. Open any one to see what it needs and how to keep it
          alive — then order it on WhatsApp.
        </p>
      </section>

      <Catalogue plants={plants} failed={failed} onRetry={() => setAttempt((n) => n + 1)} />

      <footer className="footer">© {new Date().getFullYear()} StomatalWorld</footer>
    </main>
  )
}
