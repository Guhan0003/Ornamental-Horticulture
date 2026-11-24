import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api.js'
import { GREETING_MAX, digitsOf, instagramHandle, mergeContact, settingsProblems, toSettings } from '../../lib/contact.js'
import { setSavedContact } from '../../lib/contactStore.js'
import { contact as builtIn } from '../../data/contact.js'

const toForm = (saved) => {
  const details = mergeContact(builtIn, saved)
  return {
    phone: details.phone,
    whatsapp: details.whatsapp,
    email: details.email,
    instagram: details.instagram,
    whatsappMessage: details.whatsappMessage,
  }
}

/**
 * The shop's phone numbers, email and Instagram, without touching the code.
 *
 * What is saved here is what every page of the shop builds its Call, WhatsApp and
 * Instagram buttons from, and what every plant's order button sends its message to.
 */
export default function Settings() {
  const [form, setForm] = useState(null)
  const [baseline, setBaseline] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    // Fresh: the page must show what was last saved, not a copy kept for a minute.
    api
      .getSettings({ fresh: true })
      .then((saved) => {
        if (cancelled) return
        const next = toForm(saved)
        setForm(next)
        setBaseline(JSON.stringify(next))
      })
      .catch((e) => !cancelled && setLoadError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== baseline, [form, baseline])

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (loadError) return <p className="form__error" role="alert">{loadError}</p>
  if (!form) return <div className="admin-loading">Loading…</div>

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }))
    // A mistake that was pointed out goes away as soon as that field is touched.
    setErrors((current) => {
      const next = { ...current }
      for (const name of Object.keys(patch)) delete next[name]
      return next
    })
    setSavedAt(null)
  }

  async function submit(event) {
    event.preventDefault()
    setServerError(null)

    const found = settingsProblems(form)
    setErrors(found)
    if (Object.keys(found).length) {
      // Take the owner to the first thing that needs fixing, as the plant form does.
      requestAnimationFrame(() =>
        document
          .querySelector('.plant-form [aria-invalid="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      )
      return
    }

    setSaving(true)
    try {
      const saved = await api.saveSettings(toSettings(form))
      const next = toForm(saved)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setSavedAt(new Date())
      // This tab's own copy of the shop is up to date at once, whatever the CDN keeps.
      setSavedContact(saved)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handle = instagramHandle(form.instagram)

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Settings</h1>
          <p className="admin__sub">The contact details customers see across the shop.</p>
        </div>
      </div>

      <form className="plant-form" onSubmit={submit} noValidate>
        <section className="form-section">
          <header className="form-section__head">
            <span className="form-section__number">1</span>
            <div>
              <h2>Phone and WhatsApp</h2>
              <p>Orders arrive as WhatsApp messages to the number below.</p>
            </div>
          </header>
          <div className="form-section__body">
            <div className="form-grid">
              <label className="field">
                <span>WhatsApp number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.whatsapp}
                  onChange={(e) => set({ whatsapp: e.target.value })}
                  placeholder="+91 86087 05789"
                  maxLength={30}
                  aria-invalid={Boolean(errors.whatsapp)}
                />
                {errors.whatsapp && <em className="field__error">{errors.whatsapp}</em>}
                {!form.whatsapp.trim() && (
                  <small className="field__warn">
                    With no WhatsApp number, every “Order on WhatsApp” button disappears from the shop.
                  </small>
                )}
                {!errors.whatsapp && form.whatsapp.trim() && (
                  <small>
                    Include the country code.{' '}
                    <a href={`https://wa.me/${digitsOf(form.whatsapp)}`} target="_blank" rel="noreferrer">
                      Try it ↗
                    </a>
                  </small>
                )}
              </label>

              <label className="field">
                <span>Call number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+91 86087 05789"
                  maxLength={30}
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <em className="field__error">{errors.phone}</em>}
                {!errors.phone && (
                  <small>
                    Behind the Call button. Can be the same number. Empty hides the button.
                  </small>
                )}
              </label>
            </div>

            <label className="field">
              <span>First message when someone opens the chat from the contact card</span>
              <textarea
                rows={3}
                value={form.whatsappMessage}
                onChange={(e) => set({ whatsappMessage: e.target.value })}
                placeholder="Hi! I saw your plants at StomatalWorld and have a question."
                aria-invalid={Boolean(errors.whatsappMessage)}
              />
              <span className="field__foot">
                {errors.whatsappMessage ? (
                  <em className="field__error">{errors.whatsappMessage}</em>
                ) : (
                  <small>Order buttons write their own message, naming the plant.</small>
                )}
                <small>
                  {form.whatsappMessage.trim().length}/{GREETING_MAX}
                </small>
              </span>
            </label>
          </div>
        </section>

        <section className="form-section">
          <header className="form-section__head">
            <span className="form-section__number">2</span>
            <div>
              <h2>Email and Instagram</h2>
              <p>Shown in the contact card at the bottom left of every page.</p>
            </div>
          </header>
          <div className="form-section__body">
            <div className="form-grid">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  placeholder="hello@example.com"
                  maxLength={120}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <em className="field__error">{errors.email}</em>
                ) : (
                  <small>Empty hides it.</small>
                )}
              </label>

              <label className="field">
                <span>Instagram</span>
                <input
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={form.instagram}
                  onChange={(e) => set({ instagram: e.target.value })}
                  placeholder="stomatalworld"
                  maxLength={200}
                  aria-invalid={Boolean(errors.instagram)}
                />
                {errors.instagram ? (
                  <em className="field__error">{errors.instagram}</em>
                ) : handle ? (
                  <small>
                    Opens instagram.com/{handle}.{' '}
                    <a href={`https://instagram.com/${encodeURIComponent(handle)}`} target="_blank" rel="noreferrer">
                      Try it ↗
                    </a>
                  </small>
                ) : (
                  <small>The handle, or paste the profile link. Empty hides it.</small>
                )}
              </label>
            </div>
          </div>
        </section>

        <p className="admin__hint">
          Customers see a change within a minute or two. When the shop has been quiet, the very first
          visitor afterwards can still see the old details once, so check the shop twice.
        </p>

        <div className="form-bar">
          <div className="form-bar__status" role="status">
            {serverError ? (
              <span className="form-bar__error">{serverError}</span>
            ) : Object.keys(errors).length ? (
              <span className="form-bar__error">Some fields need attention.</span>
            ) : dirty ? (
              <span>Unsaved changes</span>
            ) : savedAt ? (
              <span className="form-bar__ok">Saved ✓</span>
            ) : null}
          </div>
          <button type="submit" className="btn btn--primary" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  )
}
