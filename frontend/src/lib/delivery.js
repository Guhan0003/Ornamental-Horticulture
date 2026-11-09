/**
 * "When will it get to me?" — an estimate from a pincode, with no server.
 *
 * The shop promises two windows. The four southern states are close, so
 * 1–3 working days; everywhere else in India is 2–5. A pincode starts with the
 * postal region it belongs to, so the first two digits are enough to tell the
 * two apart, and a date range reads better than "3 working days" because
 * nobody counts working days on their fingers.
 *
 * To change the promise, change the numbers and the list below; nothing else
 * knows about them.
 */

export const NEAR = { min: 1, max: 3 }
export const FAR = { min: 2, max: 5 }

/**
 * The states with the shorter window, by the first two digits of their pincodes.
 * Telangana (50…) is a separate state from Andhra Pradesh (51…–53…) and is not
 * on the list, so Hyderabad gets the longer window. Puducherry (605…) sits among
 * Tamil Nadu's digits and so counts with it.
 */
export const NEAR_STATES = [
  { name: 'Andhra Pradesh', prefixes: ['51', '52', '53'] },
  { name: 'Karnataka', prefixes: ['56', '57', '58', '59'] },
  { name: 'Tamil Nadu', prefixes: ['60', '61', '62', '63', '64'] },
  { name: 'Kerala', prefixes: ['67', '68', '69'] },
]

// Sundays don't count as working days; the day an order is placed doesn't either.
const DAY_OFF = 0

/** Six digits, and the first is never 0. */
export const isPincode = (value) => /^[1-9]\d{5}$/.test(value)

/** The shorter-window state this pincode is in, or null for anywhere else. */
export function nearState(pincode) {
  const prefix = pincode.slice(0, 2)
  return NEAR_STATES.find((state) => state.prefixes.includes(prefix))?.name ?? null
}

/** The date `days` working days after `from`, counting from the next day. */
export function addWorkingDays(from, days) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let left = days
  while (left > 0) {
    date.setDate(date.getDate() + 1)
    if (date.getDay() !== DAY_OFF) left -= 1
  }
  return date
}

/**
 * The estimate for a pincode, or null if it isn't one:
 * { pincode, state, near, minDays, maxDays, earliest, latest }
 * `state` is set only for the four southern states.
 */
export function estimateDelivery(pincode, today = new Date()) {
  if (!isPincode(pincode)) return null

  const state = nearState(pincode)
  const window = state ? NEAR : FAR
  return {
    pincode,
    state,
    near: Boolean(state),
    minDays: window.min,
    maxDays: window.max,
    earliest: addWorkingDays(today, window.min),
    latest: addWorkingDays(today, window.max),
  }
}

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** "Thu 12 Nov" */
export const formatDay = (date) => dayFormat.format(date).replace(',', '')

/** "Tue 10 Nov – Thu 12 Nov" */
export const formatRange = (earliest, latest) => `${formatDay(earliest)} – ${formatDay(latest)}`

/* ---------------- remembering the last pincode ---------------- */

const KEY = 'stomatalworld.pincode'

/** A returning visitor shouldn't have to type it again. Null if none, or storage is off. */
export function savedPincode() {
  try {
    const value = localStorage.getItem(KEY)
    return value && isPincode(value) ? value : null
  } catch {
    return null
  }
}

export function savePincode(pincode) {
  try {
    localStorage.setItem(KEY, pincode)
  } catch {
    /* private mode — it just won't be remembered */
  }
}
