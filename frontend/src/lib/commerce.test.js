// Run with `npm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buyAction,
  discountPercent,
  formatPrice,
  sortPlants,
  toMinor,
  toRupees,
} from './commerce.js'

const lily = {
  common_name: 'Peace Lily',
  price_minor: 39900,
  currency: 'INR',
  availability: 'in_stock',
}

test('paise become rupees, grouped the Indian way', () => {
  assert.equal(formatPrice(39900), '₹399')
  assert.equal(formatPrice(7550), '₹75.50')
  assert.equal(formatPrice(129900), '₹1,299')
  assert.equal(formatPrice(12990000), '₹1,29,900')
  assert.equal(formatPrice(null), '')
})

test('a discount is a whole percent, and only when the original is higher', () => {
  assert.equal(discountPercent(89900, 109900), 18)
  assert.equal(discountPercent(24900, 29900), 17)
  assert.equal(discountPercent(39900, 39900), 0)
  assert.equal(discountPercent(39900, 29900), 0)
  assert.equal(discountPercent(null, 29900), 0)
  assert.equal(discountPercent(39900, null), 0)
})

test('the form turns typed rupees into paise, and refuses anything else', () => {
  assert.equal(toMinor('399'), 39900)
  assert.equal(toMinor('399.5'), 39950)
  assert.equal(toMinor('399.50'), 39950)
  assert.equal(toMinor('₹1,299'), 129900)
  assert.equal(toMinor('  250  '), 25000)
  assert.equal(toMinor(''), null)
  for (const bad of ['abc', '1.234', '-5', '12e3', '1,2,x']) {
    assert.ok(Number.isNaN(toMinor(bad)), bad)
  }
})

test('paise go back into the form as the rupees that were typed', () => {
  assert.equal(toRupees(39900), '399')
  assert.equal(toRupees(39950), '399.50')
  assert.equal(toRupees(null), '')
  for (const text of ['399', '399.50', '1299', '75.50']) {
    assert.equal(toRupees(toMinor(text)), text)
  }
})

test('the shop lists what can be bought first, sold out last, unpriced after priced', () => {
  const plants = [
    { common_name: 'Fern', price_minor: 29900, availability: 'in_stock' },
    { common_name: 'Aloe', price_minor: null, availability: 'in_stock' },
    { common_name: 'Cactus', price_minor: 19900, availability: 'sold_out' },
    { common_name: 'Basil', price_minor: 29900, availability: 'in_stock' },
    { common_name: 'Rose', price_minor: 49900, availability: 'ask' },
  ]
  const names = (order) => sortPlants(plants, order).map((p) => p.common_name)

  assert.deepEqual(names('name'), ['Aloe', 'Basil', 'Fern', 'Rose', 'Cactus'])
  assert.deepEqual(names('low'), ['Basil', 'Fern', 'Rose', 'Aloe', 'Cactus'])
  assert.deepEqual(names('high'), ['Rose', 'Basil', 'Fern', 'Aloe', 'Cactus'])
  // The list it was given is left as it was.
  assert.equal(plants[0].common_name, 'Fern')
})

const message = (action) => decodeURIComponent(action.href.split('?text=')[1])

test('the order button opens WhatsApp with the plant, the price and the page', () => {
  const action = buyAction(lily, 'https://x.example/peace-lily')

  assert.equal(action.label, 'Order on WhatsApp')
  assert.match(action.href, /^https:\/\/wa\.me\/\d+\?text=/)
  assert.equal(
    message(action),
    'Hi! I’d like to order the Peace Lily (₹399) from StomatalWorld. https://x.example/peace-lily',
  )
})

test('a checked pincode goes into the order message', () => {
  const text = message(buyAction(lily, 'https://x.example/peace-lily', '600001'))
  assert.match(text, /Delivery pincode: 600001\./)
  assert.ok(text.endsWith('https://x.example/peace-lily'))
})

test('the button says the honest thing for a plant that cannot simply be ordered', () => {
  const sold = buyAction({ ...lily, availability: 'sold_out' }, '', '600001')
  assert.equal(sold.label, 'Ask when it’s back')
  assert.doesNotMatch(message(sold), /pincode/)

  const unpriced = buyAction({ ...lily, price_minor: null })
  assert.equal(unpriced.label, 'Ask for the price')
  assert.match(message(unpriced), /What is the price of the Peace Lily\?/)

  const ask = buyAction({ ...lily, availability: 'ask' }, '', '560001')
  assert.equal(ask.label, 'Check availability')
  assert.match(message(ask), /Is the Peace Lily \(₹399\) available\? Delivery pincode: 560001\./)
})
