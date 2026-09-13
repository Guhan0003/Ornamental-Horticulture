import Icon from '../../components/Icon.jsx'
import { DEEP_DIVE_ICONS, LIMITS } from '../../lib/plantFormat.js'

const MAX_POINTS = 12

/** The Deep Dive: titled points, each with an icon, in page order. */
export default function DeepDiveEditor({ points, onChange, errors }) {
  const update = (index, patch) =>
    onChange(points.map((point, i) => (i === index ? { ...point, ...patch } : point)))

  const move = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= points.length) return
    const next = [...points]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const remove = (index) => onChange(points.filter((_, i) => i !== index))

  const add = () => onChange([...points, { icon: 'sparkle', title: '', body: '' }])

  return (
    <div className="dive-editor">
      <ol className="dive-editor__list">
        {points.map((point, index) => (
          <li className="dive-point" key={index}>
            <div className="dive-point__head">
              <span className="dive-point__number">{index + 1}</span>

              <div className="dive-point__icons" role="radiogroup" aria-label="Icon">
                {DEEP_DIVE_ICONS.map(({ name, label }) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={point.icon === name}
                    className={`icon-choice${point.icon === name ? ' is-selected' : ''}`}
                    onClick={() => update(index, { icon: name })}
                    title={label}
                    aria-label={label}
                  >
                    <Icon name={name} />
                  </button>
                ))}
              </div>

              <div className="dive-point__actions">
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => move(index, 1)}
                  disabled={index === points.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--danger"
                  onClick={() => remove(index)}
                  disabled={points.length === 1}
                  aria-label={`Remove point ${index + 1}`}
                >
                  ×
                </button>
              </div>
            </div>

            <label className="field">
              <span>Title</span>
              <input
                value={point.title}
                onChange={(e) => update(index, { title: e.target.value })}
                placeholder="Key Care Rule"
                maxLength={80}
                aria-invalid={Boolean(errors[`deep_dive.${index}.title`])}
              />
              {errors[`deep_dive.${index}.title`] && (
                <em className="field__error">{errors[`deep_dive.${index}.title`]}</em>
              )}
            </label>

            <label className="field">
              <span>Text</span>
              <textarea
                rows={3}
                value={point.body}
                onChange={(e) => update(index, { body: e.target.value })}
                placeholder="Keep soil consistently moist but never waterlogged…"
                maxLength={LIMITS.deepDiveBody}
                aria-invalid={Boolean(errors[`deep_dive.${index}.body`])}
              />
              {errors[`deep_dive.${index}.body`] && (
                <em className="field__error">{errors[`deep_dive.${index}.body`]}</em>
              )}
            </label>
          </li>
        ))}
      </ol>

      {points.length < MAX_POINTS && (
        <button type="button" className="btn btn--ghost" onClick={add}>
          + Add a point
        </button>
      )}
    </div>
  )
}
