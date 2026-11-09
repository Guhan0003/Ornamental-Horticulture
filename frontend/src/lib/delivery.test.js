// Run with `npm test`. Dates are built by hand so the days of the week are known:
// 9 Nov 2026 is a Monday.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addWorkingDays,
  estimateDelivery,
  formatRange,
  isPincode,
  nearState,
  savePincode,
  savedPincode,
} from './delivery.js'

const day = (year, month, date) => new Date(year, month - 1, date)
const ymd = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]

test('a pincode is six digits and never starts with 0', () => {
  assert.ok(isPincode('600001'))
  assert.ok(isPincode('110001'))
  for (const bad of ['', '60001', '6000011', '060001', 'abcdef', '60 001', '600 01']) {
    assert.equal(isPincode(bad), false, bad)
  }
})

test('the four southern states get the shorter window', () => {
  assert.equal(nearState('600001'), 'Tamil Nadu') // Chennai
  assert.equal(nearState('641001'), 'Tamil Nadu') // Coimbatore
  assert.equal(nearState('629001'), 'Tamil Nadu') // Kanyakumari
  assert.equal(nearState('560001'), 'Karnataka') // Bengaluru
  assert.equal(nearState('590001'), 'Karnataka') // Belagavi
  assert.equal(nearState('520001'), 'Andhra Pradesh') // Vijayawada
  assert.equal(nearState('530001'), 'Andhra Pradesh') // Visakhapatnam
  assert.equal(nearState('682001'), 'Kerala') // Kochi
  assert.equal(nearState('695001'), 'Kerala') // Thiruvananthapuram
})

test('everywhere else gets the longer one, Telangana included', () => {
  assert.equal(nearState('500001'), null) // Hyderabad
  assert.equal(nearState('110001'), null) // Delhi
  assert.equal(nearState('400001'), null) // Mumbai
  assert.equal(nearState('403001'), null) // Goa, next to Karnataka but not on the list
  assert.equal(nearState('700001'), null) // Kolkata
})

test('Puducherry counts with Tamil Nadu, whose digits it shares', () => {
  assert.equal(nearState('605001'), 'Tamil Nadu')
})

test('working days skip Sundays and start from the day after today', () => {
  const monday = day(2026, 11, 9)
  assert.deepEqual(ymd(addWorkingDays(monday, 1)), [2026, 11, 10])
  assert.deepEqual(ymd(addWorkingDays(monday, 3)), [2026, 11, 12])
  assert.deepEqual(ymd(addWorkingDays(monday, 5)), [2026, 11, 14]) // Saturday

  const friday = day(2026, 11, 13)
  assert.deepEqual(ymd(addWorkingDays(friday, 1)), [2026, 11, 14]) // Saturday counts
  assert.deepEqual(ymd(addWorkingDays(friday, 2)), [2026, 11, 16]) // Sunday skipped
  assert.deepEqual(ymd(addWorkingDays(friday, 5)), [2026, 11, 19])

  // Ordering on a Saturday or a Sunday: the first working day is Monday.
  assert.deepEqual(ymd(addWorkingDays(day(2026, 11, 14), 1)), [2026, 11, 16])
  assert.deepEqual(ymd(addWorkingDays(day(2026, 11, 15), 1)), [2026, 11, 16])
  assert.deepEqual(ymd(addWorkingDays(day(2026, 11, 15), 3)), [2026, 11, 18])
})

test('working days carry over a month end, and never change the date they start from', () => {
  const start = day(2026, 11, 27) // Friday
  assert.deepEqual(ymd(addWorkingDays(start, 3)), [2026, 12, 1])
  assert.deepEqual(ymd(start), [2026, 11, 27])
})

test('a southern pincode is 1–3 working days', () => {
  const estimate = estimateDelivery('600001', day(2026, 11, 9))
  assert.equal(estimate.near, true)
  assert.equal(estimate.state, 'Tamil Nadu')
  assert.deepEqual([estimate.minDays, estimate.maxDays], [1, 3])
  assert.deepEqual(ymd(estimate.earliest), [2026, 11, 10])
  assert.deepEqual(ymd(estimate.latest), [2026, 11, 12])
})

test('any other pincode is 2–5 working days', () => {
  const estimate = estimateDelivery('110001', day(2026, 11, 9))
  assert.equal(estimate.near, false)
  assert.equal(estimate.state, null)
  assert.deepEqual([estimate.minDays, estimate.maxDays], [2, 5])
  assert.deepEqual(ymd(estimate.earliest), [2026, 11, 11])
  assert.deepEqual(ymd(estimate.latest), [2026, 11, 14])
})

test('the time of day makes no difference to the date', () => {
  const lateNight = new Date(2026, 10, 9, 23, 59)
  assert.deepEqual(ymd(estimateDelivery('600001', lateNight).earliest), [2026, 11, 10])
})

test('something that is not a pincode has no estimate', () => {
  assert.equal(estimateDelivery('12345'), null)
  assert.equal(estimateDelivery(''), null)
})

test('the range reads as two days', () => {
  const { earliest, latest } = estimateDelivery('600001', day(2026, 11, 9))
  assert.equal(formatRange(earliest, latest), 'Tue 10 Nov – Thu 12 Nov')
})

test('a pincode that cannot be remembered is not an error', () => {
  // No localStorage here, as in a browser with storage switched off.
  assert.equal(savedPincode(), null)
  assert.doesNotThrow(() => savePincode('600001'))
})
