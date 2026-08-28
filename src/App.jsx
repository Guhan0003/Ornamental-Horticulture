export default function App() {
  return (
    <main className="page">
      <div className="glow" aria-hidden="true" />

      <section className="card">
        <Leaf />

        <p className="brand">StomatalWorld</p>

        <h1 className="title">
          Ornamental
          <br />
          Horticulture
        </h1>

        <p className="lede">
          A page for every plant on the shelf. Scan the code, know exactly what
          you are looking at — what it needs, and how to keep it alive.
        </p>

        <div className="status">
          <span className="dot" aria-hidden="true" />
          Building now — live within a month
        </div>
      </section>

      <footer className="footer">© {new Date().getFullYear()} StomatalWorld</footer>
    </main>
  )
}

function Leaf() {
  return (
    <svg
      className="leaf"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40 8C40 8 38 30 26 38C18 43.3 10 40 10 40C10 40 12 18 24 10C32 4.7 40 8 40 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M34 14C34 14 20 24 8 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
