// Run with `npm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_ITEMS,
  MAX_QTY,
  addItem,
  hasItem,
  listAction,
  listMessage,
  parseStored,
  refreshItems,
  removeItem,
  setQty,
  snapshot,
  totals,
} from './list.js'

const plant = (slug, extra = {}) => ({
  slug,
  common_name: slug
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' '),
  price_minor: 29900,
  currency: 'INR',
  price_note: 'with white decor pot',
  availability: 'in_stock',
  image: { url: `https://img.example/${slug}.webp`, background: '#9b9d96', placeholder: 'data:image/webp;base64,AAAA' },
  ...extra,
})

const birkin = plant('philodendron-birkin', { price_minor: 44900 })
const pothos = plant('neon-pothos')
const lily = plant('peace-lily', { price_minor: null })

const list = (...plants) => plants.reduce(addItem, [])

test('a plant goes on the list once, with one of it', () => {
  const items = list(birkin)
  assert.equal(items.length, 1)
  assert.equal(items[0].qty, 1)
  assert.equal(items[0].name, 'Philodendron Birkin')
  assert.ok(hasItem(items, 'philodendron-birkin'))
})

test('adding the same plant again changes nothing', () => {
  const once = list(birkin)
  assert.equal(addItem(once, birkin), once)
})

test('a sold-out plant cannot be added', () => {
  assert.deepEqual(addItem([], plant('rare-one', { availability: 'sold_out' })), [])
})

test('the list stops at the limit, and says nothing when it does', () => {
  let items = []
  for (let n = 0; n < MAX_ITEMS + 5; n += 1) items = addItem(items, plant(`plant-${n}`))
  assert.equal(items.length, MAX_ITEMS)
})

test('what the list remembers is small: no photo placeholder, no long text', () => {
  const kept = snapshot(birkin)
  assert.deepEqual(Object.keys(kept.image).sort(), ['background', 'url'])
  assert.ok(JSON.stringify(kept).length < 400)
})

test('changing the list never changes the one it was given', () => {
  const before = list(birkin, pothos)
  const frozen = JSON.stringify(before)
  removeItem(before, 'neon-pothos')
  setQty(before, 'philodendron-birkin', 4)
  addItem(before, lily)
  assert.equal(JSON.stringify(before), frozen)
})

test('a plant comes off the list', () => {
  const items = removeItem(list(birkin, pothos), 'philodendron-birkin')
  assert.deepEqual(items.map((item) => item.slug), ['neon-pothos'])
})

test('the quantity stays between one and the most that can be asked for', () => {
  const items = list(birkin)
  assert.equal(setQty(items, 'philodendron-birkin', 3)[0].qty, 3)
  assert.equal(setQty(items, 'philodendron-birkin', 0)[0].qty, 1)
  assert.equal(setQty(items, 'philodendron-birkin', -4)[0].qty, 1)
  assert.equal(setQty(items, 'philodendron-birkin', 500)[0].qty, MAX_QTY)
  assert.equal(setQty(items, 'philodendron-birkin', 'lots')[0].qty, 1)
})

/* ---------------- keeping up with the shop ---------------- */

test('opening the list brings prices and stock up to date, and keeps the quantities', () => {
  const items = setQty(list(birkin, pothos), 'philodendron-birkin', 2)
  const today = [
    { ...birkin, price_minor: 49900 },
    { ...pothos, availability: 'sold_out' },
  ]

  const fresh = refreshItems(items, today)

  assert.equal(fresh[0].price_minor, 49900)
  assert.equal(fresh[0].qty, 2)
  assert.equal(fresh[1].availability, 'sold_out')
})

test('a plant taken off the site drops off the list', () => {
  const fresh = refreshItems(list(birkin, pothos), [birkin])
  assert.deepEqual(fresh.map((item) => item.slug), ['philodendron-birkin'])
})

test('an empty answer from the shop is a bad connection, not a closed shop', () => {
  const items = list(birkin, pothos)
  assert.equal(refreshItems(items, []), items)
  assert.equal(refreshItems(items, null), items)
})

/* ---------------- reading back what the phone saved ---------------- */

test('a saved list comes back as it was', () => {
  const items = setQty(list(birkin, lily), 'philodendron-birkin', 3)
  assert.deepEqual(parseStored(JSON.stringify(items)), items)
})

test('anything that is not a saved list reads as an empty one', () => {
  for (const text of ['', 'not json', 'null', '{}', '42', '"a string"', undefined]) {
    assert.deepEqual(parseStored(text), [], String(text))
  }
})

test('damaged entries are dropped and the rest kept', () => {
  const saved = JSON.stringify([
    snapshot(birkin) && { ...snapshot(birkin), qty: 2 },
    null,
    'text',
    { slug: 42, name: 'Number slug' },
    { slug: 'no-name' },
    { slug: '', name: 'Empty slug' },
    { ...snapshot(birkin), qty: 5 },
    { ...snapshot(pothos), qty: 1 },
  ])

  const items = parseStored(saved)

  assert.deepEqual(items.map((item) => item.slug), ['philodendron-birkin', 'neon-pothos'])
  assert.equal(items[0].qty, 2, 'the first copy wins')
})

test('odd values in a saved entry are put right, not trusted', () => {
  const [item] = parseStored(
    JSON.stringify([
      {
        slug: 'x',
        name: 'X',
        qty: 99,
        price_minor: -5,
        currency: 'rupees',
        availability: 'maybe',
        image: 'not an object',
      },
    ]),
  )

  assert.equal(item.qty, MAX_QTY)
  assert.equal(item.price_minor, null)
  assert.equal(item.currency, 'INR')
  assert.equal(item.availability, 'in_stock')
  assert.deepEqual(item.image, { url: '', background: '' })
})

test('a saved list longer than the limit is cut to it', () => {
  const many = Array.from({ length: MAX_ITEMS + 8 }, (_, n) => ({ ...snapshot(plant(`plant-${n}`)), qty: 1 }))
  assert.equal(parseStored(JSON.stringify(many)).length, MAX_ITEMS)
})

/* ---------------- the numbers ---------------- */

test('the total counts every piece, and says how many plants have no price', () => {
  const items = setQty(list(birkin, pothos, lily), 'philodendron-birkin', 2)
  const sum = totals(items)

  assert.equal(sum.total, 44900 * 2 + 29900)
  assert.equal(sum.priced, 2)
  assert.equal(sum.unpriced, 1)
  assert.equal(sum.plants, 3)
  assert.equal(sum.pieces, 4)
})

test('a sold-out plant stays on the list but is not counted', () => {
  const items = [...list(birkin), { ...snapshot(pothos), availability: 'sold_out', qty: 3 }]
  const sum = totals(items)

  assert.equal(sum.total, 44900)
  assert.equal(sum.plants, 1)
  assert.equal(sum.soldOut, 1)
})

/* ---------------- the message ---------------- */

test('the message lists each plant with its price, then the total', () => {
  const items = setQty(list(birkin, pothos), 'philodendron-birkin', 2)

  assert.equal(
    listMessage(items),
    [
      'Hi! I’d like to order these from StomatalWorld:',
      '',
      '1. Philodendron Birkin × 2 — ₹898',
      '2. Neon Pothos — ₹299',
      '',
      'Total: ₹1,197',
    ].join('\n'),
  )
})

test('a plant with no price says so, and the total says it is not the whole total', () => {
  assert.equal(
    listMessage(list(birkin, lily), '600001'),
    [
      'Hi! I’d like to order these from StomatalWorld:',
      '',
      '1. Philodendron Birkin — ₹449',
      '2. Peace Lily — price on request',
      '',
      'Total so far: ₹449 (plus 1 on request)',
      'Delivery pincode: 600001.',
    ].join('\n'),
  )
})

test('with no prices at all there is no total to give', () => {
  const message = listMessage(list(lily))
  assert.ok(!message.includes('Total'))
  assert.ok(message.endsWith('1. Peace Lily — price on request'))
})

test('a plant the shop has to check on is marked for it', () => {
  const message = listMessage(list(plant('maybe-plant', { availability: 'ask' })))
  assert.ok(message.includes('please confirm it is available'))
})

test('sold-out plants are left out of the message and the numbering', () => {
  const items = [
    ...list(birkin),
    { ...snapshot(plant('gone-plant')), availability: 'sold_out', qty: 1 },
    ...list(pothos),
  ]
  const message = listMessage(items)

  assert.ok(!message.includes('Gone Plant'))
  assert.ok(message.includes('2. Neon Pothos'))
})

test('the send button opens a chat with the shop and the whole message typed in', () => {
  const items = list(birkin, pothos)
  const action = listAction(items, '600001')

  assert.match(action.href, /^https:\/\/wa\.me\/\d{10,15}\?text=/)
  assert.equal(decodeURIComponent(action.href.split('?text=')[1]), listMessage(items, '600001'))
  assert.equal(action.plants, 2)
})

test('there is no send button when there is nothing that can be sent', () => {
  assert.equal(listAction([]), null)
  assert.equal(listAction([{ ...snapshot(birkin), availability: 'sold_out', qty: 1 }]), null)
})

test('a full list still fits in one message link', () => {
  let items = []
  for (let n = 0; n < MAX_ITEMS; n += 1) {
    items = addItem(items, plant(`a-rather-long-plant-name-number-${n}`, { price_minor: 129900 }))
    items = setQty(items, `a-rather-long-plant-name-number-${n}`, 9)
  }

  const { href } = listAction(items, '600001')
  assert.ok(href.length < 4000, `link is ${href.length} characters`)
})
