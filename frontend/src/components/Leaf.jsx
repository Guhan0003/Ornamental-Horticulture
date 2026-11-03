import { m } from 'motion/react'
import { draw as drawVariants } from '../lib/motion.js'

const OUTLINE = 'M40 8C40 8 38 30 26 38C18 43.3 10 40 10 40C10 40 12 18 24 10C32 4.7 40 8 40 8Z'
const STEM = 'M34 14C34 14 20 24 8 44'

/**
 * The leaf mark. With `draw`, it sketches itself in — outline, then stem —
 * the first time it scrolls into view.
 */
export default function Leaf({ className = 'leaf', draw = false }) {
  const svg = {
    className,
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }
  const outline = { stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }
  const stem = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }

  if (!draw) {
    return (
      <svg {...svg}>
        <path d={OUTLINE} {...outline} />
        <path d={STEM} {...stem} />
      </svg>
    )
  }

  return (
    <m.svg {...svg} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.6 }}>
      <m.path d={OUTLINE} {...outline} variants={drawVariants} custom={0} />
      <m.path d={STEM} {...stem} variants={drawVariants} custom={1} />
    </m.svg>
  )
}
