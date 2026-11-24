/**
 * The shop's contact details: the ones built into the site, and the ones the owner
 * has saved in the dashboard.
 *
 * What is in data/contact.js is the starting point and the fallback, so the site
 * always has a number to show, even on the first visit on a bad connection or while
 * the server is waking. Whatever the owner has saved on the Settings page is laid
 * over it. Nothing here touches the page or the browser, so all of it can be tested;
 * the part that keeps the result is in contactStore.js.
 */

// The settings the dashboard can change, and what the server calls each. Everything
// else in data/contact.js (the heading, the description) stays in the code.
const FIELDS = {
  phone: 'phone',
  whatsapp: 'whatsapp',
  email: 'email',
  instagram: 'instagram',
  whatsappMessage: 'whatsapp_message',
}

export const SETTING_NAMES = Object.keys(FIELDS)

/**
 * The built-in details with the saved ones laid over them.
 *
 * `saved` is what the server returns, or what the phone remembered of it. A setting
 * that was never saved is simply absent from it, and the built-in value stays. One
 * that was saved empty is an empty string, and wins: that is the owner saying "we
 * have no Instagram", which is different from never having said anything.
 *
 * Anything that is not a string is ignored, because this is also read back from the
 * phone's storage, which anyone can edit.
 */
export function mergeContact(builtIn, saved) {
  const merged = { ...builtIn }
  if (!saved || typeof saved !== 'object') return merged

  for (const [name, serverName] of Object.entries(FIELDS)) {
    if (typeof saved[serverName] === 'string') merged[name] = saved[serverName]
  }
  return merged
}

/** The dashboard's form, in the server's words. */
export function toSettings(details) {
  const settings = {}
  for (const [name, serverName] of Object.entries(FIELDS)) settings[serverName] = details[name] ?? ''
  return settings
}

/** Digits only, for building tel: and wa.me links. */
export const digitsOf = (value) => String(value ?? '').replace(/[^\d]/g, '')

/* ---------------- the dashboard's form ---------------- */

// These are the same rules the server applies (backend/app/schemas/settings.py), so a
// mistake is pointed out beside the field instead of coming back as a failed save.

export const GREETING_MAX = 300

const PHONE_CHARS = /^\+[\d\s\-()]+$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const HANDLE = /^[A-Za-z0-9._]{1,30}$/
const INSTAGRAM_LINK = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i

/** "@name", "name" or a pasted profile link, as the handle alone. Anything else comes back as typed. */
export function instagramHandle(text) {
  const typed = String(text ?? '').trim()
  const link = typed.match(INSTAGRAM_LINK)
  return (link ? link[1] : typed).replace(/^@+/, '')
}

function numberProblem(text) {
  const value = text.trim()
  if (!value) return null
  if (!PHONE_CHARS.test(value)) return 'Start with the country code, like +91 86087 05789.'
  const count = digitsOf(value).length
  return count >= 8 && count <= 15 ? null : 'That does not look like a full phone number.'
}

/** What is wrong with the form, field by field. An empty object means it can be saved. */
export function settingsProblems(form) {
  const problems = {}

  const phone = numberProblem(form.phone ?? '')
  if (phone) problems.phone = phone
  const whatsapp = numberProblem(form.whatsapp ?? '')
  if (whatsapp) problems.whatsapp = whatsapp

  const email = (form.email ?? '').trim()
  if (email && !EMAIL.test(email)) problems.email = 'That does not look like an email address.'

  const instagram = (form.instagram ?? '').trim()
  if (instagram && !HANDLE.test(instagramHandle(instagram))) {
    problems.instagram = 'Use the handle, like stomatalworld, or paste the profile link.'
  }

  if ((form.whatsappMessage ?? '').trim().length > GREETING_MAX) {
    problems.whatsappMessage = `Keep it under ${GREETING_MAX} characters.`
  }

  return problems
}
