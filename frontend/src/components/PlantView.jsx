import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import Leaf from './Leaf.jsx'
import { imageSrc } from '../lib/api.js'
import { LIGHT_SCALE } from '../lib/plantFormat.js'
import '../styles/plant.css'

const FALLBACK_BACKDROP = '#dfe2dc'

/**
 * The plant page itself, rendered from one plant as the API returns it.
 * Optional sections simply don't render when empty, so a sparse plant still
 * reads as a finished page.
 */
export default function PlantView({ plant }) {
  const { profile, image } = plant
  const backdrop = image.background || FALLBACK_BACKDROP

  usePageChrome(plant.common_name, backdrop)
  const rootRef = useReveal(plant.slug)

  const { light, landscape_use: landscape, home_use: home } = profile
  const hasLight = light.label || light.ideal.length > 0
  const hasProfile =
    profile.environment || hasLight || landscape.items.length > 0 || home.items.length > 0

  return (
    <div className="pl" ref={rootRef} style={{ '--photo-bg': backdrop }}>
      <Hero image={image} />

      <main className="pl-sheet">
        <header className="pl-identity">
          {profile.environment && (
            <span className="pl-chip pl-rise" style={{ '--i': 0 }}>
              <Icon name="home" className="pl-chip__icon" />
              {profile.environment} plant
            </span>
          )}
          <h1 className="pl-name pl-rise" style={{ '--i': 1 }}>
            {plant.common_name}
          </h1>
          {plant.scientific_name && (
            <p className="pl-latin pl-rise" style={{ '--i': 2 }}>
              {plant.scientific_name}
            </p>
          )}
        </header>

        {hasProfile && (
          <section className="pl-section" aria-labelledby="profile-title">
            <h2 id="profile-title" className="pl-label" data-reveal>
              Quick Profile
            </h2>

            <div className="pl-profile">
              {profile.environment && (
                <article className="pl-tile pl-tile--inline" data-reveal>
                  <TileHead icon="home" title="Environment" />
                  <p className="pl-tile__value">{profile.environment}</p>
                </article>
              )}

              {hasLight && (
                <article className="pl-tile" data-reveal>
                  <TileHead icon="sun" title="Light need" />
                  {light.label && <p className="pl-tile__value">{light.label}</p>}
                  {light.ideal.length > 0 && <LightMeter light={light} />}
                </article>
              )}

              {landscape.items.length > 0 && (
                <article className="pl-tile pl-tile--half" data-reveal>
                  <TileHead icon="landscape" title="Landscape use" />
                  <Chips items={landscape.items} />
                  {landscape.note && <p className="pl-tile__note">{landscape.note}</p>}
                </article>
              )}

              {home.items.length > 0 && (
                <article className="pl-tile pl-tile--half" data-reveal>
                  <TileHead icon="pot" title="Home use" />
                  <Chips items={home.items} />
                  {home.note && <p className="pl-tile__note">{home.note}</p>}
                </article>
              )}
            </div>
          </section>
        )}

        <section className="pl-section" aria-labelledby="snap-title">
          <h2 id="snap-title" className="pl-label" data-reveal>
            The Snap
          </h2>
          <blockquote className="pl-snap" data-reveal>
            <Leaf className="pl-snap__leaf" />
            <p>{plant.snap}</p>
          </blockquote>
        </section>

        <section className="pl-section" aria-labelledby="dive-title">
          <h2 id="dive-title" className="pl-label" data-reveal>
            The Deep Dive
          </h2>
          <ol className="pl-dive">
            {plant.deep_dive.map((item, index) => (
              <li className="pl-dive__item" key={`${index}-${item.title}`} data-reveal>
                <span className="pl-dive__marker">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <h3 className="pl-dive__title">{item.title}</h3>
                  <p className="pl-dive__body">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="pl-footer" data-reveal>
          <Leaf className="pl-footer__leaf" />
          <span>StomatalWorld</span>
          <span className="pl-footer__sub">Ornamental Horticulture</span>
        </footer>
      </main>
    </div>
  )
}

function Hero({ image }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef(null)
  const heroRef = useRef(null)

  // A cached photo can finish before React attaches onLoad.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  // Gentle parallax: the photo drifts up slower than the page scrolls.
  useEffect(() => {
    const hero = heroRef.current
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        hero.style.setProperty('--scroll', Math.min(window.scrollY, 800))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      className={`pl-hero${loaded ? ' is-loaded' : ''}`}
      ref={heroRef}
      style={image.placeholder ? { backgroundImage: `url("${image.placeholder}")` } : undefined}
    >
      <div className="pl-hero__brand">
        <Leaf className="pl-hero__leaf" />
        StomatalWorld
      </div>
      <img
        ref={imgRef}
        className="pl-hero__img"
        src={imageSrc(image.url)}
        alt={image.alt}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function TileHead({ icon, title }) {
  return (
    <h3 className="pl-tile__head">
      <span className="pl-tile__icon">
        <Icon name={icon} />
      </span>
      {title}
    </h3>
  )
}

function Chips({ items }) {
  return (
    <ul className="pl-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function LightMeter({ light }) {
  const levelOf = (index) =>
    light.ideal.includes(index) ? 'ideal' : light.tolerates.includes(index) ? 'ok' : 'no'

  return (
    <div className="pl-meter">
      <div className="pl-meter__bar" aria-hidden="true">
        {LIGHT_SCALE.map((step, index) => (
          <span
            key={step}
            className={`pl-meter__seg pl-meter__seg--${levelOf(index)}`}
            style={{ '--i': index }}
          />
        ))}
      </div>
      <div className="pl-meter__labels" aria-hidden="true">
        {LIGHT_SCALE.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
      <p className="pl-meter__legend">
        <span className="pl-dot pl-dot--ideal" /> Ideal
        {light.tolerates.length > 0 && (
          <>
            <span className="pl-dot pl-dot--ok" /> {light.note || 'Tolerated'}
          </>
        )}
      </p>
    </div>
  )
}

/** Title, light page background and browser chrome colour while a plant is open. */
function usePageChrome(name, backdrop) {
  useEffect(() => {
    const previousTitle = document.title
    const meta = document.querySelector('meta[name="theme-color"]')
    const previousColor = meta?.getAttribute('content')

    document.title = `${name} — StomatalWorld`
    meta?.setAttribute('content', backdrop)
    document.body.classList.add('is-plant')

    return () => {
      document.title = previousTitle
      if (previousColor) meta?.setAttribute('content', previousColor)
      document.body.classList.remove('is-plant')
    }
  }, [name, backdrop])
}

/** Fades sections in as they scroll into view. */
function useReveal(key) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const targets = root.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key])

  return rootRef
}
