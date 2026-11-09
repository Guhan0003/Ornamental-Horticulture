/**
 * Prices, stock and the order button — shared by the home page, the plant
 * page and the admin form. Keep in step with backend/app/schemas/plant.py.
 *
 * Money arrives as whole paise (`price_minor`) and is only turned into rupees
 * here, for display, so no arithmetic ever happens on a float.
 */
import { contact } from '../data/contact.js'

export const AVAILABILITY = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'ask', label: 'Ask us' },
  { value: 'sold_out', label: 'Sold out' },
]

export const availabilityLabel = (value) =>
  AVAILABILITY.find((option) => option.value === value)?.label ?? ''

// The backend's ceiling, in rupees.
export const MAX_PRICE = 1_000_000

const formatters = new Map()

/** 39900 → "₹399", 7550 → "₹75.50". Indian digit grouping: ₹1,29,900. */
export function formatPrice(minor, currency = 'INR') {
  if (minor == null) return ''
  const digits = minor % 100 === 0 ? 0 : 2
  const key = `${currency}${digits}`
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    )
  }
  return formatters.get(key).format(minor / 100)
}

/** How much cheaper than the original price, as a whole percent. 0 when it isn't. */
export function discountPercent(price, original) {
  if (price == null || original == null || original <= price) return 0
  return Math.round((1 - price / original) * 100)
}

export const isSoldOut = (plant) => plant.availability === 'sold_out'

/* ---------------- the admin form types rupees, the API wants paise ---------------- */

/** 39900 → "399", 7550 → "75.50", null → "". */
export function toRupees(minor) {
  if (minor == null) return ''
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}

/**
 * "399" → 39900. An empty box is no price (null); anything that isn't a
 * number comes back as NaN so the form can say so.
 */
export function toMinor(text) {
  const cleaned = String(text).replace(/[₹,\s]/g, '')
  if (!cleaned) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN
  return Math.round(Number(cleaned) * 100)
}

/* ---------------- ordering ---------------- */

const digits = (value) => value.replace(/[^\d]/g, '')

/**
 * What the order button says and where it goes: a WhatsApp chat to the shop,
 * already naming the plant and its price, so the customer only has to press
 * send. It adapts to the plant — sold out, no price, or "ask us" — because
 * "Order" on something that cannot be ordered is a broken promise.
 *
 * Null when the shop has no WhatsApp number set in data/contact.js.
 */
export function buyAction(plant, pageUrl) {
  if (!contact.whatsapp) return null

  const price = formatPrice(plant.price_minor, plant.currency)
  const name = price ? `${plant.common_name} (${price})` : plant.common_name

  let label
  let message
  if (isSoldOut(plant)) {
    label = 'Ask when it’s back'
    message = `Hi! Will the ${plant.common_name} be back in stock?`
  } else if (plant.price_minor == null) {
    label = 'Ask for the price'
    message = `Hi! What is the price of the ${plant.common_name}?`
  } else if (plant.availability === 'ask') {
    label = 'Check availability'
    message = `Hi! Is the ${name} available?`
  } else {
    label = 'Order on WhatsApp'
    message = `Hi! I’d like to order the ${name} from StomatalWorld.`
  }

  const text = pageUrl ? `${message} ${pageUrl}` : message
  return { label, href: `https://wa.me/${digits(contact.whatsapp)}?text=${encodeURIComponent(text)}` }
}

/* ---------------- the home page list ---------------- */

export const SORTS = [
  { value: 'name', label: 'A–Z' },
  { value: 'low', label: 'Price: low to high' },
  { value: 'high', label: 'Price: high to low' },
]

/**
 * Plants in the order the shop floor would put them: whatever can be bought
 * first, sold-out ones last, then by name or price. A plant with no price sorts
 * after the priced ones either way — it is not "free", it is unknown.
 */
export function sortPlants(plants, order) {
  const byName = (a, b) => a.common_name.localeCompare(b.common_name)

  const byPrice = (direction) => (a, b) => {
    if (a.price_minor == null || b.price_minor == null) {
      return (a.price_minor == null) - (b.price_minor == null)
    }
    return direction * (a.price_minor - b.price_minor)
  }

  const compare = order === 'low' ? byPrice(1) : order === 'high' ? byPrice(-1) : () => 0

  return [...plants].sort(
    (a, b) => isSoldOut(a) - isSoldOut(b) || compare(a, b) || byName(a, b),
  )
}
