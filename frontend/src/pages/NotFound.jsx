import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Not found</h1>
        <p className="lede">
          That code doesn’t point to a plant we know about — it may not be published yet.
        </p>
        <Link className="status" to="/">
          Go to the homepage
        </Link>
      </section>
    </main>
  )
}
