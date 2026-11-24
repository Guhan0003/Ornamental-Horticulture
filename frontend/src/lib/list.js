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
import { formatPrice, isSoldOut, plainText, whatsappLink } from './commerce.js'

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

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const trimmed = (origin) => origin.replace(/\/+$/, '')

/**
 * The address of the page that shows this order with a photo of every plant:
 * `/order?p=philodendron-birkin.2,neon-pothos`. Each plant is its address, then a
 * dot and how many when it is more than one. Nothing else goes in the link, so
 * there is nothing private in it and nothing to look up: the page reads the
 * shop's own plant list for the names, photos and prices.
 *
 * A plant's address is only letters, numbers and hyphens, so neither a dot nor a
 * comma can appear inside one. WhatsApp reads that as a link in full, and none of
 * its own formatting marks (`*`, `_`, `~`) is in it.
 */
export function orderUrl(items, origin) {
  const parts = items
    .filter((item) => !isSoldOut(item) && SLUG.test(item.slug))
    .map((item) => (item.qty > 1 ? `${item.slug}.${item.qty}` : item.slug))
  return `${trimmed(origin)}/order?p=${parts.join(',')}`
}

/**
 * The plants an order link names, in the order it names them: [{ slug, qty }].
 *
 * The link is whatever someone typed or was sent, so nothing in it is trusted. A
 * part that is not a plant's address is skipped, a plant named twice counts once,
 * a quantity outside 1–9 is brought back into it, and it stops at the most a list
 * can hold.
 */
export function parseOrder(text) {
  const seen = new Set()
  const order = []

  for (const part of String(text ?? '').split(',')) {
    const [slug, qty = '1', extra] = part.trim().toLowerCase().split('.')
    if (extra !== undefined || !SLUG.test(slug) || slug.length > 160 || seen.has(slug)) continue

    seen.add(slug)
    order.push({ slug, qty: clampQty(qty) })
    if (order.length === MAX_ITEMS) break
  }
  return order
}

/**
 * The whole list as the customer's first message in the chat, so the shop can
 * read it, add it up and answer without asking anything.
 *
 * Written the way a modern WhatsApp message looks: a bold heading, one line a
 * plant with the name in bold, the total in bold, and a few emoji to mark the
 * parts, so it can be read at a glance among a day of other chats. Only the
 * marks WhatsApp itself understands (*bold* and _italic_) are used, so it reads
 * as plain text anywhere else.
 *
 * Given the site's address (`origin`), it ends with one link to a page that shows
 * every plant in the order with its photo, so the shop can see exactly which plants
 * were meant. A message can only carry text, never attached photos, so this is how
 * the pictures get there. WhatsApp also turns that link into a card at the top of
 * the message, showing the first plant's photo and how many plants and what total
 * the order has (see api/order.js). Without an origin the message has no link.
 */
export function listMessage(items, pincode, origin) {
  const live = items.filter((item) => !isSoldOut(item))

  const lines = live.map((item) => {
    const many = item.qty > 1 ? ` × ${item.qty}` : ''
    const price =
      item.price_minor == null
        ? '_price on request_'
        : formatPrice(item.price_minor * item.qty, item.currency)
    const check = item.availability === 'ask' ? ' _(please confirm it is available)_' : ''
    return `🌱 *${plainText(item.name)}*${many} — ${price}${check}`
  })

  const sum = totals(items)
  const message = ['🌿 *My plant order*', '', lines.join('\n'), '']

  if (sum.priced > 0) {
    message.push(
      sum.unpriced > 0
        ? `🧾 *Total so far: ${formatPrice(sum.total, sum.currency)}* _(plus ${sum.unpriced} on request)_`
        : `🧾 *Total: ${formatPrice(sum.total, sum.currency)}*`,
    )
  }
  if (pincode) message.push(`📍 Delivery pincode: ${pincode}`)

  if (origin && live.length > 0) {
    message.push('', '📸 *See every plant with its photo*', orderUrl(live, origin))
  }

  message.push('', 'Please confirm availability. Thank you! 🙏')
  return message.join('\n')
}

/**
 * The send button: where it goes and what it says. Null when there is nothing
 * that can be sent, or the shop has no WhatsApp number (set in the dashboard's Settings).
 */
export function listAction(items, pincode, origin) {
  const sum = totals(items)
  if (sum.plants === 0) return null

  const href = whatsappLink(listMessage(items, pincode, origin))
  if (!href) return null

  return { label: 'Send my list on WhatsApp', href, plants: sum.plants }
}
