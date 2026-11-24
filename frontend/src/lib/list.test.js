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
  orderUrl,
  parseOrder,
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

test('the message lists each plant in bold with its price, then the total', () => {
  const items = setQty(list(birkin, pothos), 'philodendron-birkin', 2)

  assert.equal(
    listMessage(items),
    [
      '🌿 *My plant order*',
      '',
      '🌱 *Philodendron Birkin* × 2 — ₹898',
      '🌱 *Neon Pothos* — ₹299',
      '',
      '🧾 *Total: ₹1,197*',
      '',
      'Please confirm availability. Thank you! 🙏',
    ].join('\n'),
  )
})

test('a plant with no price says so, and the total says it is not the whole total', () => {
  assert.equal(
    listMessage(list(birkin, lily), '600001'),
    [
      '🌿 *My plant order*',
      '',
      '🌱 *Philodendron Birkin* — ₹449',
      '🌱 *Peace Lily* — _price on request_',
      '',
      '🧾 *Total so far: ₹449* _(plus 1 on request)_',
      '📍 Delivery pincode: 600001',
      '',
      'Please confirm availability. Thank you! 🙏',
    ].join('\n'),
  )
})

test('with no prices at all there is no total to give', () => {
  const message = listMessage(list(lily))
  assert.ok(!message.includes('Total'))
  assert.ok(!message.includes('🧾'))
  assert.ok(message.includes('🌱 *Peace Lily* — _price on request_'))
})

test('a plant the shop has to check on is marked for it', () => {
  const message = listMessage(list(plant('maybe-plant', { availability: 'ask' })))
  assert.ok(message.includes('_(please confirm it is available)_'))
})

test('sold-out plants are left out of the message', () => {
  const items = [
    ...list(birkin),
    { ...snapshot(plant('gone-plant')), availability: 'sold_out', qty: 1 },
    ...list(pothos),
  ]
  const message = listMessage(items)

  assert.ok(!message.includes('Gone Plant'))
  assert.equal((message.match(/🌱/g) || []).length, 2)
  assert.ok(message.includes('*Neon Pothos*'))
})

test('it opens with a heading and closes with a thank you, whatever is on the list', () => {
  for (const items of [list(birkin), list(lily), list(birkin, pothos, lily)]) {
    const lines = listMessage(items, '600001').split('\n')
    assert.equal(lines[0], '🌿 *My plant order*')
    assert.equal(lines.at(-1), 'Please confirm availability. Thank you! 🙏')
  }
})

test('a plant name with WhatsApp’s own marks in it cannot turn the line bold or italic', () => {
  const odd = plant('odd-plant', { common_name: 'Black *Gold* _Pothos_ ~new~ `x`' })
  const message = listMessage(list(odd))

  assert.ok(message.includes('🌱 *Black Gold Pothos new x* — ₹299'))
  assert.ok(!message.includes('*Gold*'))
  assert.ok(!message.includes('_Pothos_'))
})

test('with the site address, the message ends with one link to a page of every plant’s photo', () => {
  const items = setQty(list(birkin, pothos), 'philodendron-birkin', 2)

  assert.equal(
    listMessage(items, '600001', 'https://shop.example'),
    [
      '🌿 *My plant order*',
      '',
      '🌱 *Philodendron Birkin* × 2 — ₹898',
      '🌱 *Neon Pothos* — ₹299',
      '',
      '🧾 *Total: ₹1,197*',
      '📍 Delivery pincode: 600001',
      '',
      '📸 *See every plant with its photo*',
      'https://shop.example/order?p=philodendron-birkin.2,neon-pothos',
      '',
      'Please confirm availability. Thank you! 🙏',
    ].join('\n'),
  )
})

test('there is exactly one link, so the card WhatsApp shows is the order’s', () => {
  const message = listMessage(list(pothos, birkin, lily), null, 'https://shop.example')
  assert.equal(message.match(/https?:\/\/\S+/g).length, 1)
})

test('without the site address there is no link and no photo line', () => {
  const message = listMessage(list(birkin, pothos), '600001')
  assert.ok(!message.includes('http'))
  assert.ok(!message.includes('📸'))
})

test('a trailing slash on the address does not double up', () => {
  const message = listMessage(list(birkin), null, 'https://shop.example///')

  assert.ok(message.includes('\nhttps://shop.example/order?p=philodendron-birkin\n'))
})

test('a plant that is sold out is not in the link, because it is not in the message', () => {
  const items = [
    ...list(birkin),
    { ...snapshot(plant('gone-plant')), availability: 'sold_out', qty: 1 },
  ]
  const message = listMessage(items, null, 'https://shop.example')

  assert.ok(!message.includes('gone-plant'))
  assert.ok(message.includes('order?p=philodendron-birkin\n'))
})

test('a list of only sold-out plants has no link either', () => {
  const items = [{ ...snapshot(plant('gone-plant')), availability: 'sold_out', qty: 1 }]
  assert.ok(!listMessage(items, null, 'https://shop.example').includes('http'))
})

/* ---------------- the order link ---------------- */

test('an order link names each plant, with how many only when it is more than one', () => {
  const items = setQty(setQty(list(birkin, pothos, lily), 'neon-pothos', 3), 'peace-lily', 1)
  assert.equal(
    orderUrl(items, 'https://shop.example'),
    'https://shop.example/order?p=philodendron-birkin,neon-pothos.3,peace-lily',
  )
})

test('reading a link back gives the same plants, in the same order, with the same numbers', () => {
  const items = setQty(setQty(list(pothos, birkin, lily), 'philodendron-birkin', 2), 'peace-lily', 9)
  const url = orderUrl(items, 'https://shop.example')

  assert.deepEqual(parseOrder(new URL(url).searchParams.get('p')), [
    { slug: 'neon-pothos', qty: 1 },
    { slug: 'philodendron-birkin', qty: 2 },
    { slug: 'peace-lily', qty: 9 },
  ])
})

test('a link that is damaged or made up cannot do anything but name plants', () => {
  assert.deepEqual(parseOrder('a-plant,,../etc/passwd,<script>,with space,UPPER.2,a.b.c,x.2.3'), [
    { slug: 'a-plant', qty: 1 },
    { slug: 'upper', qty: 2 },
  ])
  assert.deepEqual(parseOrder(''), [])
  assert.deepEqual(parseOrder(null), [])
  assert.deepEqual(parseOrder(undefined), [])
})

test('a plant named twice counts once, and a quantity is kept within 1 to 9', () => {
  assert.deepEqual(parseOrder('a-plant.2,a-plant.5,b-plant.0,c-plant.99,d-plant.x,e-plant.-3'), [
    { slug: 'a-plant', qty: 2 },
    { slug: 'b-plant', qty: 1 },
    { slug: 'c-plant', qty: 9 },
    { slug: 'd-plant', qty: 1 },
    { slug: 'e-plant', qty: 1 },
  ])
})

test('a link cannot ask for more plants than a list can hold', () => {
  const many = Array.from({ length: 40 }, (_, n) => `plant-${n}`).join(',')
  assert.equal(parseOrder(many).length, MAX_ITEMS)
})

test('a plant address that was damaged in storage is left out of the link, not passed on', () => {
  const odd = { ...snapshot(plant('ok-plant')), slug: 'c d?e', qty: 1 }
  const items = [odd, ...list(birkin)]

  assert.equal(orderUrl(items, 'https://shop.example'), 'https://shop.example/order?p=philodendron-birkin')
})

test('the send button opens a chat with the shop and the whole message typed in', () => {
  const items = list(birkin, pothos)
  const action = listAction(items, '600001', 'https://shop.example')

  assert.match(action.href, /^https:\/\/wa\.me\/\d{10,15}\?text=/)
  assert.equal(
    decodeURIComponent(action.href.split('?text=')[1]),
    listMessage(items, '600001', 'https://shop.example'),
  )
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

  // The longest the message can be: the most plants, the longest names, the most of each.
  const { href } = listAction(items, '600001', 'https://stomatalworld.vercel.app')
  assert.ok(href.length < 4000, `link is ${href.length} characters`)
})
