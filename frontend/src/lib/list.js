/**
 * "My list": several plants, sent to the shop in one WhatsApp message.
 *
 * A customer who wants three plants would otherwise send three messages, each
 * about one plant, and the shop would have to put them back together. Here they
 * collect the plants as they browse, and one tap sends the whole list, already
 * typed out, with a total.
 *
 * Nothing in this file touches the page or the browser, so all of it can be
 * tested. The part that remembers the list on the phone is in listStore.js.
 *
 * It is a list, not a basket: there is no payment and no stock is held. It
 * keeps the shop's way of selling exactly as it is — someone replies on
 * WhatsApp — and only saves the customer typing.
 */
import { formatPrice, isSoldOut, whatsappLink } from './commerce.js'

/** A message with more than this many plants gets too long to read in a chat. */
export const MAX_ITEMS = 15
export const MAX_QTY = 9

const AVAILABILITY = ['in_stock', 'ask', 'sold_out']

const clampQty = (value) => {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) ? Math.min(MAX_QTY, Math.max(1, n)) : 1
}

/**
 * What the list remembers about a plant: enough to show it and to write its
 * line, and nothing that would go stale for long. (Prices are looked up again
 * whenever the list is opened.)
 */
export function snapshot(plant) {
  return {
    slug: plant.slug,
    name: plant.common_name,
    price_minor: plant.price_minor ?? null,
    currency: plant.currency || 'INR',
    price_note: plant.price_note || '',
    availability: plant.availability || 'in_stock',
    image: { url: plant.image?.url || '', background: plant.image?.background || '' },
  }
}

/* ---------------- changing the list (each returns a new list) ---------------- */

export const hasItem = (items, slug) => items.some((item) => item.slug === slug)

/** Add one of a plant. Nothing happens if it is already there, sold out, or the list is full. */
export function addItem(items, plant) {
  if (hasItem(items, plant.slug)) return items
  if (isSoldOut(plant)) return items
  if (items.length >= MAX_ITEMS) return items
  return [...items, { ...snapshot(plant), qty: 1 }]
}

export const removeItem = (items, slug) => items.filter((item) => item.slug !== slug)

export const setQty = (items, slug, qty) =>
  items.map((item) => (item.slug === slug ? { ...item, qty: clampQty(qty) } : item))

/**
 * Bring a remembered list up to date with the shop's plant list: today's price
 * and stock, and a plant that has since been taken off the site drops out.
 *
 * An empty list from the shop is taken as "could not load", not as "every plant
 * is gone", so a bad connection can never empty someone's list.
 */
export function refreshItems(items, plants) {
  if (!Array.isArray(plants) || plants.length === 0) return items

  const current = new Map(plants.map((plant) => [plant.slug, plant]))
  return items
    .filter((item) => current.has(item.slug))
    .map((item) => ({ ...snapshot(current.get(item.slug)), qty: item.qty }))
}

/* ---------------- what the phone remembers ---------------- */

/**
 * The saved list, read back. The phone's storage is the customer's to edit and
 * old versions of this code leave their own shapes behind, so anything that is
 * not a plausible entry is dropped rather than trusted.
 */
export function parseStored(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const seen = new Set()
  const items = []
  for (const raw of data) {
    if (!raw || typeof raw.slug !== 'string' || typeof raw.name !== 'string') continue
    if (!raw.slug || seen.has(raw.slug)) continue
    seen.add(raw.slug)

    items.push({
      slug: raw.slug.slice(0, 160),
      name: raw.name.slice(0, 200),
      price_minor: Number.isInteger(raw.price_minor) && raw.price_minor >= 0 ? raw.price_minor : null,
      currency: typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'INR',
      price_note: typeof raw.price_note === 'string' ? raw.price_note.slice(0, 120) : '',
      availability: AVAILABILITY.includes(raw.availability) ? raw.availability : 'in_stock',
      image: {
        url: typeof raw.image?.url === 'string' ? raw.image.url : '',
        background: typeof raw.image?.background === 'string' ? raw.image.background.slice(0, 7) : '',
      },
      qty: clampQty(raw.qty),
    })
    if (items.length === MAX_ITEMS) break
  }
  return items
}

/* ---------------- the numbers ---------------- */

/**
 * What the list adds up to. A sold-out plant stays on the list, so the customer
 * can see it and take it off, but it is not counted and not sent.
 */
export function totals(items) {
  const live = items.filter((item) => !isSoldOut(item))

  let total = 0
  let priced = 0
  let unpriced = 0
  let pieces = 0
  for (const item of live) {
    pieces += item.qty
    if (item.price_minor == null) {
      unpriced += 1
    } else {
      total += item.price_minor * item.qty
      priced += 1
    }
  }

  return {
    plants: live.length,
    pieces,
    total,
    priced,
    unpriced,
    soldOut: items.length - live.length,
    currency: live.find((item) => item.price_minor != null)?.currency ?? 'INR',
  }
}

/* ---------------- the message ---------------- */

/**
 * The whole list as the customer's first message in the chat, so the shop can
 * read it, add it up and answer without asking anything.
 */
export function listMessage(items, pincode) {
  const live = items.filter((item) => !isSoldOut(item))

  const lines = live.map((item, index) => {
    const many = item.qty > 1 ? ` × ${item.qty}` : ''
    const price =
      item.price_minor == null
        ? 'price on request'
        : formatPrice(item.price_minor * item.qty, item.currency)
    const check = item.availability === 'ask' ? ' (please confirm it is available)' : ''
    return `${index + 1}. ${item.name}${many} — ${price}${check}`
  })

  const sum = totals(items)
  const message = ['Hi! I’d like to order these from StomatalWorld:', '', ...lines, '']

  if (sum.priced > 0) {
    message.push(
      sum.unpriced > 0
        ? `Total so far: ${formatPrice(sum.total, sum.currency)} (plus ${sum.unpriced} on request)`
        : `Total: ${formatPrice(sum.total, sum.currency)}`,
    )
  }
  if (pincode) message.push(`Delivery pincode: ${pincode}.`)

  return message.join('\n').replace(/\n+$/, '')
}

/**
 * The send button: where it goes and what it says. Null when there is nothing
 * that can be sent, or the shop has no WhatsApp number set in data/contact.js.
 */
export function listAction(items, pincode) {
  const sum = totals(items)
  if (sum.plants === 0) return null

  const href = whatsappLink(listMessage(items, pincode))
  if (!href) return null

  return { label: 'Send my list on WhatsApp', href, plants: sum.plants }
}
