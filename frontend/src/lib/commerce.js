/**
 * Prices, stock and the order button — shared by the home page, the plant
 * page and the admin form. Keep in step with backend/app/schemas/plant.py.
 *
 * Money arrives as whole paise (`price_minor`) and is only turned into rupees
 * here, for display, so no arithmetic ever happens on a float.
 */
import { getContact } from './contactStore.js'

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

// WhatsApp turns *this* into bold and _this_ into italic, so a plant name with one of
// those marks in it would make half of its line bold or italic. Spaces are safe.
export const plainText = (text) => String(text).replace(/[*_~`]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * One plant's message, laid out like the My list one (see list.js) so the shop reads
 * the same shape whichever way an order arrives: a bold heading, the plant in bold with
 * its price, the delivery pincode, a link to the plant's page, and a thank you. WhatsApp
 * turns that link into a card with the plant's photo and price (see api/plant.js).
 *
 * `detail` is what comes after the name on its line (the price, or "sold out"), and
 * `closing` is the one-line question or request the message ends on.
 */
function plantMessage({ heading, name, detail, pincode, pageUrl, closing }) {
  const lines = ['🌿 *' + heading + '*', '', `🌱 *${plainText(name)}*${detail ? ` — ${detail}` : ''}`]
  if (pincode) lines.push(`📍 Delivery pincode: ${pincode}`)
  if (pageUrl) lines.push('', '📸 *See the plant with its photo*', pageUrl)
  lines.push('', `${closing} Thank you! 🙏`)
  return lines.join('\n')
}

/**
 * What the order button says and where it goes: a WhatsApp chat to the shop,
 * already naming the plant and its price, so the customer only has to press
 * send. It adapts to the plant — sold out, no price, or "ask us" — because
 * "Order" on something that cannot be ordered is a broken promise.
 *
 * When the customer has checked a delivery pincode it goes in the message too,
 * so the shop does not have to ask where it is going. (Not for a plant that
 * cannot be bought or has no price: there is nothing to deliver yet.)
 *
 * Null when the shop has no WhatsApp number (set in the dashboard's Settings).
 */
export function buyAction(plant, pageUrl, pincode) {
  const contact = getContact()
  if (!contact.whatsapp) return null

  const price = formatPrice(plant.price_minor, plant.currency)
  const name = plant.common_name

  let label
  let message
  if (isSoldOut(plant)) {
    label = 'Ask when it’s back'
    message = plantMessage({
      heading: 'Back in stock?',
      name,
      detail: '_sold out_',
      pageUrl,
      closing: 'Will it be back soon?',
    })
  } else if (plant.price_minor == null) {
    label = 'Ask for the price'
    message = plantMessage({
      heading: 'Price enquiry',
      name,
      pageUrl,
      closing: 'What is the price?',
    })
  } else if (plant.availability === 'ask') {
    label = 'Check availability'
    message = plantMessage({
      heading: 'Availability check',
      name,
      detail: price,
      pincode,
      pageUrl,
      closing: 'Is it available?',
    })
  } else {
    label = 'Order on WhatsApp'
    message = plantMessage({
      heading: 'Plant order',
      name,
      detail: price,
      pincode,
      pageUrl,
      closing: 'Please confirm availability.',
    })
  }

  return { label, href: `https://wa.me/${digits(contact.whatsapp)}?text=${encodeURIComponent(message)}` }
}

/** A WhatsApp chat to the shop with `text` already typed in. Null when no number is set. */
export function whatsappLink(text) {
  const contact = getContact()
  if (!contact.whatsapp) return null
  return `https://wa.me/${digits(contact.whatsapp)}?text=${encodeURIComponent(text)}`
}

/* ---------------- asking for a real photo ---------------- */

/**
 * The WhatsApp link behind "Ask for a real photo". With a plant it names that
 * plant and the page, so the shop knows exactly which one to photograph; with
 * none (the footer, the contact popup) it is a general ask.
 *
 * Null when no WhatsApp number is set, so the caller shows no dead button.
 */
export function realPhotoAction(plant, pageUrl) {
  const contact = getContact()
  if (!contact.whatsapp) return null

  const message = plant
    ? `Hi! Could you send me a real photo of the ${plant.common_name} you have in stock right now?`
    : 'Hi! I’d like to see a real photo of a plant before I order. Could you help?'

  const text = plant && pageUrl ? `${message} ${pageUrl}` : message
  return {
    label: 'Ask for a real photo',
    href: `https://wa.me/${digits(contact.whatsapp)}?text=${encodeURIComponent(text)}`,
  }
}

/* ---------------- the home page list ---------------- */

// "type" is first and is the default: most of the catalogue is Philodendron
// and Pothos, and a flat A–Z of forty plants buries that. Inside a section the
// order is the same A–Z, so picking it only unfolds the shelves into one list.
export const SORTS = [
  { value: 'type', label: 'By type' },
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
