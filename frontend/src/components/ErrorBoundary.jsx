import { Component } from 'react'

/**
 * The last line between a render error and a blank white screen.
 *
 * A customer meets this page standing in a shop with a phone in their hand,
 * so it offers the one thing that usually works — load it again — rather than
 * a stack trace nobody there can act on.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // Still worth having in the console for whoever looks later.
    console.error('Page failed to render', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="page">
        <section className="card">
          <h1 className="title">Something went wrong</h1>
          <p className="lede">
            This page couldn’t be shown. Loading it again usually fixes it.
          </p>
          <button type="button" className="status" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      </main>
    )
  }
}
