import { LIGHT_SCALE } from '../../lib/plantFormat.js'

const NEXT = { none: 'ideal', ideal: 'ok', ok: 'none' }
const LABEL = { none: 'Not suitable', ideal: 'Ideal', ok: 'Tolerates' }

/**
 * Where the plant sits on the light scale. Each step cycles
 * not suitable → ideal → tolerates, and draws exactly like the meter on the page.
 */
export default function LightLevels({ ideal, tolerates, onChange }) {
  const stateOf = (index) =>
    ideal.includes(index) ? 'ideal' : tolerates.includes(index) ? 'ok' : 'none'

  function cycle(index) {
    const next = NEXT[stateOf(index)]
    const without = (list) => list.filter((i) => i !== index)
    onChange({
      ideal: next === 'ideal' ? [...ideal, index].sort() : without(ideal),
      tolerates: next === 'ok' ? [...tolerates, index].sort() : without(tolerates),
    })
  }

  return (
    <div className="light-levels">
      <div className="light-levels__steps" role="group" aria-label="Light levels">
        {LIGHT_SCALE.map((step, index) => {
          const state = stateOf(index)
          return (
            <button
              key={step}
              type="button"
              className={`light-levels__step light-levels__step--${state}`}
              onClick={() => cycle(index)}
              aria-label={`${step}: ${LABEL[state]}. Click to change.`}
            >
              <span className="light-levels__bar" />
              <span className="light-levels__name">{step}</span>
              <span className="light-levels__state">{LABEL[state]}</span>
            </button>
          )
        })}
      </div>
      <small>Click a step to mark it ideal, then again for tolerated, then again to clear.</small>
    </div>
  )
}
