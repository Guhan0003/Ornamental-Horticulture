import Leaf from '../components/Leaf.jsx'
import PlantSearch from '../components/PlantSearch.jsx'

export default function Home() {
  return (
    <main className="page">
      <div className="glow" aria-hidden="true" />

      <header className="home-top">
        <PlantSearch />
      </header>

      <section className="card">
        <Leaf />

        <p className="brand">StomatalWorld</p>

        <h1 className="title">
          Ornamental
          <br />
          Horticulture
        </h1>

        <p className="lede">
          A page for every plant on the shelf. Scan the code, know exactly what you are
          looking at — what it needs, and how to keep it alive.
        </p>
      </section>

      <footer className="footer">© {new Date().getFullYear()} StomatalWorld</footer>
    </main>
  )
}
