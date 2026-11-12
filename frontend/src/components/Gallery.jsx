import { useCallback, useEffect, useRef, useState } from 'react'
import Leaf from './Leaf.jsx'
import PhotoNote from './PhotoNote.jsx'
import { imageSrc } from '../lib/api.js'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// How many photos past the one on screen may be fetched, once that one has arrived.
const AHEAD = 2

// A mouse drag this fast (pixels per millisecond) goes to the next photo even
// when it was short, the way a flick of a finger does.
const FLICK = 0.4

/**
 * The photos at the top of a plant page, swiped sideways.
 *
 * The sliding is the browser's own: a row of full-width slides that scrolls
 * and snaps (CSS scroll-snap). Momentum, rubber-banding and the finger
 * tracking exactly are all done by the browser off the main thread, which is
 * why it stays smooth on a cheap phone where a JavaScript slider would stutter.
 * This component adds only what CSS can't: which photo is showing, the dots,
 * dragging with a mouse, and fetching photos in a sensible order.
 *
 * That order matters on a shop's Wi-Fi. The cover loads first, with priority.
 * The photos after it are fetched only once the one on screen has arrived, so
 * they are ready before the swipe without ever competing with the cover for
 * the connection, and each is decoded before it is shown so the first frame it
 * appears in does not drop. Until a photo arrives its blurred preview fills the slide.
 *
 * `photos` is the cover followed by the gallery, each { url, alt, placeholder, background }.
 * `realPhoto` is the WhatsApp link for asking to see the real plant, or null.
 */
export default function Gallery({ photos, name, realPhoto = null }) {
  const heroRef = useRef(null)
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const [loaded, setLoaded] = useState(() => new Set())
  // The furthest slide whose photo may be fetched.
  const [reach, setReach] = useState(0)
  const count = photos.length

  // A photo counts as loaded once it has arrived *and* been decoded, so the
  // fade-in never starts on a frame that still has to do the decoding.
  const reveal = useCallback((index, img) => {
    const show = () => setLoaded((now) => (now.has(index) ? now : new Set(now).add(index)))
    if (img.decode) img.decode().then(show, show)
    else show()
  }, [])

  // Which photo is showing, from how far the row has scrolled.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const update = () => {
      frame = 0
      if (track.clientWidth) setActive(Math.round(track.scrollLeft / track.clientWidth))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  // The photo on screen may always load; the next few once this one has.
  useEffect(() => {
    setReach((now) => Math.max(now, active, loaded.has(active) ? active + AHEAD : 0))
  }, [active, loaded])

  // A cached photo can finish before React attaches onLoad.
  useEffect(() => {
    trackRef.current?.querySelectorAll('img').forEach((img, index) => {
      if (img.complete && img.naturalWidth) reveal(index, img)
    })
  }, [reach, reveal])

  // Gentle parallax: the photo drifts up slower than the page scrolls.
  useEffect(() => {
    const hero = heroRef.current
    if (!hero || reducedMotion()) return

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

  const go = useCallback(
    (index) => {
      const track = trackRef.current
      if (!track) return
      const target = Math.max(0, Math.min(count - 1, index))
      // Start fetching the destination now, so a jump does not arrive at a blur.
      setReach((now) => Math.max(now, target))
      track.scrollTo({
        left: target * track.clientWidth,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
    },
    [count],
  )

  // Dragging with a mouse or a pen. A finger needs none of this: the browser
  // already follows it, so touch is left alone. While a drag is in progress the
  // snapping is switched off, so the row follows the pointer exactly; on release
  // it glides to the nearest photo (or the next one, after a flick).
  useEffect(() => {
    const track = trackRef.current
    if (!track || count < 2) return

    let drag = null

    const settle = () => track.classList.remove('is-dragging')

    const onDown = (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      const now = performance.now()
      drag = { x: event.clientX, left: track.scrollLeft, moved: false, last: event.clientX, at: now, speed: 0 }
    }

    const onMove = (event) => {
      if (!drag) return
      const dx = event.clientX - drag.x
      if (!drag.moved) {
        if (Math.abs(dx) < 5) return
        drag.moved = true
        track.setPointerCapture(event.pointerId)
        track.classList.add('is-dragging')
      }
      track.scrollLeft = drag.left - dx

      const now = performance.now()
      drag.speed = (event.clientX - drag.last) / Math.max(1, now - drag.at)
      drag.last = event.clientX
      drag.at = now
    }

    const onUp = () => {
      if (!drag) return
      const { moved, speed } = drag
      drag = null
      if (!moved) return

      const width = track.clientWidth
      const position = track.scrollLeft / width
      let target = Math.round(position)
      // Dragging left (negative speed) moves on to the next photo.
      if (Math.abs(speed) > FLICK) target = speed < 0 ? Math.ceil(position) : Math.floor(position)

      go(target)
      // Snapping stays off until the glide has finished, or re-enabling it would jump.
      if ('onscrollend' in window) track.addEventListener('scrollend', settle, { once: true })
      setTimeout(settle, 900)
    }

    track.addEventListener('pointerdown', onDown)
    track.addEventListener('pointermove', onMove)
    track.addEventListener('pointerup', onUp)
    track.addEventListener('pointercancel', onUp)
    return () => {
      track.removeEventListener('pointerdown', onDown)
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
      track.removeEventListener('pointercancel', onUp)
    }
  }, [count, go])

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') go(active + 1)
    else if (event.key === 'ArrowLeft') go(active - 1)
    else return
    event.preventDefault()
  }

  const several = count > 1

  return (
    <div
      className="pl-hero"
      ref={heroRef}
      role={several ? 'group' : undefined}
      aria-roledescription={several ? 'carousel' : undefined}
      aria-label={several ? `Photos of ${name}` : undefined}
    >
      <ul
        className="pl-track"
        ref={trackRef}
        tabIndex={several ? 0 : undefined}
        onKeyDown={several ? onKeyDown : undefined}
      >
        {photos.map((photo, index) => (
          <li
            key={`${index}-${photo.url}`}
            className={`pl-slide${loaded.has(index) ? ' is-loaded' : ''}`}
            style={{
              backgroundColor: photo.background || undefined,
              backgroundImage: photo.placeholder ? `url("${photo.placeholder}")` : undefined,
            }}
            aria-roledescription={several ? 'slide' : undefined}
            aria-label={several ? `Photo ${index + 1} of ${count}` : undefined}
          >
            <img
              className="pl-hero__img"
              // The cover's name lets it travel from the shop card that was tapped.
              style={index === 0 ? { viewTransitionName: 'plant-photo' } : undefined}
              src={index <= reach ? imageSrc(photo.url) : undefined}
              alt={photo.alt}
              fetchPriority={index === 0 ? 'high' : undefined}
              decoding="async"
              draggable={false}
              onLoad={(event) => reveal(index, event.currentTarget)}
            />
          </li>
        ))}
      </ul>

      <div className="pl-hero__brand">
        <Leaf className="pl-hero__leaf" />
        StomatalWorld
      </div>

      {/* Every photo says it is a reference image, and offers a real one. */}
      <PhotoNote action={realPhoto} />

      {several && (
        <>
          <span className="pl-count" aria-live="polite">
            {Math.min(active, count - 1) + 1} / {count}
          </span>

          <div className="pl-pager" role="group" aria-label="Choose a photo">
            {photos.map((photo, index) => (
              <button
                key={`${index}-${photo.url}`}
                type="button"
                className="pl-pager__btn"
                aria-label={`Photo ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => go(index)}
              >
                <span className="pl-pager__dot" />
              </button>
            ))}
          </div>

          {/* A mouse can also drag; the arrows are for one that would rather click. */}
          <button
            type="button"
            className="pl-arrow pl-arrow--prev"
            aria-label="Previous photo"
            onClick={() => go(active - 1)}
            disabled={active === 0}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            className="pl-arrow pl-arrow--next"
            aria-label="Next photo"
            onClick={() => go(active + 1)}
            disabled={active >= count - 1}
          >
            <Chevron direction="right" />
          </button>
        </>
      )}
    </div>
  )
}

function Chevron({ direction }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'} />
    </svg>
  )
}
