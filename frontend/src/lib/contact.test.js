import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  GREETING_MAX,
  SETTING_NAMES,
  digitsOf,
  instagramHandle,
  mergeContact,
  settingsProblems,
  toSettings,
} from './contact.js'

const built = {
  name: 'StomatalWorld',
  heading: 'Let’s Grow Together',
  phone: '+91 86087 05789',
  whatsapp: '+91 86087 05789',
  whatsappMessage: 'Hi!',
  email: 'shop@example.com',
  instagram: 'stomatalworld',
}

test('with nothing saved the built-in details are used', () => {
  assert.deepEqual(mergeContact(built, {}), built)
  assert.deepEqual(mergeContact(built, null), built)
  assert.deepEqual(mergeContact(built, undefined), built)
})

test('a saved setting replaces the built-in one and the rest stay', () => {
  const merged = mergeContact(built, { phone: '+91 98765 43210' })

  assert.equal(merged.phone, '+91 98765 43210')
  assert.equal(merged.whatsapp, built.whatsapp)
  assert.equal(merged.heading, built.heading)
})

test('a setting saved empty means show nothing, it does not fall back', () => {
  assert.equal(mergeContact(built, { instagram: '' }).instagram, '')
})

test('the server’s whatsapp_message becomes whatsappMessage', () => {
  assert.equal(mergeContact(built, { whatsapp_message: 'Hello there' }).whatsappMessage, 'Hello there')
})

test('what is not a string is ignored, since the phone’s storage can be edited', () => {
  const merged = mergeContact(built, { phone: 5, whatsapp: null, email: ['a'], instagram: {} })

  assert.deepEqual(merged, built)
  assert.deepEqual(mergeContact(built, 'text'), built)
  assert.deepEqual(mergeContact(built, [1, 2]), built)
})

test('settings the dashboard does not own cannot be changed from outside', () => {
  const merged = mergeContact(built, { name: 'Someone else', heading: 'Hacked', tagline: 'x' })

  assert.equal(merged.name, built.name)
  assert.equal(merged.heading, built.heading)
})

test('the original is never modified', () => {
  const before = JSON.stringify(built)
  mergeContact(built, { phone: '+1 555 555 5555' })

  assert.equal(JSON.stringify(built), before)
})

test('the form is sent in the server’s words, all five, with empty ones as empty strings', () => {
  const sent = toSettings({ phone: '+91 1', whatsapp: '+91 2', email: '', whatsappMessage: 'Hi' })

  assert.deepEqual(sent, {
    phone: '+91 1',
    whatsapp: '+91 2',
    email: '',
    instagram: '',
    whatsapp_message: 'Hi',
  })
  assert.equal(SETTING_NAMES.length, 5)
})

test('digits are all that is left for a link', () => {
  assert.equal(digitsOf('+91 86087 05789'), '918608705789')
  assert.equal(digitsOf(undefined), '')
})

/* ---------------- the form ---------------- */

const good = {
  phone: '+91 86087 05789',
  whatsapp: '+91 86087 05789',
  email: 'shop@example.com',
  instagram: 'stomatalworld',
  whatsappMessage: 'Hi!',
}

test('a form with good details has nothing wrong', () => {
  assert.deepEqual(settingsProblems(good), {})
})

test('every detail may be left empty: it is then not shown', () => {
  assert.deepEqual(settingsProblems({ phone: '', whatsapp: '', email: '', instagram: '', whatsappMessage: '' }), {})
})

test('a number without its country code is pointed out, for call and WhatsApp alike', () => {
  for (const number of ['8608705789', '86087 05789', '+91', '+91 abc', '++91 86087 05789']) {
    const problems = settingsProblems({ ...good, phone: number, whatsapp: number })
    assert.ok(problems.phone, number)
    assert.ok(problems.whatsapp, number)
  }
})

test('numbers written with spaces, dashes and brackets are fine', () => {
  assert.deepEqual(settingsProblems({ ...good, whatsapp: '+91 (860) 870-5789' }), {})
})

test('an email without a domain is pointed out', () => {
  for (const email of ['nobody', 'a@b', 'a b@c.com', '@c.com']) {
    assert.ok(settingsProblems({ ...good, email }).email, email)
  }
})

test('instagram can be typed or pasted any way and is read as the handle', () => {
  for (const typed of [
    'stomatalworld',
    '@stomatalworld',
    ' https://instagram.com/stomatalworld ',
    'https://www.instagram.com/stomatalworld/',
    'instagram.com/stomatalworld?igsh=abc',
  ]) {
    assert.equal(instagramHandle(typed), 'stomatalworld', typed)
    assert.deepEqual(settingsProblems({ ...good, instagram: typed }), {}, typed)
  }
})

test('something that is not a handle is pointed out', () => {
  for (const typed of ['has space', 'https://example.com/stomatalworld', 'a'.repeat(31), 'bad/handle']) {
    assert.ok(settingsProblems({ ...good, instagram: typed }).instagram, typed)
  }
})

test('the greeting has a limit', () => {
  assert.deepEqual(settingsProblems({ ...good, whatsappMessage: 'x'.repeat(GREETING_MAX) }), {})
  assert.ok(settingsProblems({ ...good, whatsappMessage: 'x'.repeat(GREETING_MAX + 1) }).whatsappMessage)
})

test('several mistakes are all reported at once', () => {
  const problems = settingsProblems({ ...good, phone: '123', email: 'x', instagram: 'a b' })
  assert.deepEqual(Object.keys(problems).sort(), ['email', 'instagram', 'phone'])
})
