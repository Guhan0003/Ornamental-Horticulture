import { useEffect, useMemo, useState } from 'react'
import { ENVIRONMENTS, LIMITS, slugify } from '../../lib/plantFormat.js'
import ChipsInput from './ChipsInput.jsx'
import DeepDiveEditor from './DeepDiveEditor.jsx'
import LightLevels from './LightLevels.jsx'
import PhotoField from './PhotoField.jsx'

/**
 * Add and edit share this form. Its sections follow the plant page from top
 * to bottom, so what you fill in here is what a visitor reads, in that order.
 *
 * `onSave(payload)` should resolve with the saved plant, or throw.
 */
export default function PlantForm({ initial, isNew, onSave, footer }) {
  const [plant, setPlant] = useState(initial)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial))
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const dirty = useMemo(() => JSON.stringify(plant) !== baseline, [plant, baseline])

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

  const set = (patch) => setPlant((current) => ({ ...current, ...patch }))
  const setProfile = (patch) =>
    setPlant((current) => ({ ...current, profile: { ...current.profile, ...patch } }))

  const { profile } = plant

  function setName(common_name) {
    set({ common_name, ...(isNew && !slugTouched ? { slug: slugify(common_name) } : {}) })
  }

  async function submit(event) {
    event.preventDefault()
    setServerError(null)

    const found = validate(plant, isNew)
    setErrors(found)
    if (Object.keys(found).length) {
      requestAnimationFrame(() =>
        document
          .querySelector('.plant-form [aria-invalid="true"], .plant-form .is-invalid')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      )
      return
    }

    setSaving(true)
    try {
      const saved = await onSave(toPayload(plant, isNew))
      if (saved) {
        const next = { ...plant, ...pickEditable(saved) }
        setPlant(next)
        setBaseline(JSON.stringify(next))
        setSavedAt(new Date())
      }
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const host = typeof window !== 'undefined' ? window.location.host : ''

  return (
    <form className="plant-form" onSubmit={submit} noValidate>
      {/* 1 ─ Photo */}
      <FormSection number="1" title="Photo" hint="The big picture at the top of the page.">
        <PhotoField
          image={plant.image}
          onChange={(image) => set({ image })}
          invalid={Boolean(errors.image)}
        />
        {errors.image && <em className="field__error">{errors.image}</em>}
      </FormSection>

      {/* 2 ─ Identity */}
      <FormSection number="2" title="Identity">
        <div className="form-grid">
          <label className="field">
            <span>Common name *</span>
            <input
              value={plant.common_name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Peace Lily"
              maxLength={200}
              aria-invalid={Boolean(errors.common_name)}
            />
            {errors.common_name && <em className="field__error">{errors.common_name}</em>}
          </label>

          <label className="field">
            <span>Scientific name</span>
            <input
              value={plant.scientific_name}
              onChange={(e) => set({ scientific_name: e.target.value })}
              placeholder="Spathiphyllum wallisii"
              maxLength={200}
              className="is-italic"
            />
          </label>
        </div>

        <div className="field">
          <span>Page address {isNew && '*'}</span>
          {isNew ? (
            <>
              <div className={`address-input${errors.slug ? ' is-invalid' : ''}`}>
                <span className="address-input__host">{host}/</span>
                <input
                  value={plant.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set({ slug: slugify(e.target.value) })
                  }}
                  placeholder="peace-lily"
                  maxLength={160}
                  aria-label="Page address"
                  aria-invalid={Boolean(errors.slug)}
                />
              </div>
              {errors.slug && <em className="field__error">{errors.slug}</em>}
              <small className="field__warn">
                Filled in from the name. It <strong>can’t be changed after saving</strong>, because
                QR labels will point at it.
              </small>
            </>
          ) : (
            <div className="address-locked">
              <span>
                {host}/<strong>{plant.slug}</strong>
              </span>
              <small>Permanent</small>
            </div>
          )}
        </div>
      </FormSection>

      {/* 3 ─ Quick profile */}
      <FormSection number="3" title="Quick Profile" hint="All optional. Empty cards are hidden on the page.">
        <div className="field">
          <span>Environment</span>
          <div className="segmented" role="radiogroup" aria-label="Environment">
            {ENVIRONMENTS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={profile.environment === option}
                className={profile.environment === option ? 'is-selected' : ''}
                onClick={() =>
                  setProfile({ environment: profile.environment === option ? '' : option })
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="subgroup">
          <legend>Light need</legend>
          <div className="form-grid">
            <label className="field">
              <span>Summary</span>
              <input
                value={profile.light.label}
                onChange={(e) => setProfile({ light: { ...profile.light, label: e.target.value } })}
                placeholder="Medium to bright indirect light"
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Tolerance note</span>
              <input
                value={profile.light.note}
                onChange={(e) => setProfile({ light: { ...profile.light, note: e.target.value } })}
                placeholder="Tolerates low light"
                maxLength={120}
              />
            </label>
          </div>
          <LightLevels
            ideal={profile.light.ideal}
            tolerates={profile.light.tolerates}
            onChange={(levels) => setProfile({ light: { ...profile.light, ...levels } })}
          />
        </fieldset>

        <div className="form-grid">
          <fieldset className="subgroup">
            <legend>Landscape use</legend>
            <ChipsInput
              label="Landscape uses"
              items={profile.landscape_use.items}
              onChange={(items) =>
                setProfile({ landscape_use: { ...profile.landscape_use, items } })
              }
              placeholder="Shaded tropical borders, then Enter"
            />
            <input
              value={profile.landscape_use.note}
              onChange={(e) =>
                setProfile({ landscape_use: { ...profile.landscape_use, note: e.target.value } })
              }
              placeholder="Note, e.g. Frost-free zones"
              aria-label="Landscape use note"
              maxLength={120}
            />
          </fieldset>

          <fieldset className="subgroup">
            <legend>Home use</legend>
            <ChipsInput
              label="Home uses"
              items={profile.home_use.items}
              onChange={(items) => setProfile({ home_use: { ...profile.home_use, items } })}
              placeholder="Tabletop accent, then Enter"
            />
            <input
              value={profile.home_use.note}
              onChange={(e) =>
                setProfile({ home_use: { ...profile.home_use, note: e.target.value } })
              }
              placeholder="Note (optional)"
              aria-label="Home use note"
              maxLength={120}
            />
          </fieldset>
        </div>
      </FormSection>

      {/* 4 ─ The Snap */}
      <FormSection number="4" title="The Snap" hint="The short description: what the plant is, at a glance.">
        <label className="field">
          <span className="visually-hidden">The Snap</span>
          <textarea
            rows={3}
            value={plant.snap}
            onChange={(e) => set({ snap: e.target.value })}
            placeholder="An elegant indoor staple known for glossy dark leaves…"
            maxLength={LIMITS.snap}
            aria-invalid={Boolean(errors.snap)}
          />
          <span className="field__foot">
            {errors.snap ? <em className="field__error">{errors.snap}</em> : <span />}
            <small className={plant.snap.length > LIMITS.snap * 0.9 ? 'field__warn' : ''}>
              {plant.snap.length}/{LIMITS.snap}
            </small>
          </span>
        </label>
      </FormSection>

      {/* 5 ─ The Deep Dive */}
      <FormSection number="5" title="The Deep Dive" hint="The long description, as titled points. Blank points are skipped.">
        {errors.deep_dive && <em className="field__error">{errors.deep_dive}</em>}
        <DeepDiveEditor
          points={plant.deep_dive}
          onChange={(deep_dive) => set({ deep_dive })}
          errors={errors}
        />
      </FormSection>

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
        {footer}
        <button type="submit" className="btn btn--primary" disabled={saving || (!dirty && !isNew)}>
          {saving ? 'Saving…' : isNew ? 'Add plant' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function FormSection({ number, title, hint, children }) {
  return (
    <section className="form-section">
      <header className="form-section__head">
        <span className="form-section__number">{number}</span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      <div className="form-section__body">{children}</div>
    </section>
  )
}

const isBlankPoint = (point) => !point.title.trim() && !point.body.trim()

function validate(plant, isNew) {
  const errors = {}
  if (!plant.image.url) errors.image = 'Add a photo.'
  if (!plant.common_name.trim()) errors.common_name = 'Give the plant a name.'
  if (isNew && !plant.slug) errors.slug = 'The page needs an address.'
  if (!plant.snap.trim()) errors.snap = 'Write a sentence or two.'

  plant.deep_dive.forEach((point, index) => {
    if (isBlankPoint(point)) return
    if (!point.title.trim()) errors[`deep_dive.${index}.title`] = 'Add a title, or clear the text.'
    if (!point.body.trim()) errors[`deep_dive.${index}.body`] = 'Add the text, or clear the title.'
  })
  if (plant.deep_dive.every(isBlankPoint)) errors.deep_dive = 'Fill in at least one point.'

  return errors
}

const cleanList = (items) => items.map((item) => item.trim()).filter(Boolean)

function toPayload(plant, isNew) {
  const { profile } = plant
  const payload = {
    common_name: plant.common_name.trim(),
    scientific_name: plant.scientific_name.trim(),
    image: { ...plant.image, alt: plant.image.alt.trim() },
    profile: {
      environment: profile.environment,
      light: {
        ...profile.light,
        label: profile.light.label.trim(),
        note: profile.light.note.trim(),
      },
      landscape_use: {
        items: cleanList(profile.landscape_use.items),
        note: profile.landscape_use.note.trim(),
      },
      home_use: {
        items: cleanList(profile.home_use.items),
        note: profile.home_use.note.trim(),
      },
    },
    snap: plant.snap.trim(),
    deep_dive: plant.deep_dive
      .filter((point) => !isBlankPoint(point))
      .map((point) => ({ icon: point.icon, title: point.title.trim(), body: point.body.trim() })),
  }
  return isNew ? { slug: plant.slug, ...payload } : payload
}

/** The fields the form edits, from a plant as the API returns it. */
export function pickEditable(plant) {
  const { slug, common_name, scientific_name, image, profile, snap, deep_dive } = plant
  return { slug, common_name, scientific_name, image, profile, snap, deep_dive }
}
