import { useParams } from 'react-router-dom'
import BlockRenderer from '../components/blocks/BlockRenderer.jsx'

/**
 * The QR-code target. Almost always the first and only page a visitor sees,
 * so it has to stand completely on its own.
 *
 * Not wired to the API yet — see lib/api.js getPlant().
 */
export default function PlantPage() {
  const { slug } = useParams()

  // Placeholder until the backend is connected.
  const blocks = []

  return (
    <main className="page page--plant">
      <article className="plant">
        <p className="brand">StomatalWorld</p>
        <h1 className="plant__name">{slug}</h1>
        <p className="lede">This plant page is not built yet.</p>
        <BlockRenderer blocks={blocks} />
      </article>
    </main>
  )
}
