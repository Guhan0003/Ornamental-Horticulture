import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { m, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import Icon from './Icon.jsx'
import Leaf from './Leaf.jsx'
import { imageSrc, peekPlant, prefetchPlant } from '../lib/api.js'
import { pop, reveal, rise, settle, stagger } from '../lib/motion.js'
import { LIGHT_SCALE } from '../lib/plantFormat.js'
import '../styles/plant.css'

const FALLBACK_BACKDROP = '#dfe2dc'

/**
 * Photos already on screen once this visit. The hero skips its fade-in for
 * these, so a photo carried over from a suggestion card lands sharp instead
 * of blurring out and back in.
 */
const shownPhotos = new Set()

/**
 * Resolves the view transition once the next plant is on screen. The router
 * applies navigations as React transitions, which flushSync can't force, so
 * the browser is told to wait for the page itself to say it has arrived.
 */
let arrived = null
const ARRIVAL_TIMEOUT = 800

/**
 * The plant page itself, rendered from one plant as the API returns it.
 * Optional sections simply don't render when empty, so a sparse plant still
 * reads as a finished page.
 */
export default function PlantView({ plant }) {
  const { profile, image } = plant
  const backdrop = image.background || FALLBACK_BACKDROP
  const wide = useMediaQuery('(min-width: 900px)')

  usePageChrome(plant.common_name, backdrop)

  // Runs before the parent scrolls back to the top, but the transition only
  // continues after this whole render has been committed, scroll included.
  useLayoutEffect(() => {
    arrived?.()
    arrived = null
  }, [plant.slug])

  const { light, landscape_use: landscape, home_use: home } = profile
  const hasLight = light.label || light.ideal.length > 0
  const hasProfile =
    profile.environment || hasLight || landscape.items.length > 0 || home.items.length > 0

  // Tiles in the same row arrive one after another.
  let tile = 0

  return (
    <div className="pl" style={{ '--photo-bg': backdrop }}>
      <Hero image={image} wide={wide} />

      {/* The sheet slides up over the photo on a phone; beside it, it fades in. */}
      <m.main
        className="pl-sheet"
        initial={wide ? { opacity: 0 } : { y: 56 }}
        animate={wide ? { opacity: 1 } : { y: 0 }}
        transition={{ ...settle, delay: 0.1 }}
      >
        <m.header
          className="pl-identity"
          variants={stagger(0.09, 0.3)}
          initial="hidden"
          animate="shown"
        >
          {profile.environment && (
            <m.span className="pl-chip" variants={rise}>
              <Icon name="home" className="pl-chip__icon" />
              {profile.environment} plant
            </m.span>
          )}
          <PlantName name={plant.common_name} />
          {plant.scientific_name && (
            <m.p className="pl-latin" variants={rise}>
              {plant.scientific_name}
            </m.p>
          )}
        </m.header>

        {hasProfile && (
          <section className="pl-section" aria-labelledby="profile-title">
            <m.h2 id="profile-title" className="pl-label" {...reveal()}>
              Quick Profile
            </m.h2>

            <div className="pl-profile">
              {profile.environment && (
                <Tile className="pl-tile--inline" order={tile++}>
                  <TileHead icon="home" title="Environment" />
                  <p className="pl-tile__value">{profile.environment}</p>
                </Tile>
              )}

              {hasLight && (
                <Tile order={tile++}>
                  <TileHead icon="sun" title="Light need" />
                  {light.label && <p className="pl-tile__value">{light.label}</p>}
                  {light.ideal.length > 0 && <LightMeter light={light} />}
                </Tile>
              )}

              {landscape.items.length > 0 && (
                <Tile className="pl-tile--half" order={tile++}>
                  <TileHead icon="landscape" title="Landscape use" />
                  <Chips items={landscape.items} />
                  {landscape.note && <p className="pl-tile__note">{landscape.note}</p>}
                </Tile>
              )}

              {home.items.length > 0 && (
                <Tile className="pl-tile--half" order={tile++}>
                  <TileHead icon="pot" title="Home use" />
                  <Chips items={home.items} />
                  {home.note && <p className="pl-tile__note">{home.note}</p>}
                </Tile>
              )}
            </div>
          </section>
        )}

        <section className="pl-section" aria-labelledby="snap-title">
          <m.h2 id="snap-title" className="pl-label" {...reveal()}>
            The Snap
          </m.h2>
          <m.blockquote className="pl-snap" {...reveal()}>
            <Leaf className="pl-snap__leaf" draw />
            <p>{plant.snap}</p>
          </m.blockquote>
        </section>

        <section className="pl-section" aria-labelledby="dive-title">
          <m.h2 id="dive-title" className="pl-label" {...reveal()}>
            The Deep Dive
          </m.h2>
          <DeepDive points={plant.deep_dive} />
        </section>

        {plant.related?.length > 0 && <AlsoLike plants={plant.related} />}

        <m.footer className="pl-footer" {...reveal()}>
          <Leaf className="pl-footer__leaf" draw />
          <span>StomatalWorld</span>
          <span className="pl-footer__sub">Ornamental Horticulture</span>
        </m.footer>
      </m.main>
    </div>
  )
}

/** The name rises in word by word, each on its own spring. */
const word = {
  hidden: { opacity: 0, y: '0.45em', rotate: 2 },
  shown: { opacity: 1, y: 0, rotate: 0, transition: { ...settle, stiffness: 120 } },
}

function PlantName({ name }) {
  const words = name.split(/\s+/).filter(Boolean)

  return (
    <m.h1 className="pl-name" variants={stagger(0.08)}>
      {words.map((text, index) => (
        <span key={index}>
          <m.span className="pl-name__word" variants={word}>
            {text}
          </m.span>
          {index < words.length - 1 && ' '}
        </span>
      ))}
    </m.h1>
  )
}

function Tile({ className = '', order, children }) {
  return (
    <m.article
      className={`pl-tile ${className}`}
      {...reveal({
        hidden: rise.hidden,
        shown: { ...rise.shown, transition: { ...settle, delay: order * 0.06 } },
      })}
      whileHover={{ y: -2 }}
    >
      {children}
    </m.article>
  )
}

/**
 * The Deep Dive as a timeline. One line runs from the first marker to the
 * last and grows as you read down it; each marker pops in as its point
 * arrives.
 */
function DeepDive({ points }) {
  const listRef = useRef(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start 80%', 'end 85%'],
  })
  const grow = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })

  // The line starts at the centre of the first marker and ends at the centre
  // of the last. offsetTop ignores transforms, so points still sliding into
  // place don't throw the measurement off.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const measure = () => {
      const markers = [...list.querySelectorAll('.pl-dive__marker')]
      if (markers.length < 2) return
      const centre = (marker) =>
        marker.parentElement.offsetTop + marker.offsetTop + marker.offsetHeight / 2
      list.style.setProperty('--line-top', `${centre(markers[0])}px`)
      list.style.setProperty(
        '--line-length',
        `${centre(markers.at(-1)) - centre(markers[0])}px`,
      )
    }

    measure()
    if (!('ResizeObserver' in window)) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [points])

  return (
    <ol className="pl-dive" ref={listRef}>
      {points.length > 1 && (
        <m.span
          className="pl-dive__line"
          aria-hidden="true"
          style={{ scaleY: reduced ? 1 : grow }}
        />
      )}

      {points.map((item, index) => (
        <m.li className="pl-dive__item" key={`${index}-${item.title}`} {...reveal()}>
          <m.span
            className="pl-dive__marker"
            variants={{
              hidden: { scale: 0.4, opacity: 0 },
              shown: { scale: 1, opacity: 1, transition: { ...pop, delay: 0.08 } },
            }}
          >
            <Icon name={item.icon} />
          </m.span>
          <div>
            <h3 className="pl-dive__title">{item.title}</h3>
            <p className="pl-dive__body">{item.body}</p>
          </div>
        </m.li>
      ))}
    </ol>
  )
}

/**
 * Pass the travelling name from the hero to the card being tapped.
 *
 * Only one element on a page may carry a view-transition name, so the hero
 * gives it up as the card takes it: the browser then matches that card to the
 * next page's hero and moves the photo between them, instead of the page
 * flashing white and fetching it again.
 */
function handOver(card) {
  const hero = document.querySelector('.pl-hero__img')
  if (hero) hero.style.viewTransitionName = 'none'

  const photo = card.querySelector('img')
  if (photo) photo.style.viewTransitionName = 'plant-photo'
}

const plainClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/**
 * Three plants like this one.
 *
 * A QR scan lands here and used to end here. These are shown as photos
 * because that is how anyone recognises a plant — the name underneath is
 * confirmation, not the hook.
 */
function AlsoLike({ plants }) {
  const ref = useRef(null)
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  // Fetch them once the shelf is actually on screen, so tapping one opens it
  // immediately. Nobody hovers on a phone, so there is no earlier signal.
  useEffect(() => {
    const shelf = ref.current
    if (!shelf) return

    const warm = () => plants.forEach((plant) => prefetchPlant(plant.slug))

    if (!('IntersectionObserver' in window)) return warm()

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        warm()
        observer.disconnect()
      },
      { rootMargin: '200px' },
    )
    observer.observe(shelf)
    return () => observer.disconnect()
  }, [plants])

  // The photo flies from the card into the next page's hero. That needs the
  // next page to be ready in the same frame, so it only happens once the
  // plant has been fetched; until then the link simply navigates.
  function open(event, slug) {
    if (!plainClick(event) || reduced || !document.startViewTransition || !peekPlant(slug)) return

    event.preventDefault()
    handOver(event.currentTarget)
    document.startViewTransition(
      () =>
        new Promise((resolve) => {
          arrived = resolve
          // Never leave the screen frozen if the page somehow doesn't arrive.
          setTimeout(resolve, ARRIVAL_TIMEOUT)
          navigate(`/${slug}`)
        }),
    )
  }

  return (
    <section className="pl-section" aria-labelledby="also-title" ref={ref}>
      <m.h2 id="also-title" className="pl-label" {...reveal()}>
        You may also like
      </m.h2>

      <m.ul className="pl-also" {...reveal(stagger(0.08))}>
        {plants.map((plant) => (
          // Lifts on press rather than on hover: a phone has no hover, and
          // this is the only feedback a thumb ever gets.
          <m.li key={plant.slug} variants={rise} whileTap={{ scale: 0.95 }}>
            <Link
              className="pl-also__card"
              to={`/${plant.slug}`}
              onClick={(event) => open(event, plant.slug)}
            >
              <span
                className="pl-also__frame"
                style={{
                  backgroundColor: plant.image.background || undefined,
                  backgroundImage: plant.image.placeholder
                    ? `url("${plant.image.placeholder}")`
                    : undefined,
                }}
              >
                <img
                  src={imageSrc(plant.image.url)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={() => shownPhotos.add(imageSrc(plant.image.url))}
                />
              </span>
              <span className="pl-also__name">{plant.common_name}</span>
            </Link>
          </m.li>
        ))}
      </m.ul>
    </section>
  )
}

const photoIn = {
  hidden: { opacity: 0, scale: 1.08, filter: 'blur(12px)' },
  shown: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 1.1, ease: [0.2, 0.75, 0.25, 1] },
  },
}

function Hero({ image, wide }) {
  const src = imageSrc(image.url)
  const [loaded, setLoaded] = useState(() => shownPhotos.has(src))
  const imgRef = useRef(null)
  const reduced = useReducedMotion()

  // A cached photo can finish before React attaches onLoad.
  useLayoutEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  // As the sheet slides over it, the photo drifts up slower than the page,
  // grows a touch and dims, so the eye follows the text instead.
  const { scrollY } = useScroll()
  const drift = useTransform(scrollY, [0, 800], [0, 280], { clamp: true })
  const grow = useTransform(scrollY, [0, 600], [1, 1.08], { clamp: true })
  const dim = useTransform(scrollY, [0, 600], [0, 0.35], { clamp: true })
  // Beside the text on a wide screen, the photo stays put.
  const still = wide || reduced

  return (
    <div
      className="pl-hero"
      style={image.placeholder ? { backgroundImage: `url("${image.placeholder}")` } : undefined}
    >
      <div className="pl-hero__brand">
        <Leaf className="pl-hero__leaf" />
        StomatalWorld
      </div>

      <m.div className="pl-hero__media" style={still ? undefined : { y: drift, scale: grow }}>
        <m.img
          ref={imgRef}
          className="pl-hero__img"
          style={{ viewTransitionName: 'plant-photo' }}
          variants={photoIn}
          initial={shownPhotos.has(src) ? false : 'hidden'}
          animate={loaded ? 'shown' : 'hidden'}
          src={src}
          alt={image.alt}
          fetchPriority="high"
          decoding="async"
          onLoad={() => {
            shownPhotos.add(src)
            setLoaded(true)
          }}
        />
      </m.div>

      {!still && <m.div className="pl-hero__shade" style={{ opacity: dim }} aria-hidden="true" />}
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

/** Each step of the meter fills in turn once the tile is on screen. */
const segment = {
  hidden: { scaleX: 0 },
  shown: (index) => ({
    scaleX: 1,
    transition: { type: 'spring', stiffness: 160, damping: 18, delay: 0.25 + index * 0.12 },
  }),
}

function LightMeter({ light }) {
  const levelOf = (index) =>
    light.ideal.includes(index) ? 'ideal' : light.tolerates.includes(index) ? 'ok' : 'no'

  return (
    <div className="pl-meter">
      <div className="pl-meter__bar" aria-hidden="true">
        {LIGHT_SCALE.map((step, index) => (
          <m.span
            key={step}
            className={`pl-meter__seg pl-meter__seg--${levelOf(index)}`}
            variants={segment}
            custom={index}
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

/** Whether a media query matches, kept up to date as the window changes. */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
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
