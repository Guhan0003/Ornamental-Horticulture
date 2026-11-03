/**
 * Shared motion presets, so every part of the site moves the same way.
 *
 * Springs rather than fixed curves: they settle the way a leaf does, and a
 * tap that interrupts one carries on from where it is instead of jumping.
 */

/** Calm and quick to settle: entrances, reveals. */
export const settle = { type: 'spring', stiffness: 140, damping: 22, mass: 0.9 }

/** A little overshoot: things that pop, like icons and the contact card. */
export const pop = { type: 'spring', stiffness: 420, damping: 26 }

/** Fades up into place. */
export const rise = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: settle },
}

/**
 * Plays `rise` (or other variants) once, as the element scrolls into view.
 * Spread onto any `m.*` element.
 */
export const reveal = (variants = rise) => ({
  variants,
  initial: 'hidden',
  whileInView: 'shown',
  viewport: { once: true, amount: 0.15, margin: '0px 0px -8% 0px' },
})

/** Children of a revealed element arrive one after another. */
export const stagger = (gap = 0.07, delay = 0) => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
})

/** The plant's leaf mark drawing itself, stroke by stroke. */
export const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  shown: (index = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.1, delay: 0.15 + index * 0.35, ease: [0.65, 0, 0.35, 1] },
      opacity: { duration: 0.2, delay: 0.15 + index * 0.35 },
    },
  }),
}
